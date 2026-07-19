import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fromOpenLexicon,
  lookupSmart,
  affixHint,
  lookup,
  lookupPhrase,
  suggest,
  caveats,
  normalize,
} from './kamus.ts';

const raw = JSON.parse(readFileSync(new URL('../data/lexicon.json', import.meta.url), 'utf8'));
const kamus = fromOpenLexicon(raw);

test('lexicon loads with every entry transliterated or explicitly null', () => {
  assert.ok(kamus.headwords > 250, `only ${kamus.headwords} headwords`);
  for (const hits of kamus.entries.values()) {
    for (const h of hits) {
      assert.ok(h.aksara === null || /[ᯀ-᯿]/.test(h.aksara), `bad aksara for ${h.karo}`);
    }
  }
});

test('lookup: Indonesian → Karo → Aksara', () => {
  const e = lookup(kamus, 'makan');
  assert.ok(e, 'makan should be present');
  assert.ok(e!.hits.some((h) => h.karo === 'man' && h.aksara === 'ᯔᯉ᯳'));
});

test('lookup is case- and whitespace-insensitive', () => {
  assert.ok(lookup(kamus, '  MAKAN '));
  assert.equal(normalize('  Terima   Kasih '), 'terima kasih');
});

test('absent word returns null, not a guess', () => {
  assert.equal(lookup(kamus, 'kuantum'), null);
});

test('multi-word Indonesian headwords resolve', () => {
  const e = lookup(kamus, 'terima kasih');
  assert.ok(e && e.hits.some((h) => h.karo === 'bujur'));
});

test('phrase lookup matches multi-word headwords greedily', () => {
  const toks = lookupPhrase(kamus, 'terima kasih makan');
  const words = toks.filter((t) => t.isWord);
  assert.equal(words.length, 2, 'terima kasih must fuse into one token');
  assert.ok(words[0].entry!.hits.some((h) => h.karo === 'bujur'));
  assert.ok(words[1].entry!.hits.some((h) => h.karo === 'man'));
});

test('greedy match does not fuse across punctuation', () => {
  const toks = lookupPhrase(kamus, 'terima, kasih');
  assert.equal(toks.filter((t) => t.isWord).length, 2);
  assert.equal(toks.filter((t) => t.isWord && t.entry).length, 0);
});

test('phrase lookup keeps punctuation and marks misses', () => {
  const toks = lookupPhrase(kamus, 'makan, kuantum!');
  assert.equal(toks.filter((t) => t.isWord).length, 2);
  assert.ok(toks.find((t) => t.raw === 'makan')!.entry);
  assert.equal(toks.find((t) => t.raw === 'kuantum')!.entry, null);
  assert.ok(toks.some((t) => !t.isWord && t.raw.includes(',')));
});

test('caveats: warns that phrases are not translations', () => {
  const c = caveats(lookupPhrase(kamus, 'saya makan nasi'));
  assert.ok(c.some((s) => s.includes('bukan terjemahan kalimat')), c.join(' | '));
});

test('caveats: reports missing words by name', () => {
  const c = caveats(lookupPhrase(kamus, 'makan kuantum'));
  assert.ok(c.some((s) => s.includes('kuantum')), c.join(' | '));
});

test('caveats: silent on a single known word with no pitfalls', () => {
  const e = lookup(kamus, 'makan')!;
  assert.ok(!e.hits[0].eAssumed, 'man has no e');
  const c = caveats(lookupPhrase(kamus, 'makan'));
  assert.ok(!c.some((s) => s.includes('bukan terjemahan')), 'single word should not warn');
});

test('eAssumed flags words containing e', () => {
  const e = lookup(kamus, 'besok');
  if (e) assert.ok(e.hits.every((h) => (/e/.test(h.karo) ? h.eAssumed : !h.eAssumed)));
});

test('suggest offers prefix matches, never the exact query', () => {
  const s = suggest(kamus, 'ma');
  assert.ok(s.length > 0);
  assert.ok(s.every((w) => w.startsWith('ma') && w !== 'ma'));
});

test('suggest stays quiet below two characters', () => {
  assert.deepEqual(suggest(kamus, 'm'), []);
});

test('morphology: inflected forms resolve through the stem', () => {
  for (const [w, stem] of [['makanan','makan'],['dimakan','makan'],['memakan','makan'],['makanlah','makan'],['makannya','makan']]) {
    const e = lookupSmart(kamus, w);
    assert.ok(e, `${w} should resolve`);
    assert.equal(e!.via?.stem ?? e!.indonesian, stem, `${w} → ${stem}`);
    assert.ok(e!.hits.some((h) => h.karo === 'man'));
  }
});

test('morphology: stems are dictionary-validated, never guessed', () => {
  assert.equal(lookupSmart(kamus, 'diri'), null, 'diri must not strip to *ri');
  assert.equal(lookupSmart(kamus, 'dia'), null, 'dia must not strip to *a');
});

test('morphology: affix hints cite Woollams and map di-→i-', () => {
  const e = lookupSmart(kamus, 'dimakan')!;
  const hint = affixHint(e.via!);
  assert.ok(hint && hint.includes('i-') && hint.includes('Woollams'));
});

test('morphology: exact match wins over stemming', () => {
  const e = lookupSmart(kamus, 'makan')!;
  assert.equal(e.via, undefined);
});

test('caveats: stem-based hits add the bentuk-dasar warning', () => {
  const c = caveats(lookupPhrase(kamus, 'dimakan'));
  assert.ok(c.some((s) => s.includes('kata dasarnya')), c.join(' | '));
});
