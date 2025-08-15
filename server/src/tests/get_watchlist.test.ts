import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { userProfilesTable, mediaItemsTable, watchlistTable } from '../db/schema';
import { type WatchlistInput, type CreateUserProfileInput, type CreateMediaItemInput } from '../schema';
import { getWatchlist } from '../handlers/get_watchlist';

// Test data
const testUser: CreateUserProfileInput = {
  username: 'testuser',
  email: 'test@example.com'
};

const testMediaItem1 = {
  tmdb_id: 550,
  title: 'Fight Club',
  media_type: 'movie' as const,
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  overview: 'A movie about fighting',
  release_date: '1999-10-15',
  genres: ['Drama', 'Thriller'],
  vote_average: 8.8,
  vote_count: 26280,
  popularity: 61.416,
  adult: false,
  original_language: 'en'
};

const testMediaItem2 = {
  tmdb_id: 13,
  title: 'Forrest Gump',
  media_type: 'movie' as const,
  poster_path: '/forrest.jpg',
  backdrop_path: '/forrest_backdrop.jpg',
  overview: 'Life is like a box of chocolates',
  release_date: '1994-06-23',
  genres: ['Drama', 'Romance'],
  vote_average: 8.5,
  vote_count: 24500,
  popularity: 45.2,
  adult: false,
  original_language: 'en'
};

describe('getWatchlist', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no user_id or session_id provided', async () => {
    const input: WatchlistInput = {
      media_item_id: 1
    };

    const result = await getWatchlist(input);

    expect(result).toEqual([]);
  });

  it('should return empty watchlist for user with no items', async () => {
    // Create a user
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const input: WatchlistInput = {
      user_id: userId,
      media_item_id: 1
    };

    const result = await getWatchlist(input);

    expect(result).toEqual([]);
  });

  it('should return watchlist items for registered user with media details', async () => {
    // Create a user
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create media items
    const mediaResult1 = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem1,
        vote_average: testMediaItem1.vote_average.toString(),
        popularity: testMediaItem1.popularity.toString()
      })
      .returning()
      .execute();

    const mediaResult2 = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem2,
        vote_average: testMediaItem2.vote_average.toString(),
        popularity: testMediaItem2.popularity.toString()
      })
      .returning()
      .execute();

    const mediaId1 = mediaResult1[0].id;
    const mediaId2 = mediaResult2[0].id;

    // Add items to watchlist
    await db.insert(watchlistTable)
      .values([
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaId1
        },
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaId2
        }
      ])
      .execute();

    const input: WatchlistInput = {
      user_id: userId,
      media_item_id: mediaId1 // This field is required by schema but not used in handler
    };

    const result = await getWatchlist(input);

    expect(result).toHaveLength(2);
    
    // Basic validation for all items
    result.forEach(item => {
      expect(item.user_id).toBe(userId);
      expect(item.session_id).toBeNull();
      expect(item.media_item).toBeDefined();
      expect(typeof item.media_item.vote_average).toBe('number');
      expect(typeof item.media_item.popularity).toBe('number');
    });

    // Check that we have both movies (order may vary when inserted together)
    const titles = result.map(item => item.media_item.title).sort();
    expect(titles).toEqual(['Fight Club', 'Forrest Gump']);
    
    // Find specific items and validate their details
    const fightClubItem = result.find(item => item.media_item.title === 'Fight Club')!;
    expect(fightClubItem.media_item.vote_average).toBe(8.8);
    expect(fightClubItem.media_item.popularity).toBe(61.416);
    expect(fightClubItem.media_item.genres).toEqual(['Drama', 'Thriller']);

    const forrestGumpItem = result.find(item => item.media_item.title === 'Forrest Gump')!;
    expect(forrestGumpItem.media_item.vote_average).toBe(8.5);
    expect(forrestGumpItem.media_item.popularity).toBe(45.2);
    expect(forrestGumpItem.media_item.genres).toEqual(['Drama', 'Romance']);
  });

  it('should return watchlist items for guest session', async () => {
    const sessionId = 'guest-session-123';

    // Create media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem1,
        vote_average: testMediaItem1.vote_average.toString(),
        popularity: testMediaItem1.popularity.toString()
      })
      .returning()
      .execute();

    const mediaId = mediaResult[0].id;

    // Add item to watchlist for guest session
    await db.insert(watchlistTable)
      .values({
        user_id: null,
        session_id: sessionId,
        media_item_id: mediaId
      })
      .execute();

    const input: WatchlistInput = {
      session_id: sessionId,
      media_item_id: mediaId
    };

    const result = await getWatchlist(input);

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBeNull();
    expect(result[0].session_id).toBe(sessionId);
    expect(result[0].media_item.title).toBe('Fight Club');
    expect(result[0].media_item.tmdb_id).toBe(550);
    expect(result[0].media_item.media_type).toBe('movie');
  });

  it('should handle both user_id and session_id provided', async () => {
    // Create a user
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const sessionId = 'test-session-456';

    // Create media items
    const mediaResult1 = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem1,
        vote_average: testMediaItem1.vote_average.toString(),
        popularity: testMediaItem1.popularity.toString()
      })
      .returning()
      .execute();

    const mediaResult2 = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem2,
        vote_average: testMediaItem2.vote_average.toString(),
        popularity: testMediaItem2.popularity.toString()
      })
      .returning()
      .execute();

    const mediaId1 = mediaResult1[0].id;
    const mediaId2 = mediaResult2[0].id;

    // Add items to watchlist - one for user, one for session
    await db.insert(watchlistTable)
      .values([
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaId1
        },
        {
          user_id: null,
          session_id: sessionId,
          media_item_id: mediaId2
        },
        {
          user_id: userId,
          session_id: sessionId, // Item that matches both conditions
          media_item_id: mediaId1
        }
      ])
      .execute();

    const input: WatchlistInput = {
      user_id: userId,
      session_id: sessionId,
      media_item_id: mediaId1
    };

    const result = await getWatchlist(input);

    // Should return items that match both conditions (user_id AND session_id)
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe(userId);
    expect(result[0].session_id).toBe(sessionId);
  });

  it('should order results by created_at descending', async () => {
    const sessionId = 'test-session-order';

    // Create media items
    const mediaResult1 = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem1,
        vote_average: testMediaItem1.vote_average.toString(),
        popularity: testMediaItem1.popularity.toString()
      })
      .returning()
      .execute();

    const mediaResult2 = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem2,
        vote_average: testMediaItem2.vote_average.toString(),
        popularity: testMediaItem2.popularity.toString()
      })
      .returning()
      .execute();

    const mediaId1 = mediaResult1[0].id;
    const mediaId2 = mediaResult2[0].id;

    // Add items to watchlist with some delay to ensure different created_at times
    await db.insert(watchlistTable)
      .values({
        user_id: null,
        session_id: sessionId,
        media_item_id: mediaId1
      })
      .execute();

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(watchlistTable)
      .values({
        user_id: null,
        session_id: sessionId,
        media_item_id: mediaId2
      })
      .execute();

    const input: WatchlistInput = {
      session_id: sessionId,
      media_item_id: mediaId1
    };

    const result = await getWatchlist(input);

    expect(result).toHaveLength(2);
    // Most recently added should be first (Forrest Gump)
    expect(result[0].media_item.title).toBe('Forrest Gump');
    expect(result[1].media_item.title).toBe('Fight Club');
    
    // Verify created_at order
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should handle non-existent user gracefully', async () => {
    const input: WatchlistInput = {
      user_id: 99999, // Non-existent user
      media_item_id: 1
    };

    const result = await getWatchlist(input);

    expect(result).toEqual([]);
  });

  it('should validate media item fields are properly converted', async () => {
    const sessionId = 'conversion-test';

    // Create media item with various data types
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        tmdb_id: 12345,
        title: 'Conversion Test Movie',
        media_type: 'tv',
        poster_path: null, // Test nullable field
        backdrop_path: '/backdrop.jpg',
        overview: 'Test overview',
        release_date: null, // Test nullable field
        genres: ['Action', 'Comedy', 'Drama'],
        vote_average: '7.5', // Stored as string
        vote_count: 1000,
        popularity: '123.456', // Stored as string
        adult: true,
        original_language: 'es'
      })
      .returning()
      .execute();

    const mediaId = mediaResult[0].id;

    // Add to watchlist
    await db.insert(watchlistTable)
      .values({
        user_id: null,
        session_id: sessionId,
        media_item_id: mediaId
      })
      .execute();

    const input: WatchlistInput = {
      session_id: sessionId,
      media_item_id: mediaId
    };

    const result = await getWatchlist(input);

    expect(result).toHaveLength(1);
    const item = result[0].media_item;
    
    expect(item.tmdb_id).toBe(12345);
    expect(item.title).toBe('Conversion Test Movie');
    expect(item.media_type).toBe('tv');
    expect(item.poster_path).toBeNull();
    expect(item.backdrop_path).toBe('/backdrop.jpg');
    expect(item.release_date).toBeNull();
    expect(item.genres).toEqual(['Action', 'Comedy', 'Drama']);
    expect(item.vote_average).toBe(7.5);
    expect(typeof item.vote_average).toBe('number');
    expect(item.vote_count).toBe(1000);
    expect(item.popularity).toBe(123.456);
    expect(typeof item.popularity).toBe('number');
    expect(item.adult).toBe(true);
    expect(item.original_language).toBe('es');
    expect(item.created_at).toBeInstanceOf(Date);
    expect(item.updated_at).toBeInstanceOf(Date);
  });
});