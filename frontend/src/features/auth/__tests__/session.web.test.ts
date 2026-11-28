import { ApiError } from '@/shared/api/fetcher';
import { logout, refresh } from '@/shared/api/generated/endpoints/auth/auth';

import { type ElsewhereChange, onSessionChangedElsewhere, refreshTokenStore } from '../refreshToken';
import { installAuth, restoreSession } from '../session';
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
  onSessionChangedElsewhere: jest.fn(),
}));

const refreshMock = refresh as jest.Mock;
const logoutMock = logout as jest.Mock;

function jwt(sub: string): string {
  const part = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${part({ alg: 'HS256' })}.${part({ sub, fid: 'family' })}.signature`;
}

function unauthorized(code: string) {
  return new ApiError({ type: 'about:blank', title: 'Unauthorized', status: 401, code });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRemembered = false;
  logoutMock.mockResolvedValue({ status: 204, data: undefined, headers: new Headers() });
  useAuthStore.setState({ status: 'restoring', accessToken: null, userId: null, expired: false });
});

const unreachable = () => new ApiError({ type: 'about:blank', title: 'Offline', status: 0, code: 'network_error' });

describe('restoreSession on the web, where the refresh cookie is invisible to the page', () => {
  it('asks the server when the browser noted a session, because only the server sees the cookie', async () => {
    mockRemembered = true;
    refreshMock.mockRejectedValue(unauthorized('no_session'));

    await restoreSession();

    expect(refreshMock).toHaveBeenCalledWith(null);
  });

  it('does not sign in with a cookie left behind by a log out, and ends it on the server', async () => {
    await restoreSession();

    expect(refreshMock).not.toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalledWith(null);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', expired: false });
  });

  it('shows the welcome screen even when ending that cookie fails', async () => {
    logoutMock.mockRejectedValue(unreachable());

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

  it('notes whose session the browser holds after the server renews it', async () => {
    mockRemembered = true;
    const access = jwt('account-a');
    refreshMock.mockResolvedValue({ status: 200, headers: new Headers(), data: { access_token: access, expires_in: 900, token_type: 'bearer' } });

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: access, userId: 'account-a' });
    expect(refreshTokenStore.remember).toHaveBeenCalledWith('account-a');
  });
});

describe('other tabs of the same browser', () => {
  let changed: (change: ElsewhereChange) => void = () => undefined;

  beforeEach(() => {
    (onSessionChangedElsewhere as jest.Mock).mockImplementation((listener) => {
      changed = listener;
    });
    installAuth();
    useAuthStore.getState().setSignedIn(jwt('account-a'));
  });

  it('signing out there signs this tab out, without ending anything on the server', () => {
    changed({ signedOut: true });

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', accessToken: null, expired: false });
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('signing in there as someone else signs this tab out', () => {
    changed({ signedOut: false, userId: 'account-b' });

    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('renewing the same session there changes nothing here', () => {
    changed({ signedOut: false, userId: 'account-a' });

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', userId: 'account-a' });
  });
});
