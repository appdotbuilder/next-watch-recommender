import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mediaItemsTable } from '../db/schema';
import { type CreateMediaItemInput } from '../schema';
import { getMediaItemByTmdbId } from '../handlers/get_media_item_by_tmdb_id';

// Test data for media items
const testMovie: CreateMediaItemInput = {
  tmdb_id: 550,
  title: 'Fight Club',
  media_type: 'movie',
  poster_path: '/fight-club-poster.jpg',
  backdrop_path: '/fight-club-backdrop.jpg',
  overview: 'An insomniac office worker and a devil-may-care soapmaker form an underground fight club.',
  release_date: '1999-10-15',
  genres: ['Drama', 'Thriller'],
  vote_average: 8.4,
  vote_count: 26280,
  popularity: 61.416,
  adult: false,
  original_language: 'en'
};

const testTVShow: CreateMediaItemInput = {
  tmdb_id: 1399,
  title: 'Game of Thrones',
  media_type: 'tv',
  poster_path: '/got-poster.jpg',
  backdrop_path: '/got-backdrop.jpg',
  overview: 'Seven noble families fight for control of the mythical land of Westeros.',
  release_date: '2011-04-17',
  genres: ['Drama', 'Action & Adventure', 'Sci-Fi & Fantasy'],
  vote_average: 9.3,
  vote_count: 11504,
  popularity: 369.594,
  adult: false,
  original_language: 'en'
};

describe('getMediaItemByTmdbId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when media item does not exist', async () => {
    const result = await getMediaItemByTmdbId(999999);
    expect(result).toBeNull();
  });

  it('should return media item when it exists', async () => {
    // Create test media item
    await db.insert(mediaItemsTable)
      .values({
        tmdb_id: testMovie.tmdb_id,
        title: testMovie.title,
        media_type: testMovie.media_type,
        poster_path: testMovie.poster_path,
        backdrop_path: testMovie.backdrop_path,
        overview: testMovie.overview,
        release_date: testMovie.release_date,
        genres: testMovie.genres,
        vote_average: testMovie.vote_average.toString(),
        vote_count: testMovie.vote_count,
        popularity: testMovie.popularity.toString(),
        adult: testMovie.adult,
        original_language: testMovie.original_language
      })
      .execute();

    const result = await getMediaItemByTmdbId(testMovie.tmdb_id);

    expect(result).not.toBeNull();
    expect(result!.tmdb_id).toEqual(550);
    expect(result!.title).toEqual('Fight Club');
    expect(result!.media_type).toEqual('movie');
    expect(result!.poster_path).toEqual('/fight-club-poster.jpg');
    expect(result!.backdrop_path).toEqual('/fight-club-backdrop.jpg');
    expect(result!.overview).toEqual(testMovie.overview);
    expect(result!.release_date).toEqual('1999-10-15');
    expect(result!.genres).toEqual(['Drama', 'Thriller']);
    expect(result!.vote_average).toEqual(8.4);
    expect(typeof result!.vote_average).toBe('number');
    expect(result!.vote_count).toEqual(26280);
    expect(result!.popularity).toEqual(61.416);
    expect(typeof result!.popularity).toBe('number');
    expect(result!.adult).toEqual(false);
    expect(result!.original_language).toEqual('en');
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should handle TV shows correctly', async () => {
    // Create test TV show
    await db.insert(mediaItemsTable)
      .values({
        tmdb_id: testTVShow.tmdb_id,
        title: testTVShow.title,
        media_type: testTVShow.media_type,
        poster_path: testTVShow.poster_path,
        backdrop_path: testTVShow.backdrop_path,
        overview: testTVShow.overview,
        release_date: testTVShow.release_date,
        genres: testTVShow.genres,
        vote_average: testTVShow.vote_average.toString(),
        vote_count: testTVShow.vote_count,
        popularity: testTVShow.popularity.toString(),
        adult: testTVShow.adult,
        original_language: testTVShow.original_language
      })
      .execute();

    const result = await getMediaItemByTmdbId(testTVShow.tmdb_id);

    expect(result).not.toBeNull();
    expect(result!.tmdb_id).toEqual(1399);
    expect(result!.title).toEqual('Game of Thrones');
    expect(result!.media_type).toEqual('tv');
    expect(result!.genres).toEqual(['Drama', 'Action & Adventure', 'Sci-Fi & Fantasy']);
    expect(result!.vote_average).toEqual(9.3);
    expect(typeof result!.vote_average).toBe('number');
    expect(result!.popularity).toEqual(369.594);
    expect(typeof result!.popularity).toBe('number');
  });

  it('should handle media items with null paths', async () => {
    const mediaWithNullPaths: CreateMediaItemInput = {
      ...testMovie,
      tmdb_id: 12345,
      poster_path: null,
      backdrop_path: null,
      release_date: null
    };

    await db.insert(mediaItemsTable)
      .values({
        tmdb_id: mediaWithNullPaths.tmdb_id,
        title: mediaWithNullPaths.title,
        media_type: mediaWithNullPaths.media_type,
        poster_path: mediaWithNullPaths.poster_path,
        backdrop_path: mediaWithNullPaths.backdrop_path,
        overview: mediaWithNullPaths.overview,
        release_date: mediaWithNullPaths.release_date,
        genres: mediaWithNullPaths.genres,
        vote_average: mediaWithNullPaths.vote_average.toString(),
        vote_count: mediaWithNullPaths.vote_count,
        popularity: mediaWithNullPaths.popularity.toString(),
        adult: mediaWithNullPaths.adult,
        original_language: mediaWithNullPaths.original_language
      })
      .execute();

    const result = await getMediaItemByTmdbId(mediaWithNullPaths.tmdb_id);

    expect(result).not.toBeNull();
    expect(result!.poster_path).toBeNull();
    expect(result!.backdrop_path).toBeNull();
    expect(result!.release_date).toBeNull();
  });

  it('should handle different TMDB IDs correctly', async () => {
    // Create multiple media items with different TMDB IDs
    await db.insert(mediaItemsTable)
      .values([
        {
          tmdb_id: 100,
          title: 'Movie 1',
          media_type: 'movie',
          poster_path: null,
          backdrop_path: null,
          overview: 'Overview 1',
          release_date: null,
          genres: ['Action'],
          vote_average: '7.0',
          vote_count: 1000,
          popularity: '50.0',
          adult: false,
          original_language: 'en'
        },
        {
          tmdb_id: 200,
          title: 'Movie 2',
          media_type: 'movie',
          poster_path: null,
          backdrop_path: null,
          overview: 'Overview 2',
          release_date: null,
          genres: ['Comedy'],
          vote_average: '8.0',
          vote_count: 2000,
          popularity: '60.0',
          adult: false,
          original_language: 'en'
        }
      ])
      .execute();

    // Test fetching specific items
    const result1 = await getMediaItemByTmdbId(100);
    expect(result1).not.toBeNull();
    expect(result1!.title).toEqual('Movie 1');
    expect(result1!.tmdb_id).toEqual(100);

    const result2 = await getMediaItemByTmdbId(200);
    expect(result2).not.toBeNull();
    expect(result2!.title).toEqual('Movie 2');
    expect(result2!.tmdb_id).toEqual(200);

    // Test non-existent ID
    const result3 = await getMediaItemByTmdbId(300);
    expect(result3).toBeNull();
  });

  it('should handle numeric field conversion correctly', async () => {
    // Create item with specific numeric values
    await db.insert(mediaItemsTable)
      .values({
        tmdb_id: 777,
        title: 'Numeric Test Movie',
        media_type: 'movie',
        poster_path: null,
        backdrop_path: null,
        overview: 'Testing numeric conversions',
        release_date: null,
        genres: ['Test'],
        vote_average: '8.5',
        vote_count: 12345,
        popularity: '123.45',
        adult: false,
        original_language: 'en'
      })
      .execute();

    const result = await getMediaItemByTmdbId(777);

    expect(result).not.toBeNull();
    expect(result!.vote_average).toEqual(8.5);
    expect(typeof result!.vote_average).toBe('number');
    expect(result!.popularity).toEqual(123.45);
    expect(typeof result!.popularity).toBe('number');
    expect(result!.vote_count).toEqual(12345);
    expect(typeof result!.vote_count).toBe('number');
  });
});