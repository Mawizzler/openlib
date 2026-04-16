import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseAdisSearchResults } from '@/src/infrastructure/opac/parsers/adis/parseAdisSearchResults';

const fixturePath = path.resolve(__dirname, 'fixtures/adis-search-sample.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { total: number; records: unknown[] };

const parsed = parseAdisSearchResults(fixture, 'https://catalog.example.org');

assert.equal(parsed.total, 3);
assert.equal(parsed.records.length, 2);
assert.equal(parsed.records[0].id, 'A-1001');
assert.equal(parsed.records[0].title, 'Clean Architecture');
assert.deepEqual(parsed.records[0].authors, ['Robert C. Martin']);
assert.equal(parsed.records[0].publishedYear, 2017);
assert.equal(parsed.records[0].detailUrl, 'https://catalog.example.org/Record/A-1001');
assert.equal(parsed.records[1].id, 'A-1003');
assert.equal(parsed.records[1].detailUrl, 'https://catalog.example.org/custom/A-1003');

console.log('adis-parser-check: ok');
