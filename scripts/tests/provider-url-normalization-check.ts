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

console.log('provider-url-normalization-check: all assertions passed');
