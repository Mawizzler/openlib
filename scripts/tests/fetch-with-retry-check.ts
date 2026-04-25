import assert from 'node:assert/strict';

import { fetchTextWithRetry } from '@/src/infrastructure/opac/transport/fetchWithRetry';

const originalFetch = globalThis.fetch;

const installFetch = (handler: typeof fetch) => {
  globalThis.fetch = handler;
};

const run = async () => {
  {
    let calls = 0;
    installFetch(async () => {
      calls += 1;
      return new Response(calls === 1 ? 'busy' : 'ok', { status: calls === 1 ? 503 : 200 });
    });

    const body = await fetchTextWithRetry('https://example.org/retry-503');
    assert.equal(body, 'ok');
    assert.equal(calls, 2);
  }

  {
    let calls = 0;
    installFetch(async () => {
      calls += 1;
      return new Response('missing', { status: 404 });
    });

    await assert.rejects(
      fetchTextWithRetry('https://example.org/missing'),
      /Fetch failed after 1 attempt\(s\) for https:\/\/example\.org\/missing with HTTP 404/,
    );
    assert.equal(calls, 1, 'expected no same-URL retry on HTTP 404');
  }

  {
    let calls = 0;
    installFetch(async () => {
      calls += 1;
      if (calls === 1) {
        throw new TypeError('fetch failed');
      }
      return new Response('ok', { status: 200 });
    });

    const body = await fetchTextWithRetry('https://example.org/network');
    assert.equal(body, 'ok');
    assert.equal(calls, 2);
  }

  {
    let calls = 0;
    installFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          calls += 1;
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    await assert.rejects(
      fetchTextWithRetry('https://example.org/timeout', {}, { timeoutMs: 1, maxAttempts: 2 }),
      /Fetch failed after 2 attempt\(s\) for https:\/\/example\.org\/timeout: The operation was aborted\./,
    );
    assert.equal(calls, 2);
  }

  {
    installFetch(async () => new Response('busy', { status: 503 }));
    await assert.rejects(
      fetchTextWithRetry('https://example.org/status', {}, { maxAttempts: 2 }),
      /Fetch failed after 2 attempt\(s\) for https:\/\/example\.org\/status with HTTP 503/,
    );
  }
};

run()
  .then(() => {
    console.log('fetch-with-retry-check: all assertions passed');
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
