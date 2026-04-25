import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

const routeUrls = (system: Parameters<typeof buildAdapterFallbackRoutes>[0]['system']) =>
  buildAdapterFallbackRoutes({
    system,
    baseUrl: 'https://catalog.example.org/opac/search.aspx',
    query: 'climate',
    page: 2,
    pageSize: 20,
    providerId: system === 'sisis' ? '8714' : `${system}-test`,
  }).candidates.map((candidate) => candidate.url);

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

  assert.equal(
    routeUrls('sisis')[0],
    'https://catalog.example.org/start.do?sourceid=ConQuery&Login=stabi00&Query=-1+%3D+%22climate%22',
  );
  assert.ok(routeUrls('sisis').some((url) => url.includes('/search.do?methodToCall=submit')));
  assert.ok(routeUrls('primo')[0].includes('/primo_library/libweb/action/search.do?fn=search'));
  assert.ok(routeUrls('adis').some((url) => url.includes('/api/search?')));
  assert.ok(routeUrls('koha')[0].includes('/cgi-bin/koha/opac-search.pl?q=climate&idx=kw'));

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
};

run().then(() => {
  console.log('adapter-fallback-routes-check: all assertions passed');
});
