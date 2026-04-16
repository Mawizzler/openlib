import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parsePicaSearchResults } from '@/src/infrastructure/opac/parsers/pica/parsePicaSearchResults';

const fixturePath = path.resolve(__dirname, 'fixtures/pica-search-sample.json');
const payload = fs.readFileSync(fixturePath, 'utf8');

const parsed = parsePicaSearchResults(payload, 'https://opac.example.org');

assert.equal(parsed.total, 2);
assert.equal(parsed.records.length, 2);
assert.equal(parsed.records[0].id, 'PPN123456789');
assert.equal(parsed.records[0].title, 'Der Zauberberg');
assert.equal(parsed.records[0].authors[0], 'Thomas Mann');
assert.equal(parsed.records[0].publishedYear, 1924);
assert.equal(parsed.records[0].detailUrl, 'https://opac.example.org/DB=2.1/PPNSET?PPN=PPN123456789');
assert.equal(parsed.records[0].identifiers?.[0]?.system, 'isbn');
assert.equal(parsed.records[1].publishedYear, 1901);

console.log('pica-parser-check: ok');
