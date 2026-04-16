import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseTouchpointSearchResults } from '@/src/infrastructure/opac/parsers/touchpoint/parseTouchpointSearchResults';

const fixturePath = path.resolve(__dirname, 'fixtures/touchpoint-search-sample.html');
const payload = fs.readFileSync(fixturePath, 'utf8');

const parsed = parseTouchpointSearchResults(payload, 'https://katalog.example.org/TouchPoint');

assert.equal(parsed.total, 2);
assert.equal(parsed.records.length, 2);
assert.equal(parsed.records[0].id, 'HT0001');
assert.equal(parsed.records[0].title, 'The Pragmatic Programmer');
assert.equal(
  parsed.records[0].detailUrl,
  'https://katalog.example.org/TouchPoint/search.do?methodToCall=showHit&curPos=1&id=HT0001',
);
assert.equal(parsed.records[0].authors[0], 'Hunt');
assert.equal(parsed.records[0].publishedYear, 1999);
assert.equal(parsed.records[1].id, 'HT0002');
assert.equal(parsed.records[1].title, 'Clean Code');
assert.equal(parsed.records[1].publishedYear, 2008);

const payloadWithEntity = payload.replace(
  'search.do?methodToCall=showHit&curPos=1&id=HT0001',
  'search.do?methodToCall=showHit&amp;curPos=1&amp;id=HT0001',
);
const parsedEntity = parseTouchpointSearchResults(payloadWithEntity, 'https://katalog.example.org/TouchPoint');
assert.equal(
  parsedEntity.records[0].detailUrl,
  'https://katalog.example.org/TouchPoint/search.do?methodToCall=showHit&curPos=1&id=HT0001',
);

console.log('touchpoint-parser-check: ok');
