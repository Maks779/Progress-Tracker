import AsyncStorage from '@react-native-async-storage/async-storage';

import { type ElsewhereChange, onSessionChangedElsewhere, refreshTokenStore } from '../refreshToken';

jest.mock('@/shared/api/fetcher', () => ({ CLIENT_KIND: 'web' }));

type StorageListener = (event: { key: string | null; newValue: string | null }) => void;

const handlers: StorageListener[] = [];
const changes: ElsewhereChange[] = [];

beforeAll(() => {
  Object.assign(globalThis, {
    window: Object.assign(globalThis.window ?? {}, {
      addEventListener: (type: string, handler: StorageListener) => {
        if (type === 'storage') {
          handlers.push(handler);
        }
      },
    }),
  });
  onSessionChangedElsewhere((change) => changes.push(change));
});

beforeEach(async () => {
  changes.length = 0;
  await AsyncStorage.clear();
});

const fire = (key: string | null, newValue: string | null) => handlers.forEach((handler) => handler({ key, newValue }));

describe('the web session note', () => {
  it("names the account, so other tabs can tell whose session the browser holds", async () => {
    await refreshTokenStore.remember('account-a');

    expect(await AsyncStorage.getItem('ember.session')).toBe('"account-a"');
    expect(await refreshTokenStore.exists()).toBe(true);
  });

  it('still counts a note from before it named the account', async () => {
    await AsyncStorage.setItem('ember.session', 'true');

    expect(await refreshTokenStore.exists()).toBe(true);
  });

  it('is gone after the session is forgotten', async () => {
    await refreshTokenStore.remember('account-a');
    await refreshTokenStore.clear();

    expect(await refreshTokenStore.exists()).toBe(false);
  });
});

describe('changes made by another tab', () => {
  it('a removed note means that tab signed out, or its session ended', () => {
    fire('ember.session', null);

    expect(changes).toEqual([{ signedOut: true }]);
  });

  it('a cleared storage counts as signed out too', () => {
    fire(null, null);

    expect(changes).toEqual([{ signedOut: true }]);
  });

  it('a written note says who is signed in there', () => {
    fire('ember.session', '"account-b"');
    fire('ember.session', 'true');

    expect(changes).toEqual([
      { signedOut: false, userId: 'account-b' },
      { signedOut: false, userId: null },
    ]);
  });

  it('other keys are not about the session', () => {
    fire('ember.outbox.session.one', '{}');
    fire('ember.cache', null);

    expect(changes).toEqual([]);
  });
});
