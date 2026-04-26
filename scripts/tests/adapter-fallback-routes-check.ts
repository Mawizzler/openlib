import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AdisAdapter } from '@/src/infrastructure/opac/adapters/AdisAdapter';
import { VuFindAdapter } from '@/src/infrastructure/opac/adapters/VuFindAdapter';
import { WebOpacNetAdapter } from '@/src/infrastructure/opac/adapters/WebOpacNetAdapter';
import {
  buildAdapterFallbackRoutes,
  isHttp404Error,
  uniqueUrlCandidates,
} from '@/src/infrastructure/opac/transport/adapterFallbackRoutes';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';

const provider = (
  api: string,
  baseUrl = 'https://catalog.example.org/opac',
  id = `${api}-test`,
): OpacappNormalizedProvider => ({
  id,
  title: `${api} Test`,
  api,
  baseUrl,
  authHint: 'none',
  source: {
    repository: 'local',
    path: 'scripts/tests',
    file: 'adapter-fallback-routes-check.ts',
    ref: 'HEAD',
  },
});

const routeCandidates = (
  system: Parameters<typeof buildAdapterFallbackRoutes>[0]['system'],
  baseUrl = 'https://catalog.example.org/opac/search.aspx',
  providerId = system === 'sisis' ? '8714' : `${system}-test`,
) =>
  buildAdapterFallbackRoutes({
    system,
    baseUrl,
    query: 'climate',
    page: 2,
    pageSize: 20,
    providerId,
  }).candidates;

const routeUrls = (
  system: Parameters<typeof buildAdapterFallbackRoutes>[0]['system'],
  baseUrl = 'https://catalog.example.org/opac/search.aspx',
  providerId = system === 'sisis' ? '8714' : `${system}-test`,
) => routeCandidates(system, baseUrl, providerId).map((candidate) => candidate.url);

const run = async () => {
  assert.deepEqual(uniqueUrlCandidates(['a', 'b', 'a', ' ', 'c']), ['a', 'b', 'c']);
  assert.deepEqual(
    uniqueUrlCandidates([
      { route: 'first', url: 'https://example.org/search' },
      { route: 'duplicate', url: 'https://example.org/search' },
      { route: 'second', url: 'https://example.org/search?q=x' },
    ]).map((candidate) => candidate.route),
    ['first', 'second'],
  );

  assert.equal(
    isHttp404Error(new Error('Fetch failed after 1 attempt(s) for https://example.org/missing with HTTP 404')),
    true,
  );
  assert.equal(isHttp404Error(new Error('Fetch failed after 1 attempt(s) status=404: missing')), true);
  assert.equal(isHttp404Error(new Error('Fetch failed after 2 attempt(s) with HTTP 503')), false);

  assert.deepEqual(routeUrls('open'), [
    'https://catalog.example.org/search.json?q=climate&page=2&limit=20',
    'https://catalog.example.org/Mediensuche/EinfacheSuche.aspx?search=climate',
    'https://catalog.example.org/Mediensuche/Einfache-Suche?search=climate',
  ]);

  assert.deepEqual(routeUrls('webopac.net'), [
    'https://catalog.example.org/search.aspx?STICHWORT=climate&Seite=2',
    'https://catalog.example.org/search.aspx?SEARCHTERM=climate&Seite=2',
    'https://catalog.example.org/search.aspx?AKT_VALUE=climate&Seite=2',
  ]);

  assert.deepEqual(routeUrls('open', 'http://catalog.example.org/opac/search.aspx'), [
    'https://catalog.example.org/search.json?q=climate&page=2&limit=20',
    'https://catalog.example.org/Mediensuche/EinfacheSuche.aspx?search=climate',
    'https://catalog.example.org/Mediensuche/Einfache-Suche?search=climate',
    'http://catalog.example.org/search.json?q=climate&page=2&limit=20',
    'http://catalog.example.org/Mediensuche/EinfacheSuche.aspx?search=climate',
    'http://catalog.example.org/Mediensuche/Einfache-Suche?search=climate',
  ]);
  assert.deepEqual(routeUrls('webopac.net', 'http://catalog.example.org/opac/search.aspx'), [
    'https://catalog.example.org/search.aspx?STICHWORT=climate&Seite=2',
    'https://catalog.example.org/search.aspx?SEARCHTERM=climate&Seite=2',
    'https://catalog.example.org/search.aspx?AKT_VALUE=climate&Seite=2',
    'http://catalog.example.org/search.aspx?STICHWORT=climate&Seite=2',
    'http://catalog.example.org/search.aspx?SEARCHTERM=climate&Seite=2',
    'http://catalog.example.org/search.aspx?AKT_VALUE=climate&Seite=2',
  ]);
  const primoHttpRoutes = routeUrls('primo', 'http://catalog.example.org/opac/search.aspx');
  assert.equal(primoHttpRoutes.length, 4);
  assert.ok(primoHttpRoutes[0].startsWith('https://'));
  assert.ok(primoHttpRoutes[1].startsWith('https://'));
  assert.ok(primoHttpRoutes[2].startsWith('http://'));
  assert.ok(primoHttpRoutes[3].startsWith('http://'));

  const leipzigSisisRoutes = routeUrls('sisis', 'https://bibliothekskatalog.leipzig.de/webOPACClient', '8714');
  assert.equal(
    leipzigSisisRoutes[0],
    'https://bibliothekskatalog.leipzig.de/webOPACClient/start.do?sourceid=ConQuery&Login=stabi00&Query=-1+%3D+%22climate%22',
  );
  assert.ok(leipzigSisisRoutes.some((url) => url.includes('/webOPACClient/search.do?methodToCall=submit')));

  const genericSisisRoutes = routeUrls('sisis', 'https://catalog.example.org/opac/search.aspx', 'sisis-test');
  assert.equal(genericSisisRoutes[0], 'https://catalog.example.org/search.do?methodToCall=submit&searchCategories%5B0%5D=all&searchString%5B0%5D=climate');
  assert.ok(routeUrls('primo')[0].includes('/primo_library/libweb/action/search.do?fn=search'));
  assert.ok(routeUrls('adis').some((url) => url.includes('/api/search?')));
  assert.ok(routeUrls('koha')[0].includes('/cgi-bin/koha/opac-search.pl?q=climate&idx=kw'));

  const sisisHttpRoutes = routeUrls('sisis', 'http://catalog.example.org/opac/search.aspx', 'sisis-test');
  assert.equal(sisisHttpRoutes.length, 3);
  assert.ok(sisisHttpRoutes.every((url) => url.startsWith('http://')));

  const adisHttpRoutes = routeUrls('adis', 'http://catalog.example.org/opac/search.aspx');
  assert.equal(adisHttpRoutes.length, 16);
  assert.ok(adisHttpRoutes.every((url) => url.startsWith('http://')));
  const adisProvider9023Routes = routeUrls('adis', 'https://catalog.example.org/aDISWeb/app', '9023');
  assert.equal(adisProvider9023Routes.length, 16);
  assert.ok(
    adisProvider9023Routes.every((url) => new URL(url).pathname.startsWith('/aDISWeb/app')),
    'expected provider 9023 ADIS routes to keep aDISWeb app path',
  );
  assert.equal(
    adisProvider9023Routes[0],
    'https://catalog.example.org/aDISWeb/app/?service=direct%2F0%2FHome%2F%24SearchForm&sp=SOPAC00&sp=SAKFreitext+Sclimate',
  );
  const first9023Url = new URL(adisProvider9023Routes[0]);
  assert.deepEqual(first9023Url.searchParams.getAll('sp'), ['SOPAC00', 'SAKFreitext Sclimate']);
  assert.equal(first9023Url.searchParams.get('service'), 'direct/0/Home/$SearchForm');
  assert.equal(first9023Url.searchParams.get('searchMask'), null);
  assert.equal(first9023Url.searchParams.get('XSLT_DB'), null);
  assert.ok(
    adisProvider9023Routes.some((url) => {
      const parsed = new URL(url);
      return (
        parsed.searchParams.get('service') === 'direct/0/Home/$SearchForm' &&
        parsed.searchParams.get('XSLT_DB') === '1' &&
        parsed.searchParams.getAll('sp')[0] === 'SOPAC00'
      );
    }),
    'expected provider 9023 ADIS routes to include XSLT_DB=1 SOPAC00 combined variant',
  );
  const adisNon9023Routes = routeUrls('adis', 'https://catalog.example.org/aDISWeb/app', '9010');
  assert.ok(
    adisNon9023Routes.every((url) => !new URL(url).pathname.startsWith('/aDISWeb/app/')),
    'expected non-9023 ADIS routes to keep existing root-relative behavior',
  );
  assert.equal(adisNon9023Routes[0], 'https://catalog.example.org/search.json?q=climate&page=2&limit=20');

  const kohaHttpRoutes = routeUrls('koha', 'http://catalog.example.org/opac/search.aspx');
  assert.equal(kohaHttpRoutes.length, 3);
  assert.ok(kohaHttpRoutes.every((url) => url.startsWith('http://')));

  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const fixture = readFileSync('scripts/fixtures/webopacnet-search-sample.html', 'utf8');

  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) {
      return new Response('missing', { status: 404 });
    }
    return new Response(fixture, { status: 200 });
  };

  try {
    const adapter = new WebOpacNetAdapter(provider('webopac.net'));
    const result = await adapter.search({ query: 'climate', page: 1 });
    assert.equal(result.records.length, 2);
    assert.equal(calls.length, 2);
    assert.ok(calls[0].includes('STICHWORT=climate'));
    assert.ok(calls[1].includes('SEARCHTERM=climate'));
  } finally {
    globalThis.fetch = originalFetch;
  }

  {
    const calls: string[] = [];
    globalThis.fetch = async (url) => {
      const target = String(url);
      calls.push(target);
      const pathname = new URL(target).pathname;
      if (pathname !== '/Search/Results') {
        return new Response('missing', { status: 404 });
      }

      return new Response('{"total":1,"records":[{"id":"adis-1","title":"Climate"}]}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    try {
      const adapter = new AdisAdapter(provider('adis'));
      const result = await adapter.search({ query: 'climate', page: 1 });
      assert.equal(result.records.length, 1);
      assert.equal(calls.length, 4, 'expected one ADIS 404 attempt per pathname family');
      assert.deepEqual(
        calls.map((entry) => new URL(entry).pathname),
        ['/search.json', '/search', '/api/search', '/Search/Results'],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  {
    const calls: Array<{
      url: string;
      method: string;
      cookie: string | null;
      contentType: string | null;
      body: URLSearchParams;
    }> = [];
    globalThis.fetch = async (url, init) => {
      const target = String(url);
      const headers = new Headers(init?.headers);
      const bodyText = init?.body ? String(init.body) : '';
      const body = new URLSearchParams(bodyText);
      calls.push({
        url: target,
        method: init?.method ?? 'GET',
        cookie: headers.get('Cookie'),
        contentType: headers.get('Content-Type'),
        body,
      });

      if (calls.length === 1) {
        return new Response(
          `
          <html><body>
            <meta http-equiv="refresh" content="0; URL=/aDISWeb/app?service=direct/0/Home/$SearchForm&amp;sp=SOPAC00" />
            <a href="/aDISWeb/app?service=direct/0/Home/$SearchForm&amp;sp=SOPAC00">Continue</a>
          </body></html>
          `,
          {
            status: 200,
            headers: { 'x-openlib-proxy-set-cookie': 'SID=boot; Path=/; HttpOnly' },
          },
        );
      }

      if (calls.length === 2) {
        return new Response(
          `
          <html><body>
            <form action="/aDISWeb/app?service=direct/1/Home/$SearchForm.form&amp;sp=SFORM" method="post">
              <input type="hidden" name="formToken" value="token-1" />
              <input type="hidden" name="LNG" value="DU" />
            </form>
          </body></html>
          `,
          {
            status: 200,
            headers: { 'set-cookie': 'SID=handoff; Path=/; HttpOnly' },
          },
        );
      }

      if (calls.length === 3) {
        return new Response('missing', {
          status: 404,
          headers: { 'set-cookie': 'SID=next; Path=/; HttpOnly' },
        });
      }

      if (calls.length === 4) {
        return new Response('missing', { status: 404 });
      }

      return new Response('{"total":1,"records":[{"id":"adis-9023","title":"Climate"}]}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    try {
      const adapter = new AdisAdapter(
        provider('adis', 'https://catalog.example.org/aDISWeb/app', '9023'),
      );
      const result = await adapter.search({ query: 'climate', page: 1 });
      assert.equal(result.records.length, 1);
      assert.equal(calls.length, 5, 'expected bootstrap handoff GETs then POST fallback attempts for 9023 ADIS');
      assert.equal(calls[0].method, 'GET');
      assert.equal(calls[0].url, 'https://catalog.example.org/aDISWeb/app');
      assert.equal(calls[0].cookie, null);
      assert.equal(calls[1].method, 'GET');
      assert.equal(calls[1].url, 'https://catalog.example.org/aDISWeb/app?service=direct/0/Home/$SearchForm&sp=SOPAC00');
      assert.equal(calls[1].cookie, 'SID=boot');
      assert.equal(calls[2].method, 'POST');
      assert.equal(calls[3].method, 'POST');
      assert.equal(calls[4].method, 'POST');
      assert.ok(calls.slice(2).every((entry) => entry.contentType === 'application/x-www-form-urlencoded'));
      assert.ok(calls.slice(2).every((entry) => new URL(entry.url).pathname.startsWith('/aDISWeb/app')));
      assert.deepEqual(
        calls.slice(2).map((entry) => entry.body.get('service')),
        ['direct/0/Home/$SearchForm', 'direct/0/Home/$SearchForm', 'direct/0/Home/$DirectLink'],
      );
      assert.equal(calls[2].cookie, 'SID=handoff');
      assert.equal(calls[3].cookie, 'SID=next');
      assert.equal(calls[4].cookie, 'SID=next');
      assert.ok(calls.slice(2).every((entry) => entry.body.get('formToken') === 'token-1'));
      assert.ok(calls.slice(2).every((entry) => entry.body.get('LNG') === 'DU'));
      assert.deepEqual(calls[2].body.getAll('sp'), ['SOPAC00', 'SAKFreitext Sclimate']);
      assert.deepEqual(calls[3].body.getAll('sp'), ['SOPAC00', 'SAKSW Sclimate']);
      assert.deepEqual(calls[4].body.getAll('sp'), ['SOPAC00', 'SAKFreitext Sclimate']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  {
    const calls: Array<{
      url: string;
      userAgent: string;
      acceptLanguage: string | null;
      origin: string | null;
      referer: string | null;
      secFetchDest: string | null;
      secFetchMode: string | null;
      secFetchSite: string | null;
      secFetchUser: string | null;
    }> = [];
    globalThis.fetch = async (url, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(url),
        userAgent: headers.get('User-Agent') ?? '',
        acceptLanguage: headers.get('Accept-Language'),
        origin: headers.get('Origin'),
        referer: headers.get('Referer'),
        secFetchDest: headers.get('Sec-Fetch-Dest'),
        secFetchMode: headers.get('Sec-Fetch-Mode'),
        secFetchSite: headers.get('Sec-Fetch-Site'),
        secFetchUser: headers.get('Sec-Fetch-User'),
      });
      if (calls.length === 1) {
        return new Response('expired', { status: 419 });
      }
      return new Response('<html><body><div class="result"><a href="/Record/1">Hit</a></div></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    };

    try {
      const adapter = new VuFindAdapter(provider('vufind', 'https://vufind.example.org'));
      const result = await adapter.search({ query: 'climate', page: 1 });
      assert.equal(result.records.length, 1);
      assert.equal(calls.length, 2, 'expected exactly one retry after HTTP 419');
      assert.equal(calls[0].acceptLanguage, null);
      assert.equal(calls[1].acceptLanguage, 'en-US,en;q=0.9');
      assert.equal(calls[0].origin, null);
      assert.equal(calls[1].origin, null);
      assert.equal(calls[0].referer, null);
      assert.equal(calls[1].referer, null);
      assert.equal(calls[0].secFetchDest, null);
      assert.equal(calls[1].secFetchDest, null);
      assert.equal(calls[0].secFetchMode, null);
      assert.equal(calls[1].secFetchMode, null);
      assert.equal(calls[0].secFetchSite, null);
      assert.equal(calls[1].secFetchSite, null);
      assert.equal(calls[0].secFetchUser, null);
      assert.equal(calls[1].secFetchUser, null);
      assert.equal(calls[0].userAgent, 'openlib-vufind-adapter');
      assert.equal(calls[1].userAgent, 'openlib-vufind-adapter');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  {
    const calls: Array<{
      url: string;
      userAgent: string;
      acceptLanguage: string | null;
      cookie: string | null;
      origin: string | null;
      referer: string | null;
      secFetchDest: string | null;
      secFetchMode: string | null;
      secFetchSite: string | null;
      secFetchUser: string | null;
    }> = [];
    globalThis.fetch = async (url, init) => {
      const target = String(url);
      const headers = new Headers(init?.headers);
      calls.push({
        url: target,
        userAgent: headers.get('User-Agent') ?? '',
        acceptLanguage: headers.get('Accept-Language'),
        cookie: headers.get('Cookie'),
        origin: headers.get('Origin'),
        referer: headers.get('Referer'),
        secFetchDest: headers.get('Sec-Fetch-Dest'),
        secFetchMode: headers.get('Sec-Fetch-Mode'),
        secFetchSite: headers.get('Sec-Fetch-Site'),
        secFetchUser: headers.get('Sec-Fetch-User'),
      });

      const pathname = new URL(target).pathname;
      if (calls.length === 1) {
        assert.equal(pathname, '/');
        return new Response('warmup', {
          status: 200,
          headers: { 'x-openlib-proxy-set-cookie': 'SESSION=initial; Path=/; HttpOnly' },
        });
      }

      if (calls.length === 2) {
        assert.equal(pathname, '/Search/Results');
        return new Response(
          '<script>document.cookie="finc_open=1; path=/";location.reload();</script>',
          { status: 419 },
        );
      }

      if (calls.length === 3) {
        assert.equal(pathname, '/');
        return new Response('warmup-refresh', {
          status: 200,
          headers: { 'set-cookie': 'SESSION=refreshed; Path=/; HttpOnly' },
        });
      }

      return new Response('<html><body><div class="result"><a href="/Record/9051">Hit</a></div></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    };

    try {
      const adapter = new VuFindAdapter(provider('vufind', 'https://vufind.example.org', '9051'));
      const result = await adapter.search({ query: 'climate', page: 1 });
      assert.equal(result.records.length, 1);
      assert.equal(calls.length, 4, 'expected warmup + search + refresh warmup + retry');
      assert.deepEqual(
        calls.map((entry) => new URL(entry.url).pathname),
        ['/', '/Search/Results', '/', '/Search/Results'],
      );
      assert.equal(calls[0].cookie, null);
      assert.equal(calls[1].cookie, 'SESSION=initial');
      assert.equal(calls[2].cookie, 'SESSION=initial; finc_open=1');
      assert.equal(calls[3].cookie, 'SESSION=refreshed; finc_open=1');
      assert.equal(calls[0].acceptLanguage, 'en-US,en;q=0.9');
      assert.equal(calls[1].acceptLanguage, 'en-US,en;q=0.9');
      assert.equal(calls[2].acceptLanguage, 'en-US,en;q=0.9');
      assert.equal(calls[3].acceptLanguage, 'en-US,en;q=0.9');
      assert.equal(calls[0].origin, 'https://vufind.example.org');
      assert.equal(calls[1].origin, 'https://vufind.example.org');
      assert.equal(calls[2].origin, 'https://vufind.example.org');
      assert.equal(calls[3].origin, 'https://vufind.example.org');
      assert.equal(calls[0].referer, 'https://vufind.example.org/');
      assert.equal(calls[1].referer, 'https://vufind.example.org/');
      assert.equal(calls[2].referer, 'https://vufind.example.org/');
      assert.equal(calls[3].referer, 'https://vufind.example.org/');
      assert.equal(calls[0].secFetchDest, 'document');
      assert.equal(calls[1].secFetchDest, 'document');
      assert.equal(calls[2].secFetchDest, 'document');
      assert.equal(calls[3].secFetchDest, 'document');
      assert.equal(calls[0].secFetchMode, 'navigate');
      assert.equal(calls[1].secFetchMode, 'navigate');
      assert.equal(calls[2].secFetchMode, 'navigate');
      assert.equal(calls[3].secFetchMode, 'navigate');
      assert.equal(calls[0].secFetchSite, 'same-origin');
      assert.equal(calls[1].secFetchSite, 'same-origin');
      assert.equal(calls[2].secFetchSite, 'same-origin');
      assert.equal(calls[3].secFetchSite, 'same-origin');
      assert.equal(calls[0].secFetchUser, '?1');
      assert.equal(calls[1].secFetchUser, '?1');
      assert.equal(calls[2].secFetchUser, '?1');
      assert.equal(calls[3].secFetchUser, '?1');
      assert.equal(calls[0].userAgent, 'openlib-vufind-adapter');
      assert.equal(calls[1].userAgent, 'openlib-vufind-adapter');
      assert.equal(calls[2].userAgent, 'openlib-vufind-adapter');
      assert.equal(calls[3].userAgent, 'openlib-vufind-adapter');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
};

run().then(() => {
  console.log('adapter-fallback-routes-check: all assertions passed');
});
