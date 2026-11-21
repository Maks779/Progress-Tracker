import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 8000;

/**
 * Origin of the API (paths in the generated client already start with /api/v1).
 * EXPO_PUBLIC_API_URL wins when set (production builds). In development the phone
 * reaches the API on the same computer that serves the app, so we reuse its address.
 */
export function apiOrigin(
  envUrl = process.env.EXPO_PUBLIC_API_URL,
  hostUri = Constants.expoConfig?.hostUri,
  platform = Platform.OS,
): string {
  if (envUrl !== undefined && envUrl !== '') {
    return envUrl.replace(/\/$/, '');
  }
  const host = hostUri?.split(':')[0];
  if (platform !== 'web' && host) {
    return `http://${host}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}
