import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { create } from 'zustand';

type Connection = { online: boolean; reachable: boolean };

/**
 * Whether the app can talk to the server. `online` is the device's own view (Wi-Fi or mobile
 * data is on); `reachable` is what the last request learned: a request without any answer
 * marks the server unreachable, and any answer marks it reachable again. A gym's Wi-Fi without
 * internet is online but not reachable.
 */
export const useConnection = create<Connection>()(() => ({ online: onlineManager.isOnline(), reachable: true }));

/** The fetcher reports every request: answered (`true`) or not (`false`). */
export function reportReachable(reachable: boolean): void {
  if (useConnection.getState().reachable !== reachable) {
    useConnection.setState({ reachable });
  }
}

export function isOffline(state: Connection = useConnection.getState()): boolean {
  return !state.online || !state.reachable;
}

/** True while the device has no network or the server does not answer. */
export function useOffline(): boolean {
  return useConnection(isOffline);
}

let watching = false;

/**
 * Follows the device's network. Browsers have `online` and `offline` events, which React Query
 * already listens to; on phones expo-network reports Wi-Fi and mobile data changes. React Query
 * refetches when the device is back online, and `useConnection` follows it for the screens.
 */
export function watchConnection(): void {
  if (watching) {
    return;
  }
  watching = true;
  if (Platform.OS !== 'web') {
    onlineManager.setEventListener((setOnline) => {
      Network.getNetworkStateAsync()
        .then((state) => setOnline(state.isConnected !== false))
        .catch(() => undefined);
      const subscription = Network.addNetworkStateListener((state) => setOnline(state.isConnected !== false));
      return () => subscription.remove();
    });
  }
  useConnection.setState({ online: onlineManager.isOnline() });
  onlineManager.subscribe((online) => useConnection.setState({ online }));
}
