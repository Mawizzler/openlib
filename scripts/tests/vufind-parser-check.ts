import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseVuFindSearchResults } from '@/src/infrastructure/opac/parsers/vufind/parseVuFindSearchResults';

const fixturePath = path.resolve(__dirname, 'fixtures/vufind-search-sample.html');
const payload = readFileSync(fixturePath, 'utf8');

const parsed = parseVuFindSearchResults(payload, 'https://vufind.example.org');

assert.equal(parsed.total, 24);
assert.equal(parsed.records.length, 2);
assert.equal(parsed.records[0].id, '123456');
assert.equal(parsed.records[0].title, 'Domain-Driven Design');
assert.deepEqual(parsed.records[0].authors, ['Eric Evans']);
assert.equal(parsed.records[0].format, 'Book');
assert.equal(parsed.records[0].publishedYear, 2003);
assert.equal(parsed.records[0].detailUrl, 'https://vufind.example.org/Record/123456');
assert.equal(
  parsed.records[0].coverUrl,
  'https://vufind.example.org/Cover/Show?size=small&id=123456',
);

assert.equal(parsed.records[1].id, '654321');
assert.equal(parsed.records[1].title, 'Working Effectively with Legacy Code');
assert.deepEqual(parsed.records[1].authors, ['Michael Feathers']);
assert.equal(parsed.records[1].format, 'Book');
assert.equal(parsed.records[1].publishedYear, 2004);
assert.equal(parsed.records[1].detailUrl, 'https://vufind.example.org/Record/654321');

console.log('vufind-parser-check: ok');
