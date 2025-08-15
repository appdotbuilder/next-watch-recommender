import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { userInteractionsTable, userProfilesTable, mediaItemsTable } from '../db/schema';
import { type CreateUserInteractionInput } from '../schema';
import { createUserInteraction } from '../handlers/create_user_interaction';
import { eq, and } from 'drizzle-orm';

describe('createUserInteraction', () => {
  let testUserId: number;
  let testMediaItemId: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        tmdb_id: 12345,
        title: 'Test Movie',
        media_type: 'movie',
        overview: 'A test movie',
        genres: ['Action', 'Drama'],
        vote_average: '7.5',
        vote_count: 1000,
        popularity: '85.5',
        adult: false,
        original_language: 'en'
      })
      .returning()
      .execute();
    testMediaItemId = mediaResult[0].id;
  });

  afterEach(resetDB);

  describe('with user_id', () => {
    const createTestInput = (overrides = {}): CreateUserInteractionInput => ({
      user_id: testUserId,
      media_item_id: testMediaItemId,
      interaction_type: 'like',
      ...overrides
    });

    it('should create a new user interaction', async () => {
      const input = createTestInput();
      const result = await createUserInteraction(input);

      expect(result.user_id).toBe(testUserId);
      expect(result.session_id).toBeNull();
      expect(result.media_item_id).toBe(testMediaItemId);
      expect(result.interaction_type).toBe('like');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save interaction to database', async () => {
      const input = createTestInput();
      const result = await createUserInteraction(input);

      const interactions = await db.select()
        .from(userInteractionsTable)
        .where(eq(userInteractionsTable.id, result.id))
        .execute();

      expect(interactions).toHaveLength(1);
      expect(interactions[0].user_id).toBe(testUserId);
      expect(interactions[0].media_item_id).toBe(testMediaItemId);
      expect(interactions[0].interaction_type).toBe('like');
    });

    it('should update existing interaction for same user and media item', async () => {
      // Create initial interaction
      const initialInput = createTestInput({ interaction_type: 'like' });
      await createUserInteraction(initialInput);

      // Update to different interaction type
      const updateInput = createTestInput({ interaction_type: 'dislike' });
      const result = await createUserInteraction(updateInput);

      // Should still have only one interaction in database
      const allInteractions = await db.select()
        .from(userInteractionsTable)
        .where(
          and(
            eq(userInteractionsTable.user_id, testUserId),
            eq(userInteractionsTable.media_item_id, testMediaItemId)
          )
        )
        .execute();

      expect(allInteractions).toHaveLength(1);
      expect(allInteractions[0].interaction_type).toBe('dislike');
      expect(result.interaction_type).toBe('dislike');
    });

    it('should handle all interaction types', async () => {
      const interactionTypes = ['like', 'dislike', 'watched_liked', 'watched_disliked', 'add_to_watchlist', 'remove_from_watchlist'] as const;

      for (const interactionType of interactionTypes) {
        const input = createTestInput({ interaction_type: interactionType });
        const result = await createUserInteraction(input);
        expect(result.interaction_type).toBe(interactionType);
      }
    });

    it('should create separate interactions for different media items', async () => {
      // Create second media item
      const secondMediaResult = await db.insert(mediaItemsTable)
        .values({
          tmdb_id: 67890,
          title: 'Another Test Movie',
          media_type: 'tv',
          overview: 'Another test movie',
          genres: ['Comedy'],
          vote_average: '6.8',
          vote_count: 500,
          popularity: '45.2',
          adult: false,
          original_language: 'en'
        })
        .returning()
        .execute();

      // Create interactions for both media items
      await createUserInteraction(createTestInput({ media_item_id: testMediaItemId, interaction_type: 'like' }));
      await createUserInteraction(createTestInput({ media_item_id: secondMediaResult[0].id, interaction_type: 'dislike' }));

      // Should have two separate interactions
      const allInteractions = await db.select()
        .from(userInteractionsTable)
        .where(eq(userInteractionsTable.user_id, testUserId))
        .execute();

      expect(allInteractions).toHaveLength(2);
    });
  });

  describe('with session_id', () => {
    const createTestInput = (overrides = {}): CreateUserInteractionInput => ({
      session_id: 'test-session-123',
      media_item_id: testMediaItemId,
      interaction_type: 'like',
      ...overrides
    });

    it('should create a new guest interaction', async () => {
      const input = createTestInput();
      const result = await createUserInteraction(input);

      expect(result.user_id).toBeNull();
      expect(result.session_id).toBe('test-session-123');
      expect(result.media_item_id).toBe(testMediaItemId);
      expect(result.interaction_type).toBe('like');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update existing guest interaction', async () => {
      // Create initial guest interaction
      const initialInput = createTestInput({ interaction_type: 'like' });
      await createUserInteraction(initialInput);

      // Update to different interaction type
      const updateInput = createTestInput({ interaction_type: 'watched_liked' });
      const result = await createUserInteraction(updateInput);

      // Should still have only one interaction in database
      const allInteractions = await db.select()
        .from(userInteractionsTable)
        .where(
          and(
            eq(userInteractionsTable.session_id, 'test-session-123'),
            eq(userInteractionsTable.media_item_id, testMediaItemId)
          )
        )
        .execute();

      expect(allInteractions).toHaveLength(1);
      expect(allInteractions[0].interaction_type).toBe('watched_liked');
      expect(result.interaction_type).toBe('watched_liked');
    });

    it('should create separate interactions for different sessions', async () => {
      const session1Input = createTestInput({ session_id: 'session-1' });
      const session2Input = createTestInput({ session_id: 'session-2' });

      await createUserInteraction(session1Input);
      await createUserInteraction(session2Input);

      // Should have two separate interactions
      const allInteractions = await db.select()
        .from(userInteractionsTable)
        .where(eq(userInteractionsTable.media_item_id, testMediaItemId))
        .execute();

      expect(allInteractions).toHaveLength(2);
      expect(allInteractions.map(i => i.session_id).sort()).toEqual(['session-1', 'session-2']);
    });
  });

  describe('error handling', () => {
    it('should throw error when neither user_id nor session_id is provided', async () => {
      const input: CreateUserInteractionInput = {
        media_item_id: testMediaItemId,
        interaction_type: 'like'
      };

      await expect(createUserInteraction(input)).rejects.toThrow(/Either user_id or session_id must be provided/i);
    });

    it('should throw error when media_item_id does not exist', async () => {
      const input: CreateUserInteractionInput = {
        user_id: testUserId,
        media_item_id: 99999, // Non-existent media item
        interaction_type: 'like'
      };

      await expect(createUserInteraction(input)).rejects.toThrow();
    });

    it('should throw error when user_id does not exist', async () => {
      const input: CreateUserInteractionInput = {
        user_id: 99999, // Non-existent user
        media_item_id: testMediaItemId,
        interaction_type: 'like'
      };

      await expect(createUserInteraction(input)).rejects.toThrow();
    });
  });

  describe('mixed user and guest interactions', () => {
    it('should handle separate interactions for same media item with user_id and session_id', async () => {
      const userInput: CreateUserInteractionInput = {
        user_id: testUserId,
        media_item_id: testMediaItemId,
        interaction_type: 'like'
      };

      const guestInput: CreateUserInteractionInput = {
        session_id: 'guest-session',
        media_item_id: testMediaItemId,
        interaction_type: 'dislike'
      };

      await createUserInteraction(userInput);
      await createUserInteraction(guestInput);

      // Should have two separate interactions for the same media item
      const allInteractions = await db.select()
        .from(userInteractionsTable)
        .where(eq(userInteractionsTable.media_item_id, testMediaItemId))
        .execute();

      expect(allInteractions).toHaveLength(2);
      
      const userInteraction = allInteractions.find(i => i.user_id === testUserId);
      const guestInteraction = allInteractions.find(i => i.session_id === 'guest-session');

      expect(userInteraction).toBeDefined();
      expect(userInteraction!.interaction_type).toBe('like');
      expect(guestInteraction).toBeDefined();
      expect(guestInteraction!.interaction_type).toBe('dislike');
    });
  });
});