import { db } from '../db';
import { mediaItemsTable } from '../db/schema';
import { type MediaItem } from '../schema';
import { eq } from 'drizzle-orm';

export const getMediaItemByTmdbId = async (tmdbId: number): Promise<MediaItem | null> => {
  try {
    const result = await db.select()
      .from(mediaItemsTable)
      .where(eq(mediaItemsTable.tmdb_id, tmdbId))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers before returning
    const mediaItem = result[0];
    return {
      ...mediaItem,
      vote_average: parseFloat(mediaItem.vote_average),
      popularity: parseFloat(mediaItem.popularity)
    };
  } catch (error) {
    console.error('Failed to fetch media item by TMDB ID:', error);
    throw error;
  }
};