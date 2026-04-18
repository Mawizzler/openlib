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

console.log('provider-url-normalization-check: all assertions passed');
