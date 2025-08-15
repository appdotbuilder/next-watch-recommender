import { type SessionInput } from '../schema';

export async function createGuestSession(): Promise<{ sessionId: string }> {
  // Generate a unique session ID using timestamp and random string
  // Format: guest_<timestamp>_<random_string>
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15); // 13 character random string
  const sessionId = `guest_${timestamp}_${randomString}`;
  
  return { sessionId };
}