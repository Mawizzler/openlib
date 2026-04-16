import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseLitteraSearchResults } from '@/src/infrastructure/opac/parsers/litteraParse';

const fixturePath = path.resolve(__dirname, 'fixtures/littera-search-sample.json');
const payload = fs.readFileSync(fixturePath, 'utf8');

const parsed = parseLitteraSearchResults(payload);

assert.equal(parsed.total, 2);
assert.equal(parsed.records.length, 2);
assert.equal(parsed.records[0].id, 'LT-100');
assert.equal(parsed.records[0].title, 'The Name of the Rose');
assert.equal(parsed.records[0].authors[0], 'Umberto Eco');
assert.equal(parsed.records[0].publishedYear, 1980);
assert.equal(parsed.records[0].detailUrl, 'https://catalog.example.org/record/LT-100');
assert.equal(parsed.records[1].id, '200');
assert.equal(parsed.records[1].authors[1], 'Translator Example');
assert.equal(parsed.records[1].publishedYear, 1979);

console.log('littera-parser-check: ok');
