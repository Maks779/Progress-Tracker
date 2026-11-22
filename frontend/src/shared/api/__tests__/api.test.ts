import { apiOrigin } from '../config';
import { ApiError, REQUEST_TIMEOUT_MS, apiFetch, setAccessTokenProvider } from '../fetcher';

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
