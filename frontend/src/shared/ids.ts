import { randomUUID } from 'expo-crypto';

/**
 * A random UUID (version 4) for what the device creates before the server knows it: workouts,
 * their exercises and sets, custom exercises. The API stores sessions under this ID, so a
 * repeated save never makes a second copy.
 */
export function newId(): string {
  return randomUUID();
}
