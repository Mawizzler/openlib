import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  isLeipzigCatalogProxyTarget,
  resolveCatalogProxyRequest,
} from '@/src/infrastructure/opac/transport/catalogProxy';
import { fetchTextWithRetry } from '@/src/infrastructure/opac/transport/fetchWithRetry';

const require = createRequire(import.meta.url);
const catalogProxy = require('../../api/catalog-proxy.js') as (req: unknown, res: unknown) => Promise<void>;
const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

const installBrowserGlobals = () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {},
  });
};

const restoreBrowserGlobals = () => {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow);
  } else {
    delete (globalThis as typeof globalThis & { window?: unknown }).window;
  }

  if (originalDocument) {
    Object.defineProperty(globalThis, 'document', originalDocument);
  } else {
    delete (globalThis as typeof globalThis & { document?: unknown }).document;
  }
};

const allowedUrl =
  'https://bibliothekskatalog.leipzig.de/webOPACClient/search.do?methodToCall=quickSearch&searchString=klima';

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
  setHeader: (name: string, value: string) => void;
  end: (value?: string | Buffer) => void;
};

const makeResponse = (): MockResponse => ({
  statusCode: 200,
  headers: {},
  body: Buffer.alloc(0),
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  },
  end(value) {
    this.body = Buffer.isBuffer(value) ? value : Buffer.from(value ?? '');
  },
});

const run = async () => {
  assert.equal(isLeipzigCatalogProxyTarget(allowedUrl), true);
  assert.equal(
    isLeipzigCatalogProxyTarget('https://bibliothekskatalog.leipzig.de/webOPACClient/start.do'),
    true,
  );
  assert.equal(
    isLeipzigCatalogProxyTarget('https://bibliothekskatalog.leipzig.de/webOPACClient/hitList.do?methodToCall=pos'),
    true,
  );
  assert.equal(
    isLeipzigCatalogProxyTarget('https://bibliothekskatalog.leipzig.de/webOPACClient/singleHit.do?curPos=1'),
    true,
  );
  assert.equal(
    isLeipzigCatalogProxyTarget('https://bibliothekskatalog.leipzig.de/webOPACClient/account.do'),
    false,
  );
  assert.equal(isLeipzigCatalogProxyTarget('https://example.org/webOPACClient/search.do'), false);
  assert.equal(isLeipzigCatalogProxyTarget('http://bibliothekskatalog.leipzig.de/webOPACClient/search.do'), false);

  const serverResolution = resolveCatalogProxyRequest(allowedUrl, {
    method: 'GET',
    headers: { Cookie: 'JSESSIONID=server' },
  });
  assert.equal(serverResolution.proxied, false);
  assert.equal(serverResolution.url, allowedUrl);

  installBrowserGlobals();
  try {
    const browserResolution = resolveCatalogProxyRequest(allowedUrl, {
      method: 'GET',
      headers: { Cookie: 'JSESSIONID=browser', Accept: 'text/html' },
    });
    assert.equal(browserResolution.proxied, true);
    assert.equal(browserResolution.url, `/api/catalog-proxy?url=${encodeURIComponent(allowedUrl)}`);
    const headers = new Headers(browserResolution.init.headers);
    assert.equal(headers.get('Cookie'), null);
    assert.equal(headers.get('X-OpenLib-Proxy-Cookie'), 'JSESSIONID=browser');
    assert.equal(headers.get('Accept'), 'text/html');

    let fetchedUrl = '';
    let fetchedCookie = '';
    globalThis.fetch = async (url, init) => {
      fetchedUrl = String(url);
      fetchedCookie = new Headers(init?.headers).get('X-OpenLib-Proxy-Cookie') ?? '';
      return new Response('ok', { status: 200 });
    };

    const body = await fetchTextWithRetry(allowedUrl, {
      method: 'GET',
      headers: { Cookie: 'JSESSIONID=fetch' },
    });

    assert.equal(body, 'ok');
    assert.equal(fetchedUrl, `/api/catalog-proxy?url=${encodeURIComponent(allowedUrl)}`);
    assert.equal(fetchedCookie, 'JSESSIONID=fetch');
  } finally {
    restoreBrowserGlobals();
    globalThis.fetch = originalFetch;
  }

  {
    const res = makeResponse();
    await catalogProxy(
      {
        method: 'POST',
        query: { url: allowedUrl },
        headers: {},
      },
      res,
    );
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'GET, HEAD');
  }

  {
    const res = makeResponse();
    await catalogProxy(
      {
        method: 'GET',
        query: { url: 'https://bibliothekskatalog.leipzig.de/webOPACClient/account.do' },
        headers: {},
      },
      res,
    );
    assert.equal(res.statusCode, 400);
  }

  {
    let upstreamUrl = '';
    let upstreamCookie = '';
    globalThis.fetch = async (url, init) => {
      upstreamUrl = String(url);
      upstreamCookie = new Headers(init?.headers).get('cookie') ?? '';
      return new Response('proxied', {
        status: 200,
        headers: {
          'content-type': 'text/html',
          'set-cookie': 'JSESSIONID=proxy; Path=/; HttpOnly',
        },
      });
    };

    try {
      const res = makeResponse();
      await catalogProxy(
        {
          method: 'GET',
          query: { url: allowedUrl },
          headers: {
            accept: 'text/html',
            'user-agent': 'catalog-proxy-test',
            'x-openlib-proxy-cookie': 'JSESSIONID=request',
          },
        },
        res,
      );

      assert.equal(res.statusCode, 200);
      assert.equal(upstreamUrl, allowedUrl);
      assert.equal(upstreamCookie, 'JSESSIONID=request');
      assert.equal(res.headers['content-type'], 'text/html');
      assert.equal(res.headers['x-openlib-proxy-set-cookie'], 'JSESSIONID=proxy; Path=/; HttpOnly');
      assert.equal(res.body.toString('utf8'), 'proxied');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
};

run().then(() => {
  console.log('catalog-proxy-routing-check: all assertions passed');
});
