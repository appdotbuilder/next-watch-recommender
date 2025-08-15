import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mediaItemsTable } from '../db/schema';
import { type SearchInput } from '../schema';
import { searchMedia } from '../handlers/search_media';
import { eq } from 'drizzle-orm';

// Mock fetch for TMDB API calls
const mockFetch = mock(() => Promise.resolve(new Response()));
(global as any).fetch = mockFetch;

// Mock TMDB API response
const mockTMDBResponse = {
  page: 1,
  total_pages: 1,
  total_results: 2,
  results: [
    {
      id: 12345,
      title: 'Test Movie',
      media_type: 'movie',
      poster_path: '/poster123.jpg',
      backdrop_path: '/backdrop123.jpg',
      overview: 'A test movie for unit testing',
      release_date: '2023-01-15',
      genre_ids: [28, 35], // Action, Comedy
      vote_average: 7.5,
      vote_count: 1000,
      popularity: 45.678,
      adult: false,
      original_language: 'en'
    },
    {
      id: 67890,
      name: 'Test TV Show',
      media_type: 'tv',
      poster_path: null,
      backdrop_path: '/backdrop456.jpg',
      overview: 'A test TV show for unit testing',
      first_air_date: '2023-03-20',
      genre_ids: [18, 9648], // Drama, Mystery
      vote_average: 8.2,
      vote_count: 500,
      popularity: 32.123,
      adult: false,
      original_language: 'en'
    }
  ]
};

const testSearchInput: SearchInput = {
  query: 'test',
  media_type: 'all',
  page: 1
};

describe('searchMedia', () => {
  beforeEach(async () => {
    await createDB();
    // Set mock API key
    process.env['TMDB_API_KEY'] = 'test_api_key_123';
    mockFetch.mockClear();
  });
  
  afterEach(async () => {
    await resetDB();
    delete process.env['TMDB_API_KEY'];
  });

  it('should search TMDB API and store results when no existing data', async () => {
    // Mock successful TMDB API response
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTMDBResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const results = await searchMedia(testSearchInput);

    // Verify API was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.themoviedb.org/3/search/multi')
    );

    // Verify results structure
    expect(results).toHaveLength(2);
    
    // Check movie result
    const movie = results.find(r => r.media_type === 'movie');
    expect(movie).toBeDefined();
    expect(movie?.title).toEqual('Test Movie');
    expect(movie?.tmdb_id).toEqual(12345);
    expect(movie?.overview).toEqual('A test movie for unit testing');
    expect(movie?.release_date).toEqual('2023-01-15');
    expect(movie?.genres).toEqual(['Action', 'Comedy']);
    expect(movie?.vote_average).toEqual(7.5);
    expect(typeof movie?.vote_average).toEqual('number');
    expect(movie?.popularity).toEqual(45.678);
    expect(typeof movie?.popularity).toEqual('number');

    // Check TV show result
    const tvShow = results.find(r => r.media_type === 'tv');
    expect(tvShow).toBeDefined();
    expect(tvShow?.title).toEqual('Test TV Show');
    expect(tvShow?.tmdb_id).toEqual(67890);
    expect(tvShow?.poster_path).toBeNull();
    expect(tvShow?.release_date).toEqual('2023-03-20');
    expect(tvShow?.genres).toEqual(['Drama', 'Mystery']);
  });

  it('should store results in database correctly', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTMDBResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await searchMedia(testSearchInput);

    // Verify items were stored in database
    const storedItems = await db.select()
      .from(mediaItemsTable)
      .execute();

    expect(storedItems).toHaveLength(2);
    
    const movie = storedItems.find(item => item.tmdb_id === 12345);
    expect(movie).toBeDefined();
    expect(movie?.title).toEqual('Test Movie');
    expect(movie?.media_type).toEqual('movie');
    expect(movie?.vote_average).toEqual('7.5'); // Stored as string in DB
    expect(movie?.popularity).toEqual('45.678'); // Stored as string in DB
    expect(movie?.genres).toEqual(['Action', 'Comedy']);
  });

  it('should return existing results from database without API call', async () => {
    // First, insert test data directly into database
    await db.insert(mediaItemsTable).values({
      tmdb_id: 11111,
      title: 'Existing Movie',
      media_type: 'movie',
      poster_path: '/existing.jpg',
      backdrop_path: null,
      overview: 'An existing movie in database',
      release_date: '2022-12-01',
      genres: ['Action'],
      vote_average: '6.8',
      vote_count: 750,
      popularity: '25.5',
      adult: false,
      original_language: 'en'
    }).execute();

    const results = await searchMedia({
      query: 'Existing',
      media_type: 'all',
      page: 1
    });

    // Verify no API call was made
    expect(mockFetch).not.toHaveBeenCalled();

    // Verify results from database
    expect(results).toHaveLength(1);
    expect(results[0].title).toEqual('Existing Movie');
    expect(results[0].tmdb_id).toEqual(11111);
    expect(results[0].vote_average).toEqual(6.8); // Converted back to number
    expect(typeof results[0].vote_average).toEqual('number');
    expect(results[0].popularity).toEqual(25.5);
    expect(typeof results[0].popularity).toEqual('number');
  });

  it('should filter by media type correctly', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTMDBResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await searchMedia({
      query: 'test',
      media_type: 'movie',
      page: 1
    });

    // Verify correct API endpoint was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.themoviedb.org/3/search/movie')
    );
  });

  it('should handle pagination correctly', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTMDBResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await searchMedia({
      query: 'test',
      media_type: 'all',
      page: 2
    });

    // Verify page parameter in API call
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('page=2')
    );
  });

  it('should handle duplicate items gracefully', async () => {
    // First call
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTMDBResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const firstResults = await searchMedia(testSearchInput);
    expect(firstResults).toHaveLength(2);

    // Second call with same data
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTMDBResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const secondResults = await searchMedia({
      query: 'different query',
      media_type: 'all',
      page: 1
    });

    // Should still return results without duplicating in database
    expect(secondResults).toHaveLength(2);
    
    // Verify only 2 items in database (no duplicates)
    const allItems = await db.select().from(mediaItemsTable).execute();
    expect(allItems).toHaveLength(2);
  });

  it('should throw error when TMDB API key is missing', async () => {
    delete process.env['TMDB_API_KEY'];

    await expect(searchMedia(testSearchInput)).rejects.toThrow(/TMDB_API_KEY environment variable is required/i);
  });

  it('should throw error when TMDB API returns error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Unauthorized', {
        status: 401,
        statusText: 'Unauthorized'
      })
    );

    await expect(searchMedia(testSearchInput)).rejects.toThrow(/TMDB API error: 401 Unauthorized/i);
  });

  it('should handle empty search results', async () => {
    const emptyResponse = {
      page: 1,
      total_pages: 0,
      total_results: 0,
      results: []
    };
    
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(emptyResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const results = await searchMedia(testSearchInput);
    expect(results).toHaveLength(0);
  });

  it('should filter out person results from multi search', async () => {
    const mixedResponse = {
      page: 1,
      total_pages: 1,
      total_results: 3,
      results: [
        {
          id: 1,
          name: 'Actor Name',
          media_type: 'person',
          profile_path: '/actor.jpg'
        },
        {
          id: 2,
          title: 'Valid Movie',
          media_type: 'movie',
          overview: 'A valid movie',
          vote_average: 7.0,
          vote_count: 100,
          popularity: 20.0,
          adult: false,
          original_language: 'en',
          genre_ids: []
        }
      ]
    };
    
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mixedResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const results = await searchMedia(testSearchInput);
    
    // Should only return the movie, person should be filtered out
    expect(results).toHaveLength(1);
    expect(results[0].title).toEqual('Valid Movie');
  });
});