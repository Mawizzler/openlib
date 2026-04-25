const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ATTEMPTS = 2;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export type FetchWithRetryOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  onResponse?: (response: Response) => void;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return true;
  }

  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return true;
  }

  return /fetch failed|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|UND_ERR/i.test(
    error.message,
  );
};

export const fetchTextWithRetry = async (
  url: string,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {},
): Promise<string> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  let lastStatus: number | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      options.onResponse?.(response);
      lastStatus = response.status;

      if (response.ok) {
        return await response.text();
      }

      const retryable = RETRYABLE_STATUSES.has(response.status);
      if (!retryable || attempt >= maxAttempts) {
        throw new Error(
          `Fetch failed after ${attempt} attempt(s) for ${url} with HTTP ${response.status}`,
        );
      }
    } catch (error) {
      lastError = error;

      if (error instanceof Error && error.message.startsWith('Fetch failed after ')) {
        throw error;
      }

      if (!isRetryableError(error) || attempt >= maxAttempts) {
        const statusDetail = lastStatus ? ` status=${lastStatus}` : '';
        throw new Error(
          `Fetch failed after ${attempt} attempt(s) for ${url}${statusDetail}: ${errorMessage(error)}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  const statusDetail = lastStatus ? ` status=${lastStatus}` : '';
  throw new Error(
    `Fetch failed after ${maxAttempts} attempt(s) for ${url}${statusDetail}: ${errorMessage(lastError)}`,
  );
};
