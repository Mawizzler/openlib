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

const provider = (api: string, baseUrl = 'https://catalog.example.org/opac'): OpacappNormalizedProvider => ({
  id: `${api}-test`,
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
    const calls: Array<{ url: string; userAgent: string; acceptLanguage: string | null }> = [];
    globalThis.fetch = async (url, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(url),
        userAgent: headers.get('User-Agent') ?? '',
        acceptLanguage: headers.get('Accept-Language'),
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
      assert.equal(calls[0].userAgent, 'openlib-vufind-adapter');
      assert.equal(calls[1].userAgent, 'openlib-vufind-adapter');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
};

run().then(() => {
  console.log('adapter-fallback-routes-check: all assertions passed');
});
