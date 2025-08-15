import { db } from '../db';
import { recommendationsTable, mediaItemsTable } from '../db/schema';
import { type GetRecommendationsInput, type Recommendation } from '../schema';
import { eq, and, desc, isNull, SQL } from 'drizzle-orm';

export async function getNextRecommendation(input: GetRecommendationsInput): Promise<Recommendation | null> {
  try {
    // Build conditions for user/session identification and unshown recommendations
    const conditions: SQL<unknown>[] = [
      eq(recommendationsTable.shown, false)
    ];

    // Add user/session filtering
    if (input.user_id !== undefined) {
      conditions.push(eq(recommendationsTable.user_id, input.user_id));
    } else if (input.session_id !== undefined) {
      conditions.push(eq(recommendationsTable.session_id, input.session_id));
    } else {
      // If neither user_id nor session_id provided, look for null values
      conditions.push(
        and(
          isNull(recommendationsTable.user_id),
          isNull(recommendationsTable.session_id)
        )!
      );
    }

    // Build complete query in one go to avoid TypeScript issues
    const results = await db.select({
      id: recommendationsTable.id,
      user_id: recommendationsTable.user_id,
      session_id: recommendationsTable.session_id,
      media_item_id: recommendationsTable.media_item_id,
      reason: recommendationsTable.reason,
      score: recommendationsTable.score,
      shown: recommendationsTable.shown,
      created_at: recommendationsTable.created_at
    })
      .from(recommendationsTable)
      .innerJoin(mediaItemsTable, eq(recommendationsTable.media_item_id, mediaItemsTable.id))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(recommendationsTable.score))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Get the recommendation data
    const recommendationData = results[0];
    
    // Mark the recommendation as shown
    await db.update(recommendationsTable)
      .set({ shown: true })
      .where(eq(recommendationsTable.id, recommendationData.id))
      .execute();

    // Return the recommendation with proper numeric conversion
    return {
      ...recommendationData,
      score: parseFloat(recommendationData.score)
    };
  } catch (error) {
    console.error('Failed to get next recommendation:', error);
    throw error;
  }
}