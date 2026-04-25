import assert from 'node:assert/strict';

import { normalizeProviderBaseUrl } from '../provider-url-normalization';

const normalizedTrimQuotes = normalizeProviderBaseUrl('  "https://example.org/opac"  ');
assert.equal(normalizedTrimQuotes.normalizedUrl, 'https://example.org/opac');
assert.ok(
  normalizedTrimQuotes.reasons.includes('trimmed surrounding whitespace/quotes'),
  'expected trim/quote reason for quoted URL',
);

const normalizedDuplicateScheme = normalizeProviderBaseUrl('https://https://example.org/opac');
assert.equal(normalizedDuplicateScheme.normalizedUrl, 'https://example.org/opac');
assert.ok(
  normalizedDuplicateScheme.reasons.includes('repaired duplicate URL scheme prefix'),
  'expected duplicate-scheme repair reason',
);

const invalidSyntax = normalizeProviderBaseUrl('https://exa mple.org/opac');
assert.equal(invalidSyntax.normalizedUrl, null);
assert.ok(
  invalidSyntax.reasons.includes('invalid URL syntax'),
  'expected invalid URL syntax reason',
);

const unsupportedProtocol = normalizeProviderBaseUrl('ftp://example.org/opac');
assert.equal(unsupportedProtocol.normalizedUrl, null);
assert.ok(
  unsupportedProtocol.reasons.includes('unsupported URL scheme: ftp:'),
  'expected unsupported protocol reason',
);

const rewrittenKivbf = normalizeProviderBaseUrl('https://bibliotheken.kivbf.de/opax/de/qis-start.hp');
assert.equal(rewrittenKivbf.normalizedUrl, 'https://bibliotheken.komm.one/opax/de/qis-start.hp');
assert.equal(rewrittenKivbf.rewritten, true);
assert.equal(rewrittenKivbf.rewriteFromHost, 'bibliotheken.kivbf.de');
assert.equal(rewrittenKivbf.rewriteToHost, 'bibliotheken.komm.one');
assert.ok(
  rewrittenKivbf.reasons.includes('rewrote deterministic redirect-family host: bibliotheken.kivbf.de -> bibliotheken.komm.one'),
  'expected deterministic redirect-family rewrite reason',
);

const canonicalKommOne = normalizeProviderBaseUrl('https://bibliothek.komm.one/webOPACClient/search.do');
assert.equal(canonicalKommOne.normalizedUrl, 'https://bibliothek.komm.one/webOPACClient/search.do');
assert.equal(canonicalKommOne.rewritten, false);
assert.ok(
  canonicalKommOne.reasons.includes('kept canonical bibliothek.komm.one host'),
  'expected canonical bibliothek.komm.one reason',
);

const lmsLikeNoRewrite = normalizeProviderBaseUrl('https://stadtbibliothek-cms.lmscloud.net/app');
assert.equal(lmsLikeNoRewrite.normalizedUrl, 'https://stadtbibliothek-cms.lmscloud.net/app');
assert.equal(lmsLikeNoRewrite.rewritten, false);
assert.ok(
  lmsLikeNoRewrite.reasons.includes('non-deterministic LMS/CMS-like host; no rewrite applied'),
  'expected non-rewrite LMS/CMS reason',
);

const rewrittenLeipzig = normalizeProviderBaseUrl('https://webopac.stadtbibliothek-leipzig.de/start.do', {
  api: 'sisis',
  providerId: '8714',
});
assert.equal(rewrittenLeipzig.normalizedUrl, 'https://bibliothekskatalog.leipzig.de/');
assert.equal(rewrittenLeipzig.rewritten, true);
assert.equal(rewrittenLeipzig.rewriteFromHost, 'webopac.stadtbibliothek-leipzig.de');
assert.equal(rewrittenLeipzig.rewriteToHost, 'bibliothekskatalog.leipzig.de');
assert.ok(
  rewrittenLeipzig.reasons.includes(
    'rewrote deterministic redirect-family host: webopac.stadtbibliothek-leipzig.de -> bibliothekskatalog.leipzig.de',
  ),
  'expected Leipzig deterministic host rewrite reason',
);
assert.ok(
  rewrittenLeipzig.reasons.includes('stripped sisis API endpoint path from base URL'),
  'expected SISIS endpoint strip reason',
);

const strippedPrimo = normalizeProviderBaseUrl('https://catalog.example.edu/primo_library/libweb/action/search.do?vid=default', {
  api: 'primo',
  providerId: 'primo-test',
});
assert.equal(strippedPrimo.normalizedUrl, 'https://catalog.example.edu/');
assert.ok(
  strippedPrimo.reasons.includes('stripped primo API endpoint path from base URL'),
  'expected Primo endpoint strip reason',
);

const strippedKoha = normalizeProviderBaseUrl('https://koha.example.org/cgi-bin/koha/opac-search.pl?q=test', {
  api: 'koha',
  providerId: 'koha-test',
});
assert.equal(strippedKoha.normalizedUrl, 'https://koha.example.org/');
assert.ok(
  strippedKoha.reasons.includes('stripped koha API endpoint path from base URL'),
  'expected Koha endpoint strip reason',
);

const strippedWebOpacNet = normalizeProviderBaseUrl('https://webopac.example.org/search.aspx?STICHWORT=test', {
  api: 'webopacnet',
  providerId: 'webopac-test',
});
assert.equal(strippedWebOpacNet.normalizedUrl, 'https://webopac.example.org/');
assert.ok(
  strippedWebOpacNet.reasons.includes('stripped webopac.net API endpoint path from base URL'),
  'expected webopac.net endpoint strip reason',
);

const strippedOpenSearchJson = normalizeProviderBaseUrl('https://open.example.org/search.json?q=test', {
  api: 'open',
  providerId: 'open-test',
});
assert.equal(strippedOpenSearchJson.normalizedUrl, 'https://open.example.org/');
assert.ok(
  strippedOpenSearchJson.reasons.includes('stripped open API endpoint path from base URL'),
  'expected Open search.json endpoint strip reason',
);

const strippedOpenMediensuche = normalizeProviderBaseUrl('https://open.example.org/Mediensuche/EinfacheSuche.aspx', {
  api: 'open',
  providerId: 'open-test',
});
assert.equal(strippedOpenMediensuche.normalizedUrl, 'https://open.example.org/');

const strippedAdis = normalizeProviderBaseUrl('https://adis.example.org/api/search?query=test', {
  api: 'adis',
  providerId: 'adis-test',
});
assert.equal(strippedAdis.normalizedUrl, 'https://adis.example.org/');
assert.ok(
  strippedAdis.reasons.includes('stripped adis API endpoint path from base URL'),
  'expected ADIS endpoint strip reason',
);

console.log('provider-url-normalization-check: all assertions passed');
