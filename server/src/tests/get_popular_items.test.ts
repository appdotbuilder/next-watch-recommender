import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mediaItemsTable } from '../db/schema';
import { type PopularItemsInput, type CreateMediaItemInput } from '../schema';
import { getPopularItems } from '../handlers/get_popular_items';

// Test media items with different popularity scores
const testItems: CreateMediaItemInput[] = [
  {
    tmdb_id: 1,
    title: 'Most Popular Movie',
    media_type: 'movie',
    poster_path: '/poster1.jpg',
    backdrop_path: '/backdrop1.jpg',
    overview: 'A very popular movie',
    release_date: '2024-01-01',
    genres: ['Action', 'Adventure'],
    vote_average: 8.5,
    vote_count: 1000,
    popularity: 95.5,
    adult: false,
    original_language: 'en'
  },
  {
    tmdb_id: 2,
    title: 'Popular TV Show',
    media_type: 'tv',
    poster_path: '/poster2.jpg',
    backdrop_path: '/backdrop2.jpg',
    overview: 'A popular TV series',
    release_date: '2024-02-01',
    genres: ['Drama', 'Thriller'],
    vote_average: 8.0,
    vote_count: 800,
    popularity: 85.3,
    adult: false,
    original_language: 'en'
  },
  {
    tmdb_id: 3,
    title: 'Moderate Movie',
    media_type: 'movie',
    poster_path: '/poster3.jpg',
    backdrop_path: '/backdrop3.jpg',
    overview: 'A moderately popular movie',
    release_date: '2024-03-01',
    genres: ['Comedy'],
    vote_average: 7.5,
    vote_count: 500,
    popularity: 75.1,
    adult: false,
    original_language: 'en'
  },
  {
    tmdb_id: 4,
    title: 'Less Popular TV Show',
    media_type: 'tv',
    poster_path: null,
    backdrop_path: null,
    overview: 'A less popular TV series',
    release_date: null,
    genres: ['Sci-Fi'],
    vote_average: 6.5,
    vote_count: 200,
    popularity: 45.2,
    adult: false,
    original_language: 'en'
  }
];

// Helper to create test media items
const createTestItems = async () => {
  for (const item of testItems) {
    await db.insert(mediaItemsTable)
      .values({
        ...item,
        vote_average: item.vote_average.toString(),
        popularity: item.popularity.toString()
      })
      .execute();
  }
};

describe('getPopularItems', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return popular items ordered by popularity', async () => {
    await createTestItems();

    const input: PopularItemsInput = {
      media_type: 'all',
      page: 1
    };

    const result = await getPopularItems(input);

    expect(result).toHaveLength(4);
    
    // Should be ordered by popularity (descending)
    expect(result[0].title).toEqual('Most Popular Movie');
    expect(result[0].popularity).toEqual(95.5);
    expect(result[1].title).toEqual('Popular TV Show');
    expect(result[1].popularity).toEqual(85.3);
    expect(result[2].title).toEqual('Moderate Movie');
    expect(result[2].popularity).toEqual(75.1);
    expect(result[3].title).toEqual('Less Popular TV Show');
    expect(result[3].popularity).toEqual(45.2);
  });

  it('should filter by media_type when specified', async () => {
    await createTestItems();

    const input: PopularItemsInput = {
      media_type: 'movie',
      page: 1
    };

    const result = await getPopularItems(input);

    expect(result).toHaveLength(2);
    expect(result.every(item => item.media_type === 'movie')).toBe(true);
    
    // Should still be ordered by popularity
    expect(result[0].title).toEqual('Most Popular Movie');
    expect(result[1].title).toEqual('Moderate Movie');
  });

  it('should filter TV shows correctly', async () => {
    await createTestItems();

    const input: PopularItemsInput = {
      media_type: 'tv',
      page: 1
    };

    const result = await getPopularItems(input);

    expect(result).toHaveLength(2);
    expect(result.every(item => item.media_type === 'tv')).toBe(true);
    
    // Should be ordered by popularity
    expect(result[0].title).toEqual('Popular TV Show');
    expect(result[1].title).toEqual('Less Popular TV Show');
  });

  it('should handle pagination correctly', async () => {
    // Create many items to test pagination
    const manyItems = Array.from({ length: 25 }, (_, i) => ({
      tmdb_id: i + 100,
      title: `Movie ${i + 1}`,
      media_type: 'movie' as const,
      poster_path: `/poster${i}.jpg`,
      backdrop_path: `/backdrop${i}.jpg`,
      overview: `Movie ${i + 1} overview`,
      release_date: '2024-01-01',
      genres: ['Action'],
      vote_average: 8.0 - (i * 0.1), // Decreasing vote average
      vote_count: 1000 - (i * 10), // Decreasing vote count
      popularity: 100 - i, // Decreasing popularity for clear ordering
      adult: false,
      original_language: 'en'
    }));

    // Insert all items
    for (const item of manyItems) {
      await db.insert(mediaItemsTable)
        .values({
          ...item,
          vote_average: item.vote_average.toString(),
          popularity: item.popularity.toString()
        })
        .execute();
    }

    // Test first page
    const page1Input: PopularItemsInput = {
      media_type: 'all',
      page: 1
    };

    const page1Result = await getPopularItems(page1Input);
    expect(page1Result).toHaveLength(20); // Default page size
    expect(page1Result[0].title).toEqual('Movie 1'); // Most popular

    // Test second page
    const page2Input: PopularItemsInput = {
      media_type: 'all',
      page: 2
    };

    const page2Result = await getPopularItems(page2Input);
    expect(page2Result).toHaveLength(5); // Remaining items
    expect(page2Result[0].title).toEqual('Movie 21'); // 21st most popular
  });

  it('should return numeric types correctly', async () => {
    await createTestItems();

    const input: PopularItemsInput = {
      media_type: 'all',
      page: 1
    };

    const result = await getPopularItems(input);

    expect(result).toHaveLength(4);
    
    // Verify numeric field types
    result.forEach(item => {
      expect(typeof item.vote_average).toBe('number');
      expect(typeof item.popularity).toBe('number');
      expect(typeof item.vote_count).toBe('number');
      expect(typeof item.id).toBe('number');
      expect(typeof item.tmdb_id).toBe('number');
    });
  });

  it('should return empty array when no items exist', async () => {
    const input: PopularItemsInput = {
      media_type: 'all',
      page: 1
    };

    const result = await getPopularItems(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle page beyond available items', async () => {
    await createTestItems(); // Only 4 items

    const input: PopularItemsInput = {
      media_type: 'all',
      page: 5 // Way beyond available items
    };

    const result = await getPopularItems(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should preserve all MediaItem fields', async () => {
    await createTestItems();

    const input: PopularItemsInput = {
      media_type: 'all',
      page: 1
    };

    const result = await getPopularItems(input);
    const item = result[0];

    // Verify all required fields exist
    expect(item.id).toBeDefined();
    expect(item.tmdb_id).toBeDefined();
    expect(item.title).toBeDefined();
    expect(item.media_type).toBeDefined();
    expect(item.overview).toBeDefined();
    expect(item.genres).toBeDefined();
    expect(item.vote_average).toBeDefined();
    expect(item.vote_count).toBeDefined();
    expect(item.popularity).toBeDefined();
    expect(item.adult).toBeDefined();
    expect(item.original_language).toBeDefined();
    expect(item.created_at).toBeInstanceOf(Date);
    expect(item.updated_at).toBeInstanceOf(Date);

    // Nullable fields should be handled correctly
    expect(['string', 'object']).toContain(typeof item.poster_path); // string or null
    expect(['string', 'object']).toContain(typeof item.backdrop_path); // string or null
    expect(['string', 'object']).toContain(typeof item.release_date); // string or null
  });
});