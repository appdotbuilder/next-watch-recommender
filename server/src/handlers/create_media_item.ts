import { db } from '../db';
import { mediaItemsTable } from '../db/schema';
import { type CreateMediaItemInput, type MediaItem } from '../schema';
import { eq } from 'drizzle-orm';

export const createMediaItem = async (input: CreateMediaItemInput): Promise<MediaItem> => {
  try {
    // Check if media item with this tmdb_id already exists
    const existingItems = await db.select()
      .from(mediaItemsTable)
      .where(eq(mediaItemsTable.tmdb_id, input.tmdb_id))
      .execute();

    if (existingItems.length > 0) {
      // Update existing item (upsert behavior)
      const result = await db.update(mediaItemsTable)
        .set({
          title: input.title,
          media_type: input.media_type,
          poster_path: input.poster_path,
          backdrop_path: input.backdrop_path,
          overview: input.overview,
          release_date: input.release_date,
          genres: input.genres,
          vote_average: input.vote_average.toString(), // Convert to string for numeric column
          vote_count: input.vote_count,
          popularity: input.popularity.toString(), // Convert to string for numeric column
          adult: input.adult,
          original_language: input.original_language,
          updated_at: new Date()
        })
        .where(eq(mediaItemsTable.tmdb_id, input.tmdb_id))
        .returning()
        .execute();

      // Convert numeric fields back to numbers before returning
      const mediaItem = result[0];
      return {
        ...mediaItem,
        vote_average: parseFloat(mediaItem.vote_average),
        popularity: parseFloat(mediaItem.popularity)
      };
    } else {
      // Insert new media item
      const result = await db.insert(mediaItemsTable)
        .values({
          tmdb_id: input.tmdb_id,
          title: input.title,
          media_type: input.media_type,
          poster_path: input.poster_path,
          backdrop_path: input.backdrop_path,
          overview: input.overview,
          release_date: input.release_date,
          genres: input.genres,
          vote_average: input.vote_average.toString(), // Convert to string for numeric column
          vote_count: input.vote_count,
          popularity: input.popularity.toString(), // Convert to string for numeric column
          adult: input.adult,
          original_language: input.original_language
        })
        .returning()
        .execute();

      // Convert numeric fields back to numbers before returning
      const mediaItem = result[0];
      return {
        ...mediaItem,
        vote_average: parseFloat(mediaItem.vote_average),
        popularity: parseFloat(mediaItem.popularity)
      };
    }
  } catch (error) {
    console.error('Media item creation/update failed:', error);
    throw error;
  }
};