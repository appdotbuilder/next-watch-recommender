import { db } from '../db';
import { userInteractionsTable, userProfilesTable, mediaItemsTable } from '../db/schema';
import { type CreateUserInteractionInput, type UserInteraction } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createUserInteraction(input: CreateUserInteractionInput): Promise<UserInteraction> {
  try {
    // Validate that either user_id or session_id is provided
    if (!input.user_id && !input.session_id) {
      throw new Error('Either user_id or session_id must be provided');
    }

    // Validate foreign key references exist
    if (input.user_id) {
      const userExists = await db.select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.id, input.user_id))
        .limit(1)
        .execute();
      
      if (userExists.length === 0) {
        throw new Error(`User with id ${input.user_id} does not exist`);
      }
    }

    const mediaExists = await db.select()
      .from(mediaItemsTable)
      .where(eq(mediaItemsTable.id, input.media_item_id))
      .limit(1)
      .execute();
    
    if (mediaExists.length === 0) {
      throw new Error(`Media item with id ${input.media_item_id} does not exist`);
    }

    // Build conditions to check for existing interaction
    const conditions = [eq(userInteractionsTable.media_item_id, input.media_item_id)];

    // Add user identification condition (either user_id or session_id)
    if (input.user_id) {
      conditions.push(eq(userInteractionsTable.user_id, input.user_id));
    } else if (input.session_id) {
      conditions.push(eq(userInteractionsTable.session_id, input.session_id));
    }

    // Check if interaction already exists for this user/session and media item
    const existingInteraction = await db.select()
      .from(userInteractionsTable)
      .where(and(...conditions))
      .limit(1)
      .execute();

    let result;

    if (existingInteraction.length > 0) {
      // Update existing interaction
      const updateResult = await db.update(userInteractionsTable)
        .set({
          interaction_type: input.interaction_type,
          updated_at: new Date()
        })
        .where(eq(userInteractionsTable.id, existingInteraction[0].id))
        .returning()
        .execute();

      result = updateResult[0];
    } else {
      // Create new interaction
      const insertResult = await db.insert(userInteractionsTable)
        .values({
          user_id: input.user_id || null,
          session_id: input.session_id || null,
          media_item_id: input.media_item_id,
          interaction_type: input.interaction_type
        })
        .returning()
        .execute();

      result = insertResult[0];
    }

    return {
      ...result,
      user_id: result.user_id,
      session_id: result.session_id
    };
  } catch (error) {
    console.error('User interaction creation/update failed:', error);
    throw error;
  }
}