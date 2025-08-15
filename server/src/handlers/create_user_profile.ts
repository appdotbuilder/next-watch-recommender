import { db } from '../db';
import { userProfilesTable } from '../db/schema';
import { type CreateUserProfileInput, type UserProfile } from '../schema';
import { eq, or } from 'drizzle-orm';

export const createUserProfile = async (input: CreateUserProfileInput): Promise<UserProfile> => {
  try {
    // Check if username or email already exists
    const existingUsers = await db.select()
      .from(userProfilesTable)
      .where(
        or(
          eq(userProfilesTable.username, input.username),
          eq(userProfilesTable.email, input.email)
        )
      )
      .execute();

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.username === input.username) {
        throw new Error('Username already exists');
      }
      if (existingUser.email === input.email) {
        throw new Error('Email already exists');
      }
    }

    // Insert new user profile
    const result = await db.insert(userProfilesTable)
      .values({
        username: input.username,
        email: input.email
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User profile creation failed:', error);
    throw error;
  }
};