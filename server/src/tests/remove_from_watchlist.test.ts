import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { userProfilesTable, mediaItemsTable, watchlistTable } from '../db/schema';
import { type WatchlistInput, type CreateUserProfileInput, type CreateMediaItemInput } from '../schema';
import { removeFromWatchlist } from '../handlers/remove_from_watchlist';
import { eq, and } from 'drizzle-orm';

// Test data
const testUserInput: CreateUserProfileInput = {
  username: 'testuser',
  email: 'test@example.com'
};

const testMediaInput: CreateMediaItemInput = {
  tmdb_id: 12345,
  title: 'Test Movie',
  media_type: 'movie',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  overview: 'A test movie for watchlist operations',
  release_date: '2024-01-01',
  genres: ['Action', 'Drama'],
  vote_average: 7.5,
  vote_count: 1000,
  popularity: 85.5,
  adult: false,
  original_language: 'en'
};

describe('removeFromWatchlist', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should remove item from watchlist for registered user', async () => {
    // Create test user
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUserInput.username,
        email: testUserInput.email
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaInput,
        vote_average: testMediaInput.vote_average.toString(),
        popularity: testMediaInput.popularity.toString()
      })
      .returning()
      .execute();
    const mediaId = mediaResult[0].id;

    // Add item to watchlist first
    await db.insert(watchlistTable)
      .values({
        user_id: userId,
        session_id: null,
        media_item_id: mediaId
      })
      .execute();

    // Verify item is in watchlist
    const beforeRemoval = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.user_id, userId),
        eq(watchlistTable.media_item_id, mediaId)
      ))
      .execute();
    expect(beforeRemoval).toHaveLength(1);

    // Remove from watchlist
    const input: WatchlistInput = {
      user_id: userId,
      media_item_id: mediaId
    };

    const result = await removeFromWatchlist(input);

    expect(result.success).toBe(true);

    // Verify item is removed from watchlist
    const afterRemoval = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.user_id, userId),
        eq(watchlistTable.media_item_id, mediaId)
      ))
      .execute();
    expect(afterRemoval).toHaveLength(0);
  });

  it('should remove item from watchlist for guest session', async () => {
    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaInput,
        vote_average: testMediaInput.vote_average.toString(),
        popularity: testMediaInput.popularity.toString()
      })
      .returning()
      .execute();
    const mediaId = mediaResult[0].id;

    const sessionId = 'guest-session-123';

    // Add item to watchlist first
    await db.insert(watchlistTable)
      .values({
        user_id: null,
        session_id: sessionId,
        media_item_id: mediaId
      })
      .execute();

    // Verify item is in watchlist
    const beforeRemoval = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.session_id, sessionId),
        eq(watchlistTable.media_item_id, mediaId)
      ))
      .execute();
    expect(beforeRemoval).toHaveLength(1);

    // Remove from watchlist
    const input: WatchlistInput = {
      session_id: sessionId,
      media_item_id: mediaId
    };

    const result = await removeFromWatchlist(input);

    expect(result.success).toBe(true);

    // Verify item is removed from watchlist
    const afterRemoval = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.session_id, sessionId),
        eq(watchlistTable.media_item_id, mediaId)
      ))
      .execute();
    expect(afterRemoval).toHaveLength(0);
  });

  it('should return success when removing non-existent item (idempotent)', async () => {
    // Create test user and media item but don't add to watchlist
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUserInput.username,
        email: testUserInput.email
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaInput,
        vote_average: testMediaInput.vote_average.toString(),
        popularity: testMediaInput.popularity.toString()
      })
      .returning()
      .execute();
    const mediaId = mediaResult[0].id;

    // Try to remove item that's not in watchlist
    const input: WatchlistInput = {
      user_id: userId,
      media_item_id: mediaId
    };

    const result = await removeFromWatchlist(input);

    // Should still return success (idempotent behavior)
    expect(result.success).toBe(true);
  });

  it('should return failure when neither user_id nor session_id provided', async () => {
    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaInput,
        vote_average: testMediaInput.vote_average.toString(),
        popularity: testMediaInput.popularity.toString()
      })
      .returning()
      .execute();
    const mediaId = mediaResult[0].id;

    // Try to remove without user identification
    const input: WatchlistInput = {
      media_item_id: mediaId
    };

    const result = await removeFromWatchlist(input);

    expect(result.success).toBe(false);
  });

  it('should only remove items for the correct user', async () => {
    // Create two test users
    const user1Result = await db.insert(userProfilesTable)
      .values({
        username: 'user1',
        email: 'user1@example.com'
      })
      .returning()
      .execute();
    const user1Id = user1Result[0].id;

    const user2Result = await db.insert(userProfilesTable)
      .values({
        username: 'user2',
        email: 'user2@example.com'
      })
      .returning()
      .execute();
    const user2Id = user2Result[0].id;

    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaInput,
        vote_average: testMediaInput.vote_average.toString(),
        popularity: testMediaInput.popularity.toString()
      })
      .returning()
      .execute();
    const mediaId = mediaResult[0].id;

    // Add same item to both users' watchlists
    await db.insert(watchlistTable)
      .values([
        {
          user_id: user1Id,
          session_id: null,
          media_item_id: mediaId
        },
        {
          user_id: user2Id,
          session_id: null,
          media_item_id: mediaId
        }
      ])
      .execute();

    // Remove item from user1's watchlist
    const input: WatchlistInput = {
      user_id: user1Id,
      media_item_id: mediaId
    };

    const result = await removeFromWatchlist(input);

    expect(result.success).toBe(true);

    // Verify user1's item is removed
    const user1Items = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.user_id, user1Id),
        eq(watchlistTable.media_item_id, mediaId)
      ))
      .execute();
    expect(user1Items).toHaveLength(0);

    // Verify user2's item still exists
    const user2Items = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.user_id, user2Id),
        eq(watchlistTable.media_item_id, mediaId)
      ))
      .execute();
    expect(user2Items).toHaveLength(1);
  });

  it('should only remove items for the correct session', async () => {
    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaInput,
        vote_average: testMediaInput.vote_average.toString(),
        popularity: testMediaInput.popularity.toString()
      })
      .returning()
      .execute();
    const mediaId = mediaResult[0].id;

    const session1Id = 'session-1';
    const session2Id = 'session-2';

    // Add same item to both sessions' watchlists
    await db.insert(watchlistTable)
      .values([
        {
          user_id: null,
          session_id: session1Id,
          media_item_id: mediaId
        },
        {
          user_id: null,
          session_id: session2Id,
          media_item_id: mediaId
        }
      ])
      .execute();

    // Remove item from session1's watchlist
    const input: WatchlistInput = {
      session_id: session1Id,
      media_item_id: mediaId
    };

    const result = await removeFromWatchlist(input);

    expect(result.success).toBe(true);

    // Verify session1's item is removed
    const session1Items = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.session_id, session1Id),
        eq(watchlistTable.media_item_id, mediaId)
      ))
      .execute();
    expect(session1Items).toHaveLength(0);

    // Verify session2's item still exists
    const session2Items = await db.select()
      .from(watchlistTable)
      .where(and(
        eq(watchlistTable.session_id, session2Id),
        eq(watchlistTable.media_item_id, mediaId)
      ))
      .execute();
    expect(session2Items).toHaveLength(1);
  });
});