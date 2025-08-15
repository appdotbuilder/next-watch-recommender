import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { userProfilesTable, mediaItemsTable, userInteractionsTable, recommendationsTable } from '../db/schema';
import { type GetRecommendationsInput } from '../schema';
import { generateRecommendations } from '../handlers/generate_recommendations';
import { eq, and } from 'drizzle-orm';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com'
};

const testMediaItems = [
  {
    tmdb_id: 1,
    title: 'Action Movie 1',
    media_type: 'movie' as const,
    poster_path: '/poster1.jpg',
    backdrop_path: '/backdrop1.jpg',
    overview: 'An action-packed movie',
    release_date: '2023-01-01',
    genres: ['Action', 'Adventure'],
    vote_average: '8.5',
    vote_count: 1000,
    popularity: '85.5',
    adult: false,
    original_language: 'en'
  },
  {
    tmdb_id: 2,
    title: 'Comedy Movie 1',
    media_type: 'movie' as const,
    poster_path: '/poster2.jpg',
    backdrop_path: '/backdrop2.jpg',
    overview: 'A funny comedy',
    release_date: '2023-02-01',
    genres: ['Comedy'],
    vote_average: '7.2',
    vote_count: 800,
    popularity: '65.2',
    adult: false,
    original_language: 'en'
  },
  {
    tmdb_id: 3,
    title: 'Action Movie 2',
    media_type: 'movie' as const,
    poster_path: '/poster3.jpg',
    backdrop_path: '/backdrop3.jpg',
    overview: 'Another action movie',
    release_date: '2023-03-01',
    genres: ['Action', 'Thriller'],
    vote_average: '8.0',
    vote_count: 1200,
    popularity: '90.0',
    adult: false,
    original_language: 'en'
  },
  {
    tmdb_id: 4,
    title: 'Drama TV Show',
    media_type: 'tv' as const,
    poster_path: '/poster4.jpg',
    backdrop_path: '/backdrop4.jpg',
    overview: 'A compelling drama series',
    release_date: '2023-04-01',
    genres: ['Drama'],
    vote_average: '6.5',
    vote_count: 500,
    popularity: '45.0',
    adult: false,
    original_language: 'en'
  },
  {
    tmdb_id: 5,
    title: 'Action TV Show',
    media_type: 'tv' as const,
    poster_path: '/poster5.jpg',
    backdrop_path: '/backdrop5.jpg',
    overview: 'An action TV series',
    release_date: '2023-05-01',
    genres: ['Action', 'Drama'],
    vote_average: '8.8',
    vote_count: 1500,
    popularity: '95.0',
    adult: false,
    original_language: 'en'
  },
  {
    tmdb_id: 6,
    title: 'Sci-Fi Movie',
    media_type: 'movie' as const,
    poster_path: '/poster6.jpg',
    backdrop_path: '/backdrop6.jpg',
    overview: 'A science fiction movie',
    release_date: '2023-06-01',
    genres: ['Science Fiction', 'Adventure'],
    vote_average: '7.8',
    vote_count: 900,
    popularity: '75.0',
    adult: false,
    original_language: 'en'
  },
  {
    tmdb_id: 7,
    title: 'Romantic Comedy',
    media_type: 'movie' as const,
    poster_path: '/poster7.jpg',
    backdrop_path: '/backdrop7.jpg',
    overview: 'A romantic comedy',
    release_date: '2023-07-01',
    genres: ['Romance', 'Comedy'],
    vote_average: '7.0',
    vote_count: 700,
    popularity: '60.0',
    adult: false,
    original_language: 'en'
  }
];

describe('generateRecommendations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should throw error when neither user_id nor session_id provided', async () => {
    const input: GetRecommendationsInput = {
      limit: 5
    };

    await expect(generateRecommendations(input)).rejects.toThrow(/either user_id or session_id must be provided/i);
  });

  it('should generate recommendations for user with no interactions', async () => {
    // Create user
    const userResult = await db.insert(userProfilesTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create media items
    await db.insert(mediaItemsTable)
      .values(testMediaItems)
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 3
    };

    const recommendations = await generateRecommendations(input);

    expect(recommendations).toHaveLength(3);
    recommendations.forEach(rec => {
      expect(rec.user_id).toBe(userId);
      expect(rec.session_id).toBeNull();
      expect(rec.media_item_id).toBeDefined();
      expect(rec.reason).toBeDefined();
      expect(typeof rec.score).toBe('number');
      expect(rec.score).toBeGreaterThan(0);
      expect(rec.score).toBeLessThanOrEqual(1);
      expect(rec.shown).toBe(false);
      expect(rec.created_at).toBeInstanceOf(Date);
    });
  });

  it('should generate recommendations based on user preferences', async () => {
    // Create user
    const userResult = await db.insert(userProfilesTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create media items
    const mediaResult = await db.insert(mediaItemsTable)
      .values(testMediaItems)
      .returning()
      .execute();

    // Create user interactions - user likes action movies
    await db.insert(userInteractionsTable)
      .values([
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaResult[0].id, // Action Movie 1
          interaction_type: 'like'
        },
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaResult[1].id, // Comedy Movie 1
          interaction_type: 'dislike'
        }
      ])
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 2
    };

    const recommendations = await generateRecommendations(input);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(2);
    
    // Should not recommend items user already interacted with
    const recommendedMediaIds = recommendations.map(r => r.media_item_id);
    expect(recommendedMediaIds).not.toContain(mediaResult[0].id);
    expect(recommendedMediaIds).not.toContain(mediaResult[1].id);

    // Check that we have valid recommendations
    if (recommendations.length > 0) {
      const recommendedItems = await db.select()
        .from(mediaItemsTable)
        .where(eq(mediaItemsTable.id, recommendedMediaIds[0]))
        .execute();
      
      expect(recommendedItems.length).toBeGreaterThan(0);
    }
  });

  it('should generate recommendations for guest session', async () => {
    const sessionId = 'guest_session_123';

    // Create media items
    const mediaResult = await db.insert(mediaItemsTable)
      .values(testMediaItems)
      .returning()
      .execute();

    // Create session interactions
    await db.insert(userInteractionsTable)
      .values({
        user_id: null,
        session_id: sessionId,
        media_item_id: mediaResult[0].id,
        interaction_type: 'like'
      })
      .execute();

    const input: GetRecommendationsInput = {
      session_id: sessionId,
      limit: 2
    };

    const recommendations = await generateRecommendations(input);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(2);
    recommendations.forEach(rec => {
      expect(rec.user_id).toBeNull();
      expect(rec.session_id).toBe(sessionId);
      expect(rec.media_item_id).toBeDefined();
    });

    // Should not recommend items user already interacted with
    const recommendedMediaIds = recommendations.map(r => r.media_item_id);
    expect(recommendedMediaIds).not.toContain(mediaResult[0].id);
  });

  it('should respect limit parameter', async () => {
    // Create user
    const userResult = await db.insert(userProfilesTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create media items
    await db.insert(mediaItemsTable)
      .values(testMediaItems)
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 1
    };

    const recommendations = await generateRecommendations(input);

    expect(recommendations).toHaveLength(1);
  });

  it('should save recommendations to database', async () => {
    // Create user
    const userResult = await db.insert(userProfilesTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create media items
    await db.insert(mediaItemsTable)
      .values(testMediaItems)
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 2
    };

    const recommendations = await generateRecommendations(input);

    // Verify recommendations were saved to database
    const savedRecommendations = await db.select()
      .from(recommendationsTable)
      .where(eq(recommendationsTable.user_id, userId))
      .execute();

    expect(savedRecommendations).toHaveLength(2);
    savedRecommendations.forEach(rec => {
      expect(rec.user_id).toBe(userId);
      expect(rec.media_item_id).toBeDefined();
      expect(rec.reason).toBeDefined();
      expect(parseFloat(rec.score)).toBeGreaterThan(0);
      expect(rec.shown).toBe(false);
    });
  });

  it('should generate meaningful reasons based on preferences', async () => {
    // Create user
    const userResult = await db.insert(userProfilesTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create media items
    const mediaResult = await db.insert(mediaItemsTable)
      .values(testMediaItems)
      .returning()
      .execute();

    // Create user interaction - user likes action movie
    await db.insert(userInteractionsTable)
      .values({
        user_id: userId,
        session_id: null,
        media_item_id: mediaResult[0].id, // Action Movie 1
        interaction_type: 'watched_liked'
      })
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 2
    };

    const recommendations = await generateRecommendations(input);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(2);
    
    // At least one recommendation should mention action genre or the liked movie
    const reasons = recommendations.map(r => r.reason.toLowerCase());
    const hasGenreReason = reasons.some(reason => reason.includes('action'));
    const hasMovieReason = reasons.some(reason => reason.includes('action movie 1'));
    
    expect(hasGenreReason || hasMovieReason).toBe(true);
  });

  it('should work with both user_id and session_id provided', async () => {
    // Create user
    const userResult = await db.insert(userProfilesTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const sessionId = 'session_123';

    // Create media items
    const mediaResult = await db.insert(mediaItemsTable)
      .values(testMediaItems)
      .returning()
      .execute();

    // Create interactions for both user_id and session_id
    await db.insert(userInteractionsTable)
      .values([
        {
          user_id: userId,
          session_id: null,
          media_item_id: mediaResult[0].id,
          interaction_type: 'like'
        },
        {
          user_id: null,
          session_id: sessionId,
          media_item_id: mediaResult[1].id,
          interaction_type: 'like'
        }
      ])
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      session_id: sessionId,
      limit: 2
    };

    const recommendations = await generateRecommendations(input);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(2);
    
    // Should not recommend items from either user_id or session_id interactions
    const recommendedMediaIds = recommendations.map(r => r.media_item_id);
    expect(recommendedMediaIds).not.toContain(mediaResult[0].id);
    expect(recommendedMediaIds).not.toContain(mediaResult[1].id);
  });

  it('should handle numeric conversions correctly', async () => {
    // Create user
    const userResult = await db.insert(userProfilesTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create media items
    await db.insert(mediaItemsTable)
      .values(testMediaItems)
      .execute();

    const input: GetRecommendationsInput = {
      user_id: userId,
      limit: 1
    };

    const recommendations = await generateRecommendations(input);

    expect(recommendations).toHaveLength(1);
    
    const recommendation = recommendations[0];
    expect(typeof recommendation.score).toBe('number');
    expect(recommendation.score).toBeGreaterThan(0);
    expect(recommendation.score).toBeLessThanOrEqual(1);
  });
});