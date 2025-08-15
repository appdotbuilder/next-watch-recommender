import { db } from '../db';
import { watchlistTable } from '../db/schema';
import { type WatchlistInput, type Watchlist } from '../schema';
import { eq, and, or } from 'drizzle-orm';

export const addToWatchlist = async (input: WatchlistInput): Promise<Watchlist> => {
  try {
    // Check if the item is already in the watchlist to prevent duplicates
    const conditions = [
      eq(watchlistTable.media_item_id, input.media_item_id)
    ];

    // Add user/session condition
    if (input.user_id) {
      conditions.push(eq(watchlistTable.user_id, input.user_id));
    } else if (input.session_id) {
      conditions.push(eq(watchlistTable.session_id, input.session_id));
    }

    const existingEntry = await db.select()
      .from(watchlistTable)
      .where(and(...conditions))
      .limit(1)
      .execute();

    // If already exists, return the existing entry
    if (existingEntry.length > 0) {
      return existingEntry[0];
    }

    // Insert new watchlist entry
    const result = await db.insert(watchlistTable)
      .values({
        user_id: input.user_id || null,
        session_id: input.session_id || null,
        media_item_id: input.media_item_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Add to watchlist failed:', error);
    throw error;
  }
};