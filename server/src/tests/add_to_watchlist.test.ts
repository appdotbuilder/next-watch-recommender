import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { watchlistTable, userProfilesTable, mediaItemsTable } from '../db/schema';
import { type WatchlistInput } from '../schema';
import { addToWatchlist } from '../handlers/add_to_watchlist';
import { eq, and } from 'drizzle-orm';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com'
};

const testMediaItem = {
  tmdb_id: 12345,
  title: 'Test Movie',
  media_type: 'movie' as const,
  poster_path: '/test-poster.jpg',
  backdrop_path: '/test-backdrop.jpg',
  overview: 'A test movie for testing purposes',
  release_date: '2023-01-01',
  genres: ['Action', 'Drama'],
  vote_average: 7.5,
  vote_count: 1000,
  popularity: 85.5,
  adult: false,
  original_language: 'en'
};

describe('addToWatchlist', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let mediaItemId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(userProfilesTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
      })
      .returning()
      .execute();
    mediaItemId = mediaResult[0].id;
  });

  it('should add item to watchlist for registered user', async () => {
    const input: WatchlistInput = {
      user_id: userId,
      media_item_id: mediaItemId
    };

    const result = await addToWatchlist(input);

    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(userId);
    expect(result.session_id).toBeNull();
    expect(result.media_item_id).toEqual(mediaItemId);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should add item to watchlist for guest session', async () => {
    const sessionId = 'guest-session-123';
    const input: WatchlistInput = {
      session_id: sessionId,
      media_item_id: mediaItemId
    };

    const result = await addToWatchlist(input);

    expect(result.id).toBeDefined();
    expect(result.user_id).toBeNull();
    expect(result.session_id).toEqual(sessionId);
    expect(result.media_item_id).toEqual(mediaItemId);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save watchlist entry to database', async () => {
    const input: WatchlistInput = {
      user_id: userId,
      media_item_id: mediaItemId
    };

    const result = await addToWatchlist(input);

    // Verify it was saved to database
    const savedEntries = await db.select()
      .from(watchlistTable)
      .where(eq(watchlistTable.id, result.id))
      .execute();

    expect(savedEntries).toHaveLength(1);
    expect(savedEntries[0].user_id).toEqual(userId);
    expect(savedEntries[0].media_item_id).toEqual(mediaItemId);
    expect(savedEntries[0].created_at).toBeInstanceOf(Date);
  });

  it('should prevent duplicate entries for same user and media item', async () => {
    const input: WatchlistInput = {
      user_id: userId,
      media_item_id: mediaItemId
    };

    // Add first time
    const firstResult = await addToWatchlist(input);

    // Try to add same item again
    const secondResult = await addToWatchlist(input);

    // Should return the same entry
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.user_id).toEqual(userId);
    expect(secondResult.media_item_id).toEqual(mediaItemId);

    // Verify only one entry exists in database
    const allEntries = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.user_id, userId),
        eq(watchlistTable.media_item_id, mediaItemId)
      ))
      .execute();

    expect(allEntries).toHaveLength(1);
  });

  it('should prevent duplicate entries for same session and media item', async () => {
    const sessionId = 'guest-session-456';
    const input: WatchlistInput = {
      session_id: sessionId,
      media_item_id: mediaItemId
    };

    // Add first time
    const firstResult = await addToWatchlist(input);

    // Try to add same item again
    const secondResult = await addToWatchlist(input);

    // Should return the same entry
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.session_id).toEqual(sessionId);
    expect(secondResult.media_item_id).toEqual(mediaItemId);

    // Verify only one entry exists in database
    const allEntries = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.session_id, sessionId),
        eq(watchlistTable.media_item_id, mediaItemId)
      ))
      .execute();

    expect(allEntries).toHaveLength(1);
  });

  it('should allow different users to add same media item', async () => {
    // Create second user
    const secondUserResult = await db.insert(userProfilesTable)
      .values({
        username: 'testuser2',
        email: 'test2@example.com'
      })
      .returning()
      .execute();
    const secondUserId = secondUserResult[0].id;

    // First user adds item
    const firstInput: WatchlistInput = {
      user_id: userId,
      media_item_id: mediaItemId
    };
    const firstResult = await addToWatchlist(firstInput);

    // Second user adds same item
    const secondInput: WatchlistInput = {
      user_id: secondUserId,
      media_item_id: mediaItemId
    };
    const secondResult = await addToWatchlist(secondInput);

    // Should be different entries
    expect(firstResult.id).not.toEqual(secondResult.id);
    expect(firstResult.user_id).toEqual(userId);
    expect(secondResult.user_id).toEqual(secondUserId);

    // Both should have same media item
    expect(firstResult.media_item_id).toEqual(mediaItemId);
    expect(secondResult.media_item_id).toEqual(mediaItemId);

    // Verify both entries exist in database
    const allEntries = await db.select()
      .from(watchlistTable)
      .where(eq(watchlistTable.media_item_id, mediaItemId))
      .execute();

    expect(allEntries).toHaveLength(2);
  });

  it('should allow user and guest session to add same media item', async () => {
    const sessionId = 'guest-session-789';

    // User adds item
    const userInput: WatchlistInput = {
      user_id: userId,
      media_item_id: mediaItemId
    };
    const userResult = await addToWatchlist(userInput);

    // Guest session adds same item
    const guestInput: WatchlistInput = {
      session_id: sessionId,
      media_item_id: mediaItemId
    };
    const guestResult = await addToWatchlist(guestInput);

    // Should be different entries
    expect(userResult.id).not.toEqual(guestResult.id);
    expect(userResult.user_id).toEqual(userId);
    expect(userResult.session_id).toBeNull();
    expect(guestResult.user_id).toBeNull();
    expect(guestResult.session_id).toEqual(sessionId);

    // Both should have same media item
    expect(userResult.media_item_id).toEqual(mediaItemId);
    expect(guestResult.media_item_id).toEqual(mediaItemId);

    // Verify both entries exist in database
    const allEntries = await db.select()
      .from(watchlistTable)
      .where(eq(watchlistTable.media_item_id, mediaItemId))
      .execute();

    expect(allEntries).toHaveLength(2);
  });
});