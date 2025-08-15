import { db } from '../db';
import { mediaItemsTable, userInteractionsTable, recommendationsTable } from '../db/schema';
import { type GetRecommendationsInput, type Recommendation } from '../schema';
import { eq, and, or, notInArray, sql, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function generateRecommendations(input: GetRecommendationsInput): Promise<Recommendation[]> {
  try {
    const { user_id, session_id, limit } = input;



    // Validate input - must have either user_id or session_id
    if (!user_id && !session_id) {
      throw new Error('Either user_id or session_id must be provided');
    }

    // Get user's interactions to understand preferences
    // Build the where condition based on what we have
    const userInteractions = await (async () => {
      const baseQuery = db.select({
        media_item_id: userInteractionsTable.media_item_id,
        interaction_type: userInteractionsTable.interaction_type,
        title: mediaItemsTable.title,
        genres: mediaItemsTable.genres,
        media_type: mediaItemsTable.media_type,
        vote_average: mediaItemsTable.vote_average
      })
      .from(userInteractionsTable)
      .innerJoin(mediaItemsTable, eq(userInteractionsTable.media_item_id, mediaItemsTable.id));

      if (user_id && session_id) {
        return baseQuery.where(or(
          eq(userInteractionsTable.user_id, user_id),
          eq(userInteractionsTable.session_id, session_id)
        )).execute();
      } else if (user_id) {
        return baseQuery.where(eq(userInteractionsTable.user_id, user_id)).execute();
      } else {
        return baseQuery.where(eq(userInteractionsTable.session_id, session_id as string)).execute();
      }
    })();



    // Get list of media items user has already interacted with
    const interactedMediaIds = userInteractions.map(interaction => interaction.media_item_id);

    // Analyze preferences
    const likedItems = userInteractions.filter(item => 
      ['like', 'watched_liked'].includes(item.interaction_type)
    );
    const dislikedItems = userInteractions.filter(item => 
      ['dislike', 'watched_disliked'].includes(item.interaction_type)
    );

    // Extract preferred genres and media types
    const likedGenres = new Set<string>();
    const likedMediaTypes = new Set<string>();
    
    likedItems.forEach(item => {
      item.genres.forEach(genre => likedGenres.add(genre));
      likedMediaTypes.add(item.media_type);
    });

    // Get potential recommendations - exclude already interacted items
    // Build conditions for filtering
    const candidateConditions: SQL<unknown>[] = [];

    // Exclude items user has already interacted with
    if (interactedMediaIds.length > 0) {
      candidateConditions.push(notInArray(mediaItemsTable.id, interactedMediaIds));
    }

    // Filter by preferred media types if we have preferences
    if (likedMediaTypes.size > 0 && likedMediaTypes.size < 2) { // Only if clear preference
      const preferredType = Array.from(likedMediaTypes)[0] as 'movie' | 'tv';
      candidateConditions.push(eq(mediaItemsTable.media_type, preferredType));
    }

    // Execute query with proper conditional where clause
    const candidates = candidateConditions.length > 0 
      ? await db.select()
          .from(mediaItemsTable)
          .where(candidateConditions.length === 1 ? candidateConditions[0] : and(...candidateConditions))
          .orderBy(desc(mediaItemsTable.vote_average), desc(mediaItemsTable.popularity))
          .limit(limit * 3)
          .execute()
      : await db.select()
          .from(mediaItemsTable)
          .orderBy(desc(mediaItemsTable.vote_average), desc(mediaItemsTable.popularity))
          .limit(limit * 3)
          .execute();

    // Score candidates based on genre overlap and other factors
    const scoredCandidates = candidates.map(candidate => {
      let score = 0.3; // Base score
      let reasons: string[] = [];

      // Genre matching bonus
      const genreOverlap = candidate.genres.filter(genre => likedGenres.has(genre)).length;
      if (genreOverlap > 0) {
        score += genreOverlap * 0.2;
        const matchingGenres = candidate.genres.filter(genre => likedGenres.has(genre));
        reasons.push(`genres you enjoy: ${matchingGenres.join(', ')}`);
      }

      // High rating bonus
      const rating = parseFloat(candidate.vote_average);
      if (rating >= 8.0) {
        score += 0.2;
        reasons.push(`highly rated (${rating}/10)`);
      } else if (rating >= 7.0) {
        score += 0.1;
        reasons.push(`well-rated (${rating}/10)`);
      }

      // Media type preference bonus
      if (likedMediaTypes.has(candidate.media_type)) {
        score += 0.1;
        reasons.push(`you like ${candidate.media_type}s`);
      }

      // Popularity bonus for discovery
      const popularity = parseFloat(candidate.popularity);
      if (popularity > 50) {
        score += 0.05;
      }

      // Generate reason text
      let reason = 'Recommended for you';
      if (reasons.length > 0) {
        reason = `Because of ${reasons.join(' and ')}`;
      } else if (likedItems.length > 0) {
        const randomLikedItem = likedItems[Math.floor(Math.random() * likedItems.length)];
        reason = `Because you liked "${randomLikedItem.title}"`;
      }

      // Ensure score is between 0 and 1
      score = Math.min(Math.max(score, 0), 1);

      return {
        ...candidate,
        score,
        reason
      };
    });

    // Sort by score and take top recommendations
    scoredCandidates.sort((a, b) => b.score - a.score);
    const topCandidates = scoredCandidates.slice(0, limit);

    // Create recommendation records
    const recommendations = await Promise.all(
      topCandidates.map(async (candidate) => {
        const result = await db.insert(recommendationsTable)
          .values({
            user_id: user_id || null,
            session_id: session_id || null,
            media_item_id: candidate.id,
            reason: candidate.reason,
            score: candidate.score.toString() // Convert to string for numeric column
          })
          .returning()
          .execute();

        const recommendation = result[0];
        return {
          ...recommendation,
          score: parseFloat(recommendation.score) // Convert back to number
        };
      })
    );

    return recommendations;
  } catch (error) {
    console.error('Generate recommendations failed:', error);
    throw error;
  }
}