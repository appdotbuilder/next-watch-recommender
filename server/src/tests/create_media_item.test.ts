import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mediaItemsTable } from '../db/schema';
import { type CreateMediaItemInput } from '../schema';
import { createMediaItem } from '../handlers/create_media_item';
import { eq } from 'drizzle-orm';

// Test input for a movie
const testMovieInput: CreateMediaItemInput = {
  tmdb_id: 12345,
  title: 'Test Movie',
  media_type: 'movie',
  poster_path: '/test-poster.jpg',
  backdrop_path: '/test-backdrop.jpg',
  overview: 'A test movie for unit testing',
  release_date: '2023-01-15',
  genres: ['Action', 'Adventure'],
  vote_average: 7.5,
  vote_count: 1500,
  popularity: 123.456,
  adult: false,
  original_language: 'en'
};

// Test input for a TV show
const testTvInput: CreateMediaItemInput = {
  tmdb_id: 67890,
  title: 'Test TV Show',
  media_type: 'tv',
  poster_path: null,
  backdrop_path: null,
  overview: 'A test TV show for unit testing',
  release_date: null,
  genres: ['Drama', 'Comedy'],
  vote_average: 8.2,
  vote_count: 2500,
  popularity: 456.789,
  adult: false,
  original_language: 'en'
};

describe('createMediaItem', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new movie media item', async () => {
    const result = await createMediaItem(testMovieInput);

    // Basic field validation
    expect(result.tmdb_id).toEqual(12345);
    expect(result.title).toEqual('Test Movie');
    expect(result.media_type).toEqual('movie');
    expect(result.poster_path).toEqual('/test-poster.jpg');
    expect(result.backdrop_path).toEqual('/test-backdrop.jpg');
    expect(result.overview).toEqual(testMovieInput.overview);
    expect(result.release_date).toEqual('2023-01-15');
    expect(result.genres).toEqual(['Action', 'Adventure']);
    expect(result.vote_average).toEqual(7.5);
    expect(typeof result.vote_average).toEqual('number');
    expect(result.vote_count).toEqual(1500);
    expect(result.popularity).toEqual(123.456);
    expect(typeof result.popularity).toEqual('number');
    expect(result.adult).toEqual(false);
    expect(result.original_language).toEqual('en');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a new TV show media item with nullable fields', async () => {
    const result = await createMediaItem(testTvInput);

    // Basic field validation including nullable fields
    expect(result.tmdb_id).toEqual(67890);
    expect(result.title).toEqual('Test TV Show');
    expect(result.media_type).toEqual('tv');
    expect(result.poster_path).toBeNull();
    expect(result.backdrop_path).toBeNull();
    expect(result.overview).toEqual(testTvInput.overview);
    expect(result.release_date).toBeNull();
    expect(result.genres).toEqual(['Drama', 'Comedy']);
    expect(result.vote_average).toEqual(8.2);
    expect(typeof result.vote_average).toEqual('number');
    expect(result.vote_count).toEqual(2500);
    expect(result.popularity).toEqual(456.789);
    expect(typeof result.popularity).toEqual('number');
    expect(result.adult).toEqual(false);
    expect(result.original_language).toEqual('en');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save media item to database', async () => {
    const result = await createMediaItem(testMovieInput);

    // Query the database to verify the item was saved
    const mediaItems = await db.select()
      .from(mediaItemsTable)
      .where(eq(mediaItemsTable.id, result.id))
      .execute();

    expect(mediaItems).toHaveLength(1);
    const savedItem = mediaItems[0];
    
    expect(savedItem.tmdb_id).toEqual(12345);
    expect(savedItem.title).toEqual('Test Movie');
    expect(savedItem.media_type).toEqual('movie');
    expect(savedItem.poster_path).toEqual('/test-poster.jpg');
    expect(savedItem.overview).toEqual(testMovieInput.overview);
    expect(savedItem.genres).toEqual(['Action', 'Adventure']);
    expect(parseFloat(savedItem.vote_average)).toEqual(7.5);
    expect(savedItem.vote_count).toEqual(1500);
    expect(parseFloat(savedItem.popularity)).toEqual(123.456);
    expect(savedItem.adult).toEqual(false);
    expect(savedItem.created_at).toBeInstanceOf(Date);
  });

  it('should update existing media item when tmdb_id already exists (upsert behavior)', async () => {
    // First, create a media item
    const firstResult = await createMediaItem(testMovieInput);
    const originalCreatedAt = firstResult.created_at;

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create another item with the same tmdb_id but different data
    const updatedInput: CreateMediaItemInput = {
      ...testMovieInput,
      title: 'Updated Test Movie',
      vote_average: 8.0,
      popularity: 999.999,
      overview: 'Updated overview for the test movie'
    };

    const secondResult = await createMediaItem(updatedInput);

    // Should have the same ID (updated, not created new)
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.tmdb_id).toEqual(firstResult.tmdb_id);

    // Should have updated fields
    expect(secondResult.title).toEqual('Updated Test Movie');
    expect(secondResult.vote_average).toEqual(8.0);
    expect(secondResult.popularity).toEqual(999.999);
    expect(secondResult.overview).toEqual('Updated overview for the test movie');

    // created_at should remain the same, updated_at should be different
    expect(secondResult.created_at).toEqual(originalCreatedAt);
    expect(secondResult.updated_at.getTime()).toBeGreaterThan(originalCreatedAt.getTime());

    // Verify only one record exists in database
    const allItems = await db.select()
      .from(mediaItemsTable)
      .where(eq(mediaItemsTable.tmdb_id, testMovieInput.tmdb_id))
      .execute();

    expect(allItems).toHaveLength(1);
    expect(allItems[0].title).toEqual('Updated Test Movie');
  });

  it('should handle different media types correctly', async () => {
    // Create both movie and TV show
    const movieResult = await createMediaItem(testMovieInput);
    const tvResult = await createMediaItem(testTvInput);

    expect(movieResult.media_type).toEqual('movie');
    expect(tvResult.media_type).toEqual('tv');

    // Both should be saved to database
    const allItems = await db.select()
      .from(mediaItemsTable)
      .execute();

    expect(allItems).toHaveLength(2);
    
    const savedMovie = allItems.find(item => item.media_type === 'movie');
    const savedTv = allItems.find(item => item.media_type === 'tv');
    
    expect(savedMovie).toBeDefined();
    expect(savedTv).toBeDefined();
    expect(savedMovie!.tmdb_id).toEqual(12345);
    expect(savedTv!.tmdb_id).toEqual(67890);
  });

  it('should handle numeric precision correctly', async () => {
    const precisionInput: CreateMediaItemInput = {
      ...testMovieInput,
      vote_average: 9.8, // Should be stored with 1 decimal place (schema constraint)
      popularity: 12345.678 // Should be stored with 3 decimal places (schema constraint)
    };

    const result = await createMediaItem(precisionInput);

    // Check returned values match schema precision constraints
    // vote_average: numeric(3,1) - only 1 decimal place
    expect(result.vote_average).toEqual(9.8);
    expect(typeof result.vote_average).toEqual('number');
    
    // popularity: numeric(10,3) - up to 3 decimal places
    expect(result.popularity).toEqual(12345.678);
    expect(typeof result.popularity).toEqual('number');

    // Verify in database
    const savedItems = await db.select()
      .from(mediaItemsTable)
      .where(eq(mediaItemsTable.id, result.id))
      .execute();

    const savedItem = savedItems[0];
    expect(parseFloat(savedItem.vote_average)).toEqual(9.8);
    expect(parseFloat(savedItem.popularity)).toEqual(12345.678);
  });

  it('should preserve array data for genres', async () => {
    const genresInput: CreateMediaItemInput = {
      ...testMovieInput,
      genres: ['Action', 'Adventure', 'Sci-Fi', 'Thriller']
    };

    const result = await createMediaItem(genresInput);

    expect(result.genres).toEqual(['Action', 'Adventure', 'Sci-Fi', 'Thriller']);
    expect(Array.isArray(result.genres)).toBe(true);

    // Verify in database
    const savedItems = await db.select()
      .from(mediaItemsTable)
      .where(eq(mediaItemsTable.id, result.id))
      .execute();

    const savedItem = savedItems[0];
    expect(savedItem.genres).toEqual(['Action', 'Adventure', 'Sci-Fi', 'Thriller']);
    expect(Array.isArray(savedItem.genres)).toBe(true);
  });
});