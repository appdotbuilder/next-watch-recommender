import { db } from '../db';
import { mediaItemsTable } from '../db/schema';
import { type SearchInput, type MediaItem } from '../schema';
import { eq, or, and, ilike, type SQL } from 'drizzle-orm';

// TMDB API types
interface TMDBSearchResult {
  page: number;
  results: TMDBMediaItem[];
  total_pages: number;
  total_results: number;
}

interface TMDBMediaItem {
  id: number;
  title?: string; // for movies
  name?: string; // for TV shows
  media_type?: 'movie' | 'tv' | 'person';
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string; // for movies
  first_air_date?: string; // for TV shows
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  original_language: string;
}

// Genre mapping for TMDB genre IDs to names
const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics'
};

export const searchMedia = async (input: SearchInput): Promise<MediaItem[]> => {
  try {
    const { query, media_type, page } = input;
    
    // First, try to find existing results in our database
    const existingResults = await searchInDatabase(query, media_type, page);
    if (existingResults.length > 0) {
      return existingResults;
    }

    // If no existing results, search TMDB API
    const tmdbResults = await searchTMDBAPI(query, media_type, page);
    
    // Store results in database and return
    const storedResults = await storeMediaItems(tmdbResults);
    
    return storedResults;
  } catch (error) {
    console.error('Media search failed:', error);
    throw error;
  }
};

async function searchInDatabase(searchQuery: string, mediaType: string, page: number): Promise<MediaItem[]> {
  const conditions: SQL<unknown>[] = [];
  
  // Add search query condition
  conditions.push(ilike(mediaItemsTable.title, `%${searchQuery}%`));
  
  // Add media type filter
  if (mediaType !== 'all') {
    conditions.push(eq(mediaItemsTable.media_type, mediaType as 'movie' | 'tv'));
  }

  // Apply pagination (20 items per page to match TMDB)
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build complete query in one statement to avoid type inference issues
  const results = conditions.length > 0
    ? await db.select()
        .from(mediaItemsTable)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .limit(limit)
        .offset(offset)
        .execute()
    : await db.select()
        .from(mediaItemsTable)
        .limit(limit)
        .offset(offset)
        .execute();
  
  // Convert numeric fields back to numbers
  return results.map(item => ({
    ...item,
    vote_average: parseFloat(item.vote_average),
    popularity: parseFloat(item.popularity)
  }));
}

async function searchTMDBAPI(searchQuery: string, mediaType: string, page: number): Promise<TMDBMediaItem[]> {
  const apiKey = process.env['TMDB_API_KEY'];
  if (!apiKey) {
    throw new Error('TMDB_API_KEY environment variable is required');
  }

  let searchUrl: string;
  
  if (mediaType === 'all') {
    // Search both movies and TV shows
    searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&page=${page}`;
  } else {
    // Search specific media type
    searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&page=${page}`;
  }

  const response = await fetch(searchUrl);
  
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as TMDBSearchResult;
  
  // Filter out person results when using multi search and ensure valid content
  return data.results.filter(item => {
    // For multi search, filter out person results
    // For single endpoint searches, media_type is undefined so we include all
    if (item.media_type === 'person') {
      return false;
    }
    
    // Ensure we have essential content
    return (item.title || item.name) && item.overview;
  });
}

async function storeMediaItems(tmdbItems: TMDBMediaItem[]): Promise<MediaItem[]> {
  if (tmdbItems.length === 0) {
    return [];
  }

  const mediaItemsToInsert = tmdbItems.map(item => ({
    tmdb_id: item.id,
    title: item.title || item.name || 'Unknown Title',
    media_type: (item.media_type || (item.title ? 'movie' : 'tv')) as 'movie' | 'tv',
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    overview: item.overview,
    release_date: item.release_date || item.first_air_date || null,
    genres: item.genre_ids.map(id => GENRE_MAP[id] || 'Unknown').filter(Boolean),
    vote_average: item.vote_average.toString(),
    vote_count: item.vote_count,
    popularity: item.popularity.toString(),
    adult: item.adult,
    original_language: item.original_language
  }));

  // Insert items, ignoring duplicates based on tmdb_id
  const results = [];
  
  for (const item of mediaItemsToInsert) {
    try {
      // Check if item already exists
      const existing = await db.select()
        .from(mediaItemsTable)
        .where(eq(mediaItemsTable.tmdb_id, item.tmdb_id))
        .execute();

      if (existing.length > 0) {
        // Return existing item with proper numeric conversion
        results.push({
          ...existing[0],
          vote_average: parseFloat(existing[0].vote_average),
          popularity: parseFloat(existing[0].popularity)
        });
      } else {
        // Insert new item
        const inserted = await db.insert(mediaItemsTable)
          .values(item)
          .returning()
          .execute();

        // Convert numeric fields back to numbers
        results.push({
          ...inserted[0],
          vote_average: parseFloat(inserted[0].vote_average),
          popularity: parseFloat(inserted[0].popularity)
        });
      }
    } catch (error) {
      console.error('Failed to store media item:', item.tmdb_id, error);
      // Continue with other items
    }
  }

  return results;
}