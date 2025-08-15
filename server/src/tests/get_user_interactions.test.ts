import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { userProfilesTable, userInteractionsTable, mediaItemsTable } from '../db/schema';
import { type GetUserInteractionsInput, type CreateUserProfileInput, type CreateMediaItemInput } from '../schema';
import { getUserInteractions } from '../handlers/get_user_interactions';

// Test data
const testUser: CreateUserProfileInput = {
  username: 'testuser',
  email: 'test@example.com'
};

const testMediaItem: CreateMediaItemInput = {
  tmdb_id: 12345,
  title: 'Test Movie',
  media_type: 'movie',
  poster_path: '/test-poster.jpg',
  backdrop_path: '/test-backdrop.jpg',
  overview: 'A test movie for testing',
  release_date: '2023-01-01',
  genres: ['Action', 'Adventure'],
  vote_average: 8.5,
  vote_count: 1000,
  popularity: 150.5,
  adult: false,
  original_language: 'en'
};

describe('getUserInteractions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get interactions for a registered user', async () => {
    // Create test user and media item
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();

    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const mediaItemId = mediaResult[0].id;

    // Create test interactions
    await db.insert(userInteractionsTable)
      .values([
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaItemId,
          interaction_type: 'like'
        },
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaItemId,
          interaction_type: 'add_to_watchlist'
        }
      ])
      .execute();

    const input: GetUserInteractionsInput = {
      user_id: userId
    };

    const result = await getUserInteractions(input);

    expect(result).toHaveLength(2);
    expect(result[0].user_id).toBe(userId);
    expect(result[0].media_item_id).toBe(mediaItemId);
    expect(['like', 'add_to_watchlist']).toContain(result[0].interaction_type);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should get interactions for a guest session', async () => {
    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
      })
      .returning()
      .execute();

    const mediaItemId = mediaResult[0].id;
    const sessionId = 'guest-session-123';

    // Create test interactions for guest session
    await db.insert(userInteractionsTable)
      .values([
        {
          user_id: null,
          session_id: sessionId,
          media_item_id: mediaItemId,
          interaction_type: 'dislike'
        },
        {
          user_id: null,
          session_id: sessionId,
          media_item_id: mediaItemId,
          interaction_type: 'watched_liked'
        }
      ])
      .execute();

    const input: GetUserInteractionsInput = {
      session_id: sessionId
    };

    const result = await getUserInteractions(input);

    expect(result).toHaveLength(2);
    expect(result[0].user_id).toBeNull();
    expect(result[0].session_id).toBe(sessionId);
    expect(result[0].media_item_id).toBe(mediaItemId);
    expect(['dislike', 'watched_liked']).toContain(result[0].interaction_type);
  });

  it('should filter interactions by interaction type', async () => {
    // Create test user and media item
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();

    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const mediaItemId = mediaResult[0].id;

    // Create multiple interaction types
    await db.insert(userInteractionsTable)
      .values([
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaItemId,
          interaction_type: 'like'
        },
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaItemId,
          interaction_type: 'dislike'
        },
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaItemId,
          interaction_type: 'add_to_watchlist'
        }
      ])
      .execute();

    const input: GetUserInteractionsInput = {
      user_id: userId,
      interaction_type: 'like'
    };

    const result = await getUserInteractions(input);

    expect(result).toHaveLength(1);
    expect(result[0].interaction_type).toBe('like');
    expect(result[0].user_id).toBe(userId);
  });

  it('should return empty array when no interactions found', async () => {
    // Create test user but no interactions
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();

    const input: GetUserInteractionsInput = {
      user_id: userResult[0].id
    };

    const result = await getUserInteractions(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle non-existent user_id gracefully', async () => {
    const input: GetUserInteractionsInput = {
      user_id: 99999 // Non-existent user ID
    };

    const result = await getUserInteractions(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle non-existent session_id gracefully', async () => {
    const input: GetUserInteractionsInput = {
      session_id: 'non-existent-session'
    };

    const result = await getUserInteractions(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all interactions when no filters specified', async () => {
    // Create test user and media item
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();

    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const mediaItemId = mediaResult[0].id;
    const sessionId = 'test-session';

    // Create interactions for both user and session
    await db.insert(userInteractionsTable)
      .values([
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaItemId,
          interaction_type: 'like'
        },
        {
          user_id: null,
          session_id: sessionId,
          media_item_id: mediaItemId,
          interaction_type: 'dislike'
        }
      ])
      .execute();

    const input: GetUserInteractionsInput = {};

    const result = await getUserInteractions(input);

    expect(result).toHaveLength(2);
    expect(result.some(r => r.user_id === userId)).toBe(true);
    expect(result.some(r => r.session_id === sessionId)).toBe(true);
  });
});