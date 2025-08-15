import { describe, expect, it, beforeAll } from 'bun:test';
import { createGuestSession } from '../handlers/create_guest_session';

describe('createGuestSession', () => {
  it('should create a guest session with valid session ID', async () => {
    const result = await createGuestSession();

    // Verify result structure
    expect(result).toHaveProperty('sessionId');
    expect(typeof result.sessionId).toBe('string');
    expect(result.sessionId.length).toBeGreaterThan(0);
  });

  it('should generate session ID with correct format', async () => {
    const result = await createGuestSession();
    const sessionId = result.sessionId;

    // Should start with 'guest_'
    expect(sessionId).toMatch(/^guest_/);
    
    // Should have the format: guest_<timestamp>_<randomString>
    const parts = sessionId.split('_');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('guest');
    
    // Second part should be a valid timestamp
    const timestamp = parseInt(parts[1]);
    expect(timestamp).toBeGreaterThan(0);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
    
    // Third part should be a random string
    expect(parts[2]).toMatch(/^[a-z0-9]+$/);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should generate unique session IDs', async () => {
    const sessions = await Promise.all([
      createGuestSession(),
      createGuestSession(),
      createGuestSession(),
      createGuestSession(),
      createGuestSession()
    ]);

    const sessionIds = sessions.map(s => s.sessionId);
    const uniqueIds = new Set(sessionIds);

    // All session IDs should be unique
    expect(uniqueIds.size).toBe(sessionIds.length);
  });

  it('should generate session IDs with sufficient length to avoid collisions', async () => {
    const result = await createGuestSession();
    const sessionId = result.sessionId;

    // Session ID should be long enough to minimize collision risk
    // Format: guest_<13-digit-timestamp>_<13-char-random> = ~33 characters minimum
    expect(sessionId.length).toBeGreaterThanOrEqual(25);
  });

  it('should generate session IDs with increasing timestamps', async () => {
    const session1 = await createGuestSession();
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));
    
    const session2 = await createGuestSession();

    const timestamp1 = parseInt(session1.sessionId.split('_')[1]);
    const timestamp2 = parseInt(session2.sessionId.split('_')[1]);

    expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
  });

  it('should handle concurrent session creation', async () => {
    // Create multiple sessions concurrently
    const concurrentPromises = Array.from({ length: 10 }, () => createGuestSession());
    const results = await Promise.all(concurrentPromises);

    // All should succeed and be unique
    expect(results).toHaveLength(10);
    
    const sessionIds = results.map(r => r.sessionId);
    const uniqueIds = new Set(sessionIds);
    expect(uniqueIds.size).toBe(10);

    // All should have valid format
    results.forEach(result => {
      expect(result.sessionId).toMatch(/^guest_\d+_[a-z0-9]+$/);
    });
  });

  it('should create session ID suitable for database storage', async () => {
    const result = await createGuestSession();
    const sessionId = result.sessionId;

    // Should only contain safe database characters
    expect(sessionId).toMatch(/^[a-z0-9_]+$/);
    
    // Should not be too long for typical database text columns
    expect(sessionId.length).toBeLessThan(255);
  });
});