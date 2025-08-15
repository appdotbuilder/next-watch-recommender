import { db } from '../db';
import { mediaItemsTable } from '../db/schema';
import { type PopularItemsInput, type MediaItem } from '../schema';
import { eq, desc, or, and } from 'drizzle-orm';

export async function getPopularItems(input: PopularItemsInput): Promise<MediaItem[]> {
  try {
    // Since this is supposed to fetch from TMDB API and cache in database,
    // but we don't have TMDB API integration in this environment,
    // we'll simulate by returning popular items from our database
    // ordered by popularity score, vote_average, and vote_count
    
    const limit = 20; // Items per page
    const offset = (input.page - 1) * limit;
    
    // Build query with conditional where clause
    const baseQuery = db.select().from(mediaItemsTable);
    
    const query = input.media_type !== 'all'
      ? baseQuery.where(eq(mediaItemsTable.media_type, input.media_type))
      : baseQuery;
    
    // Apply ordering and pagination
    const results = await query
      .orderBy(
        desc(mediaItemsTable.popularity),
        desc(mediaItemsTable.vote_average), 
        desc(mediaItemsTable.vote_count)
      )
      .limit(limit)
      .offset(offset)
      .execute();
    
    // Convert numeric fields back to numbers for the response
    return results.map(item => ({
      ...item,
      vote_average: parseFloat(item.vote_average),
      popularity: parseFloat(item.popularity)
    }));
    
  } catch (error) {
    console.error('Failed to get popular items:', error);
    throw error;
  }
}