import { ApiError } from '@/shared/api/fetcher';
import { refresh } from '@/shared/api/generated/endpoints/auth/auth';

import { restoreSession } from '../session';
import { useAuthStore } from '../store';

jest.mock('@/shared/api/fetcher', () => ({
  ...jest.requireActual('@/shared/api/fetcher'),
  CLIENT_KIND: 'web',
}));

jest.mock('@/shared/api/generated/endpoints/auth/auth', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  register: jest.fn(),
}));

let mockRemembered = false;
jest.mock('../refreshToken', () => ({
  refreshTokenStore: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    clear: jest.fn(async () => {
      mockRemembered = false;
    }),
    remember: jest.fn(async () => {
      mockRemembered = true;
    }),
    exists: jest.fn(async () => mockRemembered),
  },
}));

const refreshMock = refresh as jest.Mock;

function unauthorized(code: string) {
  return new ApiError({ type: 'about:blank', title: 'Unauthorized', status: 401, code });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRemembered = false;
  useAuthStore.setState({ status: 'restoring', accessToken: null, expired: false });
});

const unreachable = () => new ApiError({ type: 'about:blank', title: 'Offline', status: 0, code: 'network_error' });

describe('restoreSession on the web, where the refresh cookie is invisible to the page', () => {
  it('asks the server, because only the server sees the cookie', async () => {
    refreshMock.mockRejectedValue(unauthorized('no_session'));

    await restoreSession();

    expect(refreshMock).toHaveBeenCalledWith(null);
  });

  it('shows the welcome screen when the browser has no session', async () => {
    refreshMock.mockRejectedValue(unauthorized('no_session'));

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', expired: false });
  });

  it('says the session expired when the cookie no longer works, and forgets the session', async () => {
    mockRemembered = true;
    refreshMock.mockRejectedValue(unauthorized('session_expired'));

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', expired: true });
    expect(mockRemembered).toBe(false);
  });

  it('opens signed in with the saved data when the server cannot be reached and the browser had a session', async () => {
    mockRemembered = true;
    refreshMock.mockRejectedValue(unreachable());

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: null });
  });

  it('shows the welcome screen when the server cannot be reached and the browser never signed in', async () => {
    refreshMock.mockRejectedValue(unreachable());

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', expired: false });
  });

  it('remembers the session after the server renews it', async () => {
    refreshMock.mockResolvedValue({ status: 200, headers: new Headers(), data: { access_token: 'access', expires_in: 900, token_type: 'bearer' } });

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'access' });
    expect(mockRemembered).toBe(true);
  });
});
