type LockManager = { request<T>(name: string, task: () => Promise<T>): Promise<T> };

/**
 * Runs `task` in one browser tab at a time (Web Locks API); tabs that ask meanwhile wait their
 * turn. Phones have one copy of the app, so there the task simply runs.
 */
export function oneTabAtATime<T>(name: string, task: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as { locks?: LockManager } | undefined)?.locks;
  return locks ? locks.request(name, task) : task();
}
