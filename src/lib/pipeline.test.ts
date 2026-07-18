import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, segment, type Overrides } from './pipeline.ts';

const S = { glides: false, medialUnit: false };
const noOv: Overrides = new Map();

test('mejuah-juah with hyphen preserved (definition of done)', () => {
  assert.equal(convert('mejuah-juah', noOv, S).text, 'ᯔᯧᯐᯬᯀᯱ-ᯐᯬᯀᯱ');
});

test('punctuation and whitespace pass through', () => {
  assert.equal(convert('man, man!', noOv, S).text, 'ᯔᯉ᯳, ᯔᯉ᯳!');
});

test('per-word e override flips pepet to taling', () => {
  const { parts } = segment('mejuah');
  const ov: Overrides = new Map([[parts[0].id, new Map([[1, 'taling' as const]])]]);
  assert.equal(convert('mejuah', ov, S).text, 'ᯔᯩᯐᯬᯀᯱ');
  const w = convert('mejuah', ov, S).words[0];
  assert.equal(w.eVowels[0].reading, 'taling');
  assert.equal(w.eVowels[0].explicit, true);
});

test('plain e marked as assumed pepet', () => {
  const w = convert('mejuah', noOv, S).words[0];
  assert.deepEqual(w.eVowels, [{ index: 1, reading: 'pepet', explicit: false }]);
});

test('foreign letters adapted and flagged', () => {
  const w = convert('vaksin', noOv, S).words[0];
  assert.equal(w.adapted, true);
  assert.equal(w.converted, 'baksin');
});

test('unconvertible token passes through with error', () => {
  const out = convert('man 123', noOv, S);
  assert.equal(out.text, 'ᯔᯉ᯳ 123');
});
