import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseOpenSearchResults } from '@/src/infrastructure/opac/parsers/open/parseOpenSearchResults';

const fixturePath = path.resolve(__dirname, 'fixtures/open-search-sample.json');
const payload = fs.readFileSync(fixturePath, 'utf8');

const parsed = parseOpenSearchResults(payload);

assert.equal(parsed.total, 2);
assert.equal(parsed.records.length, 2);
assert.equal(parsed.records[0].id, '/works/OL45804W');
assert.equal(parsed.records[0].title, 'The Fellowship of the Ring');
assert.equal(parsed.records[0].detailUrl, 'https://openlibrary.org/works/OL45804W');
assert.equal(parsed.records[0].identifiers?.[0]?.system, 'isbn');
assert.equal(parsed.records[1].id, 'OL26331930M');
assert.equal(parsed.records[1].detailUrl, 'https://openlibrary.org/books/OL26331930M');

console.log('open-parser-check: ok');
