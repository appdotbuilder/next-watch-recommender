import { db } from '../db';
import { watchlistTable, mediaItemsTable } from '../db/schema';
import { type WatchlistInput, type Watchlist, type MediaItem } from '../schema';

// Extended type to include media item details for display
export type WatchlistWithMedia = Watchlist & {
  media_item: MediaItem;
};
import { eq, and, desc } from 'drizzle-orm';

export async function getWatchlist(input: WatchlistInput): Promise<WatchlistWithMedia[]> {
  try {
    // Build conditions based on user_id or session_id
    const conditions = [];
    
    if (input.user_id !== undefined) {
      conditions.push(eq(watchlistTable.user_id, input.user_id));
    }
    
    if (input.session_id !== undefined) {
      conditions.push(eq(watchlistTable.session_id, input.session_id));
    }

    // If no user_id or session_id provided, return empty array
    if (conditions.length === 0) {
      return [];
    }

    // Query watchlist items with media details
    const results = await db.select()
      .from(watchlistTable)
      .innerJoin(mediaItemsTable, eq(watchlistTable.media_item_id, mediaItemsTable.id))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(watchlistTable.created_at))
      .execute();

    // Transform results to include media details and handle numeric conversions
    return results.map(result => ({
      id: result.watchlist.id,
      user_id: result.watchlist.user_id,
      session_id: result.watchlist.session_id,
      media_item_id: result.watchlist.media_item_id,
      created_at: result.watchlist.created_at,
      // Include media item details for display
      media_item: {
        id: result.media_items.id,
        tmdb_id: result.media_items.tmdb_id,
        title: result.media_items.title,
        media_type: result.media_items.media_type,
        poster_path: result.media_items.poster_path,
        backdrop_path: result.media_items.backdrop_path,
        overview: result.media_items.overview,
        release_date: result.media_items.release_date,
        genres: result.media_items.genres,
        vote_average: parseFloat(result.media_items.vote_average), // Convert numeric to number
        vote_count: result.media_items.vote_count,
        popularity: parseFloat(result.media_items.popularity), // Convert numeric to number
        adult: result.media_items.adult,
        original_language: result.media_items.original_language,
        created_at: result.media_items.created_at,
        updated_at: result.media_items.updated_at
      }
    }));
  } catch (error) {
    console.error('Get watchlist failed:', error);
    throw error;
  }
}