/* Acceptance test suite from AKSARA_KARO_SPEC.md §8.
 * Every attested spelling from the Kozok lessons; compare after normalizing
 * variants ᯪ→ᯫ, ᯭ→ᯨ, ᯲→᯳. All must pass before any UI work counts as done. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  transliterate,
  normalizeVariants,
  reverse,
  insertGlides,
  applyVariants,
  adaptForeign,
  syllabify,
} from './translit.ts';

// ---- §8 attested spellings (27 words)
const ATTESTED: Record<string, string> = {
  gana: 'ᯎᯉ',
  lapa: 'ᯞᯇ',
  lap: 'ᯞᯇ᯳',
  balbal: 'ᯆᯞ᯳ᯆᯞ᯳',
  kam: 'ᯂᯔ᯳',
  aku: 'ᯀᯂᯬ',
  kaca: 'ᯂᯡ',
  ngalo: 'ᯝᯞᯨ',
  ringan: 'ᯒᯫᯝᯉ᯳',
  surat: 'ᯘᯬᯒᯗ᯳',
  takal: 'ᯗᯂᯞ᯳',
  tuhu: 'ᯗᯬᯀᯬ',
  cires: 'ᯡᯫᯒᯧᯘ᯳',
  udan: 'ᯥᯑᯉ᯳',
  ido: 'ᯤᯑᯨ',
  ngaloi: 'ᯝᯞᯨᯤ',
  dauh: 'ᯑᯥᯱ',
  ndai: 'ᯢᯤ',
  embah: 'ᯀᯧᯣᯱ',
  éda: 'ᯀᯩᯑ',
  kuidah: 'ᯂᯬᯤᯑᯱ',
  iluh: 'ᯤᯞᯬᯱ',
  igung: 'ᯤᯎᯬᯰ',
  man: 'ᯔᯉ᯳',
  tandang: 'ᯗᯉ᯳ᯑᯰ',
  anjar: 'ᯀᯉ᯳ᯐᯒ᯳',
  imbo: 'ᯀᯫᯔ᯳ᯆᯨ',
};

for (const [latin, want] of Object.entries(ATTESTED)) {
  test(`§8 attested: ${latin} → ${want}`, () => {
    assert.equal(normalizeVariants(transliterate(latin)), normalizeVariants(want));
  });
}

// ---- §8 derived checks
const DERIVED: Record<string, string> = {
  mbiring: 'ᯣᯫᯒᯫᯰ',
  nggeluh: 'ᯀᯧᯰᯎᯧᯞᯬᯱ',
  enggo: 'ᯀᯧᯰᯎᯨ',
};

for (const [latin, want] of Object.entries(DERIVED)) {
  test(`§8 derived: ${latin} → ${want}`, () => {
    assert.equal(normalizeVariants(transliterate(latin)), normalizeVariants(want));
  });
}

test('§8 derived: mejuah-juah → ᯔᯧᯐᯬᯀᯱ-ᯐᯬᯀᯱ (per hyphen-separated part)', () => {
  const parts = 'mejuah-juah'.split('-').map((p) => transliterate(p));
  assert.equal(parts.join('-'), 'ᯔᯧᯐᯬᯀᯱ-ᯐᯬᯀᯱ');
});

// ---- render sanity string (spec §9): lon encodes LA + O-sign(=u? no: lon uses O) …
test('render sanity string (spec §9): lun → ᯞᯬᯉ᯳, killer encoded last', () => {
  // Spec §9 test string: ᯞᯬᯉ᯳ = LA + VOWEL SIGN O (Karo /u/) + NA + killer,
  // i.e. Karo "lun"; encoding order must be phonetic, killer last.
  assert.equal(transliterate('lun'), 'ᯞᯬᯉ᯳');
});

// ---- e vs é distinction (spec §6)
test('e is schwa (pepet ᯧ), é is taling ᯩ; è/ê map to taling; ĕ/ə to pepet', () => {
  assert.equal(transliterate('me'), 'ᯔᯧ');
  assert.equal(transliterate('mé'), 'ᯔᯩ');
  assert.equal(transliterate('mè'), 'ᯔᯩ');
  assert.equal(transliterate('mê'), 'ᯔᯩ');
  assert.equal(transliterate('mĕ'), 'ᯔᯧ');
});

// ---- medial mb/nd override (spec §7.2)
test('medialUnit option: tandang splits by default, unit letter on override', () => {
  assert.equal(transliterate('tandang'), 'ᯗᯉ᯳ᯑᯰ');
  assert.equal(transliterate('tandang', { medialUnit: true }), 'ᯗᯢᯰ');
});

// ---- glide mode (spec §7.3)
test('glide preprocessing: tua→tuwa, sia→siya', () => {
  assert.equal(insertGlides('tua'), 'tuwa');
  assert.equal(insertGlides('sia'), 'siya');
  assert.equal(transliterate(insertGlides('tua')), 'ᯗᯬᯋ');
  assert.equal(transliterate(insertGlides('sia')), 'ᯘᯫᯛ');
});

// ---- variant prefs round-trip (spec §7.4)
test('applyVariants ↔ normalizeVariants round-trip', () => {
  const s = transliterate('ido') + transliterate('cires');
  const varied = applyVariants(s, { iSign: 'circle', oSign: 'karo', killer: 'pangolat' });
  assert.notEqual(varied, s);
  assert.equal(normalizeVariants(varied), normalizeVariants(s));
});

// ---- foreign adaptation (spec §7.6)
test('adaptForeign: f→p v→b z→j x→ks q→k, flagged', () => {
  assert.deepEqual(adaptForeign('vaksin'), { word: 'baksin', adapted: true });
  assert.deepEqual(adaptForeign('surat'), { word: 'surat', adapted: false });
});

// ---- reverse direction
test('reverse: Aksara → Latin round-trips attested words', () => {
  for (const latin of ['man', 'surat', 'tandang', 'tuhu', 'embah', 'imbo', 'igung', 'dauh', 'éda', 'nggeluh', 'enggo', 'mejuah', 'juah', 'kuidah']) {
    const expectLatin = { nggeluh: 'enggeluh' }[latin] ?? latin; // epenthetic e is written out
    assert.equal(reverse(transliterate(latin)), expectLatin);
  }
});

test('reverse handles variant signs', () => {
  assert.equal(reverse('ᯞᯬᯉ᯲'), 'lun');
  assert.equal(reverse('ᯀᯪᯔ᯲ᯆᯭ'), 'imbo');
});

// ---- syllabifier sanity
test('syllabify: kuidah → ku.i.dah', () => {
  assert.deepEqual(syllabify('kuidah'), [
    { onset: 'k', nucleus: 'u', coda: '' },
    { onset: '', nucleus: 'i', coda: '' },
    { onset: 'd', nucleus: 'a', coda: 'h' },
  ]);
});
