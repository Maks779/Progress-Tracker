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

jest.mock('../refreshToken', () => ({
  refreshTokenStore: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
}));

const refreshMock = refresh as jest.Mock;

function unauthorized(code: string) {
  return new ApiError({ type: 'about:blank', title: 'Unauthorized', status: 401, code });
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'restoring', accessToken: null, expired: false });
});

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

  it('says the session expired when the cookie no longer works', async () => {
    refreshMock.mockRejectedValue(unauthorized('session_expired'));

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', expired: true });
  });
});
