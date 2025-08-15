import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { userProfilesTable, mediaItemsTable, recommendationsTable } from '../db/schema';
import { type GetRecommendationsInput, type CreateUserProfileInput, type CreateMediaItemInput } from '../schema';
import { getNextRecommendation } from '../handlers/get_next_recommendation';
import { eq } from 'drizzle-orm';

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
  release_date: '2024-01-01',
  genres: ['Action', 'Adventure'],
  vote_average: 8.5,
  vote_count: 1000,
  popularity: 85.5,
  adult: false,
  original_language: 'en'
};

const testMediaItem2: CreateMediaItemInput = {
  tmdb_id: 67890,
  title: 'Another Test Movie',
  media_type: 'tv',
  poster_path: '/test-poster2.jpg',
  backdrop_path: '/test-backdrop2.jpg',
  overview: 'Another test movie',
  release_date: '2024-02-01',
  genres: ['Drama', 'Comedy'],
  vote_average: 7.2,
  vote_count: 500,
  popularity: 72.3,
  adult: false,
  original_language: 'en'
};

describe('getNextRecommendation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return the highest-scored unshown recommendation for a user', async () => {
    // Create test user
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create test media items
    const mediaResult1 = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
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

    // Create recommendations with different scores
    await db.insert(recommendationsTable)
      .values([
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaId1,
          reason: 'Because you like action movies',
          score: '0.8500',
          shown: false
        },
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaId2,
          reason: 'Because you enjoy drama series',
          score: '0.9200', // Higher score
          shown: false
        }
      ])
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 10
    };

    const result = await getNextRecommendation(input);

    expect(result).not.toBeNull();
    expect(result!.user_id).toEqual(userId);
    expect(result!.media_item_id).toEqual(mediaId2); // Should get the higher-scored one
    expect(result!.reason).toEqual('Because you enjoy drama series');
    expect(result!.score).toEqual(0.92);
    expect(typeof result!.score).toBe('number');
    expect(result!.shown).toBe(false); // Original value before marking as shown
  });

  it('should mark the returned recommendation as shown', async () => {
    // Create test user and media item
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
      })
      .returning()
      .execute();

    const mediaId = mediaResult[0].id;

    // Create recommendation
    const recResult = await db.insert(recommendationsTable)
      .values({
        user_id: userId,
        session_id: null,
        media_item_id: mediaId,
        reason: 'Test recommendation',
        score: '0.8000',
        shown: false
      })
      .returning()
      .execute();

    const recId = recResult[0].id;

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 10
    };

    await getNextRecommendation(input);

    // Verify recommendation was marked as shown
    const updatedRec = await db.select()
      .from(recommendationsTable)
      .where(eq(recommendationsTable.id, recId))
      .execute();

    expect(updatedRec).toHaveLength(1);
    expect(updatedRec[0].shown).toBe(true);
  });

  it('should return null when no unshown recommendations exist', async () => {
    // Create test user
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
      })
      .returning()
      .execute();

    const mediaId = mediaResult[0].id;

    // Create recommendation that's already shown
    await db.insert(recommendationsTable)
      .values({
        user_id: userId,
        session_id: null,
        media_item_id: mediaId,
        reason: 'Already shown recommendation',
        score: '0.8000',
        shown: true // Already shown
      })
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 10
    };

    const result = await getNextRecommendation(input);

    expect(result).toBeNull();
  });

  it('should work with session_id for guest users', async () => {
    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
      })
      .returning()
      .execute();

    const mediaId = mediaResult[0].id;

    const sessionId = 'guest_session_12345';

    // Create recommendation for session
    await db.insert(recommendationsTable)
      .values({
        user_id: null,
        session_id: sessionId,
        media_item_id: mediaId,
        reason: 'Popular movie recommendation',
        score: '0.7500',
        shown: false
      })
      .execute();

    const input: GetRecommendationsInput = {
      session_id: sessionId,
      limit: 10
    };

    const result = await getNextRecommendation(input);

    expect(result).not.toBeNull();
    expect(result!.session_id).toEqual(sessionId);
    expect(result!.user_id).toBeNull();
    expect(result!.reason).toEqual('Popular movie recommendation');
    expect(result!.score).toEqual(0.75);
  });

  it('should return null when no user_id or session_id provided and no null recommendations exist', async () => {
    // Create test media item
    const mediaResult = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
      })
      .returning()
      .execute();

    const mediaId = mediaResult[0].id;

    // Create recommendation for a specific session (not null)
    await db.insert(recommendationsTable)
      .values({
        user_id: null,
        session_id: 'some_session',
        media_item_id: mediaId,
        reason: 'Session-specific recommendation',
        score: '0.7500',
        shown: false
      })
      .execute();

    const input: GetRecommendationsInput = {
      limit: 10
    };

    const result = await getNextRecommendation(input);

    expect(result).toBeNull();
  });

  it('should return recommendations sorted by score in descending order', async () => {
    // Create test user
    const userResult = await db.insert(userProfilesTable)
      .values({
        username: testUser.username,
        email: testUser.email
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create multiple media items
    const mediaResult1 = await db.insert(mediaItemsTable)
      .values({
        ...testMediaItem,
        vote_average: testMediaItem.vote_average.toString(),
        popularity: testMediaItem.popularity.toString()
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

    // Create recommendations with different scores (inserted in non-score order)
    await db.insert(recommendationsTable)
      .values([
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaId1,
          reason: 'Lower scored recommendation',
          score: '0.6000',
          shown: false
        },
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaId2,
          reason: 'Higher scored recommendation',
          score: '0.9500',
          shown: false
        }
      ])
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 10
    };

    // First call should return highest scored
    const firstResult = await getNextRecommendation(input);
    expect(firstResult).not.toBeNull();
    expect(firstResult!.score).toEqual(0.95);
    expect(firstResult!.reason).toEqual('Higher scored recommendation');

    // Second call should return lower scored
    const secondResult = await getNextRecommendation(input);
    expect(secondResult).not.toBeNull();
    expect(secondResult!.score).toEqual(0.6);
    expect(secondResult!.reason).toEqual('Lower scored recommendation');

    // Third call should return null
    const thirdResult = await getNextRecommendation(input);
    expect(thirdResult).toBeNull();
  });
});