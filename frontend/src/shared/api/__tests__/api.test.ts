import { apiOrigin } from '../config';
import {
  ApiError,
  REQUEST_TIMEOUT_MS,
  apiFetch,
  setAccessTokenProvider,
  setUnauthorizedHandler,
} from '../fetcher';

describe('apiOrigin', () => {
  it('uses EXPO_PUBLIC_API_URL when it is set', () => {
    expect(apiOrigin('https://ember.example/', '192.168.1.5:8082', 'android')).toBe(
      'https://ember.example',
    );
  });

  it('reaches the development computer from a phone', () => {
    expect(apiOrigin(undefined, '192.168.1.5:8082', 'android')).toBe('http://192.168.1.5:8000');
  });

  it('uses localhost on the web', () => {
    expect(apiOrigin(undefined, 'localhost:8082', 'web')).toBe('http://localhost:8000');
  });
});

function respond(status: number, body: unknown, type = 'application/json') {
  return {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': type }),
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

describe('apiFetch', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    setAccessTokenProvider(() => null);
    setUnauthorizedHandler(async () => false);
  });

  function sentHeaders(call: number): Headers {
    return fetchMock.mock.calls[call][1].headers as Headers;
  }

  const unauthorized = {
    type: 'about:blank',
    title: 'Unauthorized',
    status: 401,
    code: 'unauthorized',
  };

  it('tells the server which kind of client it is', async () => {
    fetchMock.mockResolvedValue(respond(200, { status: 'ok' }));

    await apiFetch('/api/v1/health');

    expect(sentHeaders(0).get('X-Client')).toBe('native');
  });

  describe('after a 401', () => {
    it('renews the session once and repeats the request', async () => {
      let token = 'expired-token';
      setAccessTokenProvider(() => token);
      setUnauthorizedHandler(async () => {
        token = 'fresh-token';
        return true;
      });
      fetchMock
        .mockResolvedValueOnce(respond(401, unauthorized, 'application/problem+json'))
        .mockResolvedValueOnce(respond(200, { name: 'Alex' }));

      const result = await apiFetch<{ data: unknown }>('/api/v1/me');

      expect(result.data).toEqual({ name: 'Alex' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sentHeaders(1).get('Authorization')).toBe('Bearer fresh-token');
    });

    it('gives up when the session cannot be renewed', async () => {
      fetchMock.mockResolvedValue(respond(401, unauthorized, 'application/problem+json'));

      const error = (await apiFetch('/api/v1/me').catch((caught: unknown) => caught)) as ApiError;

      expect(error.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('never renews the session for the auth endpoints themselves', async () => {
      const renew = jest.fn(async () => true);
      setUnauthorizedHandler(renew);
      fetchMock.mockResolvedValue(respond(401, unauthorized, 'application/problem+json'));

      await apiFetch('/api/v1/auth/refresh').catch(() => undefined);

      expect(renew).not.toHaveBeenCalled();
    });
  });

  it('returns data and status', async () => {
    fetchMock.mockResolvedValue(respond(200, { status: 'ok' }));

    const result = await apiFetch<{ data: unknown; status: number }>('/api/v1/health');

    expect(result.data).toEqual({ status: 'ok' });
    expect(result.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/health$/);
  });

  it('adds the access token', async () => {
    fetchMock.mockResolvedValue(respond(204, undefined));
    setAccessTokenProvider(() => 'token-123');

    await apiFetch('/api/v1/me');

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-123');
  });

  it('turns problem details into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      respond(
        422,
        {
          type: 'about:blank',
          title: 'Validation error',
          status: 422,
          code: 'validation_error',
          errors: [{ field: 'email', code: 'value_error', message: 'Invalid email' }],
        },
        'application/problem+json',
      ),
    );

    const error = await apiFetch('/api/v1/auth/login').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('validation_error');
    expect((error as ApiError).fieldErrors[0].field).toBe('email');
  });

  it('reports an unreachable server as a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = (await apiFetch('/api/v1/health').catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe('network_error');
  });

  describe('when the server does not answer', () => {
    function hangUntilAborted() {
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
          }),
      );
    }

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('gives up after the timeout', async () => {
      hangUntilAborted();

      const pending = apiFetch('/api/v1/health').catch((caught: unknown) => caught);
      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
      const error = (await pending) as ApiError;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.code).toBe('timeout');
    });

    it('lets the caller cancel without reporting an error code', async () => {
      hangUntilAborted();
      const caller = new AbortController();

      const pending = apiFetch('/api/v1/health', { signal: caller.signal }).catch(
        (caught: unknown) => caught,
      );
      caller.abort();
      const error = await pending;

      expect(error).not.toBeInstanceOf(ApiError);
    });
  });

  it('reports a failure without a body as a network error', async () => {
    fetchMock.mockResolvedValue(respond(502, undefined, 'text/plain'));

    const error = (await apiFetch('/api/v1/health').catch((caught: unknown) => caught)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.code).toBe('network_error');
  });
});
