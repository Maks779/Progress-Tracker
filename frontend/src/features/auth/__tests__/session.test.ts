import { ApiError, apiFetch } from '@/shared/api/fetcher';
import { logout, refresh } from '@/shared/api/generated/endpoints/auth/auth';

import { refreshTokenStore } from '../refreshToken';
import { installAuth, refreshSession, restoreSession, signOut } from '../session';
import { useAuthStore } from '../store';

jest.mock('@/shared/api/generated/endpoints/auth/auth', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  register: jest.fn(),
}));

jest.mock('../refreshToken', () => {
  let saved: string | null = null;
  return {
    refreshTokenStore: {
      get: jest.fn(async () => saved),
      set: jest.fn(async (token: string) => {
        saved = token;
      }),
      clear: jest.fn(async () => {
        saved = null;
      }),
      remember: jest.fn(async () => undefined),
      exists: jest.fn(async () => saved !== null),
    },
  };
});

const refreshMock = refresh as jest.Mock;
const logoutMock = logout as jest.Mock;

function tokens(access: string, refreshToken: string) {
  return {
    status: 200,
    headers: new Headers(),
    data: { access_token: access, refresh_token: refreshToken, expires_in: 900, token_type: 'bearer' },
  };
}

function apiError(status: number, code: string) {
  return new ApiError({ type: 'about:blank', title: code, status, code });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await refreshTokenStore.clear();
  useAuthStore.setState({ status: 'restoring', accessToken: null, expired: false });
});

describe('refreshSession', () => {
  it('shares one request between callers who ask at the same time', async () => {
    await refreshTokenStore.set('refresh-1');
    refreshMock.mockResolvedValue(tokens('access-2', 'refresh-2'));

    const results = await Promise.all([refreshSession(), refreshSession()]);

    expect(results).toEqual(['refreshed', 'refreshed']);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledWith({ refresh_token: 'refresh-1' });
    expect(await refreshTokenStore.get()).toBe('refresh-2');
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'access-2' });
  });

  it('forgets a refresh token the server refuses', async () => {
    await refreshTokenStore.set('refresh-1');
    refreshMock.mockRejectedValue(apiError(401, 'session_expired'));

    expect(await refreshSession()).toBe('rejected');
    expect(await refreshTokenStore.get()).toBeNull();
  });

  it('keeps the token when the server cannot be reached', async () => {
    await refreshTokenStore.set('refresh-1');
    refreshMock.mockRejectedValue(apiError(0, 'network_error'));

    expect(await refreshSession()).toBe('unreachable');
    expect(await refreshTokenStore.get()).toBe('refresh-1');
  });
});

describe('restoreSession', () => {
  it('signs in again with the saved token', async () => {
    await refreshTokenStore.set('refresh-1');
    refreshMock.mockResolvedValue(tokens('access-2', 'refresh-2'));

    await restoreSession();

    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('shows the welcome screen when nothing is saved', async () => {
    await restoreSession();

    expect(refreshMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', expired: false });
  });

  it('stays signed in offline while a token is saved', async () => {
    await refreshTokenStore.set('refresh-1');
    refreshMock.mockRejectedValue(apiError(0, 'network_error'));

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: null });
  });

  it('says the session expired when the saved token is refused', async () => {
    await refreshTokenStore.set('refresh-1');
    refreshMock.mockRejectedValue(apiError(401, 'session_expired'));

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', expired: true });
  });
});

describe('signOut', () => {
  it('revokes the session on the server and forgets it on the device', async () => {
    await refreshTokenStore.set('refresh-1');
    useAuthStore.getState().setSignedIn('access-1');
    logoutMock.mockResolvedValue({ status: 204, data: undefined, headers: new Headers() });

    await signOut();

    expect(logoutMock).toHaveBeenCalledWith({ refresh_token: 'refresh-1' });
    expect(await refreshTokenStore.get()).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', expired: false });
  });

  it('forgets the session even when the server cannot be reached', async () => {
    await refreshTokenStore.set('refresh-1');
    useAuthStore.getState().setSignedIn('access-1');
    logoutMock.mockRejectedValue(apiError(0, 'network_error'));

    await signOut();

    expect(useAuthStore.getState().status).toBe('signedOut');
  });
});

describe('a request that answers 401', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    installAuth();
  });

  it('ends the session when the refresh token is refused too', async () => {
    await refreshTokenStore.set('refresh-1');
    useAuthStore.getState().setSignedIn('access-1');
    refreshMock.mockRejectedValue(apiError(401, 'session_expired'));
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/problem+json' }),
      text: async () =>
        JSON.stringify({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'unauthorized' }),
    });

    await apiFetch('/api/v1/me').catch(() => undefined);

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', expired: true });
  });
});
