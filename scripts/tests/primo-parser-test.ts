import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { parsePrimoSearchResults } from '@/src/infrastructure/opac/parsers/primo/parsePrimoSearchResults';

const fixturePath = resolve(process.cwd(), 'data/fixtures/primo/search-response.json');
const payload = readFileSync(fixturePath, 'utf8');

const result = parsePrimoSearchResults(payload, 'https://library.example.edu');

assert.equal(result.total, 42);
assert.equal(result.records.length, 1);
assert.equal(result.records[0]?.id, 'TN_cdi_proquest_journals_2540953012');
assert.equal(result.records[0]?.title, 'Library discovery at scale');
assert.deepEqual(result.records[0]?.authors, ['Jane Doe']);
assert.equal(result.records[0]?.publisher, 'Open Library Press');
assert.equal(result.records[0]?.publishedYear, 2024);
assert.equal(result.records[0]?.format, 'article');
assert.equal(result.records[0]?.language, 'eng');
assert.equal(result.records[0]?.source, 'cdi_proquest_journals');
assert.equal(result.records[0]?.detailUrl, 'https://resolver.example.org/doc/2540953012');

console.log('primo-parser-test: ok');
