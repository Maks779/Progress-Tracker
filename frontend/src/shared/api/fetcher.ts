import { apiOrigin } from './config';

export type ProblemFieldError = { field: string; code: string; message: string };

export type Problem = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string | null;
  errors?: ProblemFieldError[] | null;
};

/** An API error in the problem details format; `code` is stable and translatable. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: ProblemFieldError[];

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.fieldErrors = problem.errors ?? [];
  }
}

/** A request without an answer after this long fails as `timeout` instead of hanging. */
export const REQUEST_TIMEOUT_MS = 10_000;

type TokenProvider = () => string | null;

let accessToken: TokenProvider = () => null;

/** The auth layer tells the fetcher how to read the current access token. */
export function setAccessTokenProvider(provider: TokenProvider): void {
  accessToken = provider;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  const type = response.headers.get('content-type') ?? '';
  return type.includes('json') ? JSON.parse(text) : text;
}

function toProblem(status: number, body: unknown): Problem {
  if (body && typeof body === 'object' && 'code' in body) {
    return body as Problem;
  }
  return { type: 'about:blank', title: 'Request failed', status, code: 'network_error' };
}

/** The fetch function Orval's generated hooks call. */
export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = accessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const caller = options.signal;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const cancel = () => controller.abort();
  if (caller?.aborted) {
    cancel();
  }
  caller?.addEventListener('abort', cancel);

  let response: Response;
  let body: unknown;
  try {
    response = await fetch(`${apiOrigin()}${url}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    body = await readBody(response);
  } catch (error) {
    if (caller?.aborted) {
      throw error;
    }
    throw new ApiError({
      type: 'about:blank',
      title: timedOut ? 'Request timed out' : 'Network request failed',
      status: 0,
      code: timedOut ? 'timeout' : 'network_error',
    });
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', cancel);
  }

  if (!response.ok) {
    throw new ApiError(toProblem(response.status, body));
  }
  return { data: body, status: response.status, headers: response.headers } as T;
}

export default apiFetch;
