import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { userProfilesTable } from '../db/schema';
import { type CreateUserProfileInput } from '../schema';
import { createUserProfile } from '../handlers/create_user_profile';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: CreateUserProfileInput = {
  username: 'testuser',
  email: 'test@example.com'
};

const anotherTestInput: CreateUserProfileInput = {
  username: 'anotheruser',
  email: 'another@example.com'
};

describe('createUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user profile successfully', async () => {
    const result = await createUserProfile(testInput);

    // Verify returned data structure
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.username).toBe('testuser');
    expect(result.email).toBe('test@example.com');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user profile to database', async () => {
    const result = await createUserProfile(testInput);

    // Query database to verify user was created
    const users = await db.select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toBe('testuser');
    expect(users[0].email).toBe('test@example.com');
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should reject duplicate username', async () => {
    // Create first user
    await createUserProfile(testInput);

    // Attempt to create user with same username but different email
    const duplicateUsernameInput: CreateUserProfileInput = {
      username: 'testuser',
      email: 'different@example.com'
    };

    await expect(createUserProfile(duplicateUsernameInput))
      .rejects.toThrow(/username already exists/i);
  });

  it('should reject duplicate email', async () => {
    // Create first user
    await createUserProfile(testInput);

    // Attempt to create user with same email but different username
    const duplicateEmailInput: CreateUserProfileInput = {
      username: 'differentuser',
      email: 'test@example.com'
    };

    await expect(createUserProfile(duplicateEmailInput))
      .rejects.toThrow(/email already exists/i);
  });

  it('should create multiple users with unique credentials', async () => {
    // Create first user
    const firstUser = await createUserProfile(testInput);
    
    // Create second user with different credentials
    const secondUser = await createUserProfile(anotherTestInput);

    // Verify both users exist in database
    const allUsers = await db.select()
      .from(userProfilesTable)
      .execute();

    expect(allUsers).toHaveLength(2);
    
    // Verify first user
    const firstDbUser = allUsers.find(u => u.id === firstUser.id);
    expect(firstDbUser?.username).toBe('testuser');
    expect(firstDbUser?.email).toBe('test@example.com');
    
    // Verify second user
    const secondDbUser = allUsers.find(u => u.id === secondUser.id);
    expect(secondDbUser?.username).toBe('anotheruser');
    expect(secondDbUser?.email).toBe('another@example.com');
  });

  it('should handle edge case usernames and emails', async () => {
    const edgeCaseInput: CreateUserProfileInput = {
      username: 'a'.repeat(3), // Minimum length
      email: 'edge@test-domain.co.uk'
    };

    const result = await createUserProfile(edgeCaseInput);
    
    expect(result.username).toBe('aaa');
    expect(result.email).toBe('edge@test-domain.co.uk');
    
    // Verify in database
    const users = await db.select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.id, result.id))
      .execute();
    
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe('aaa');
  });
});