import { db } from '../db';
import { userInteractionsTable, mediaItemsTable } from '../db/schema';
import { type GetUserInteractionsInput, type UserInteraction } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export async function getUserInteractions(input: GetUserInteractionsInput): Promise<UserInteraction[]> {
  try {
    // Build query conditions based on input
    const conditions: SQL<unknown>[] = [];

    // Filter by user_id or session_id (at least one must be provided)
    if (input.user_id !== undefined) {
      conditions.push(eq(userInteractionsTable.user_id, input.user_id));
    } else if (input.session_id !== undefined) {
      conditions.push(eq(userInteractionsTable.session_id, input.session_id));
    }

    // Filter by interaction type if specified
    if (input.interaction_type) {
      conditions.push(eq(userInteractionsTable.interaction_type, input.interaction_type));
    }

    // Execute query with conditions
    const results = conditions.length === 0 
      ? await db.select().from(userInteractionsTable).execute()
      : conditions.length === 1
        ? await db.select().from(userInteractionsTable).where(conditions[0]).execute()
        : await db.select().from(userInteractionsTable).where(and(...conditions)).execute();

    // Return results with proper date handling
    return results.map(interaction => ({
      ...interaction,
      created_at: interaction.created_at,
      updated_at: interaction.updated_at
    }));
  } catch (error) {
    console.error('Failed to get user interactions:', error);
    throw error;
  }
}