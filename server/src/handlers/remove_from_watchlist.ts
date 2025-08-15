import { db } from '../db';
import { watchlistTable } from '../db/schema';
import { type WatchlistInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export const removeFromWatchlist = async (input: WatchlistInput): Promise<{ success: boolean }> => {
  try {
    // Build conditions array for the delete operation
    const conditions = [
      eq(watchlistTable.media_item_id, input.media_item_id)
    ];

    // Add user identification condition (either user_id or session_id)
    if (input.user_id !== undefined) {
      conditions.push(eq(watchlistTable.user_id, input.user_id));
    } else if (input.session_id !== undefined) {
      conditions.push(eq(watchlistTable.session_id, input.session_id));
    } else {
      // Neither user_id nor session_id provided
      return { success: false };
    }

    // Delete the watchlist item
    const result = await db.delete(watchlistTable)
      .where(and(...conditions))
      .execute();

    // Return success status regardless of whether item was found
    // This ensures idempotent behavior - removing non-existent items is not an error
    return { success: true };
  } catch (error) {
    console.error('Failed to remove item from watchlist:', error);
    throw error;
  }
};