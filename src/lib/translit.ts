/*
 * Latin -> Aksara Karo (Surat Sepuluh Siwah) transliterator.
 * Faithful port of reference/aksara_karo.py; rule system per AKSARA_KARO_SPEC.md
 * (Kozok lessons; Woollams 1996). Encoding order is PHONETIC — the font
 * performs visual reordering in closed syllables (spec §1).
 *
 * Karo-specific letter values (spec §2 — non-obvious, load-bearing):
 *   U+1BC2 (named HA) reads /ka/;  U+1BC0 (A) doubles as /ha/;
 *   U+1BEC (named vowel sign O, the x-shape) is Karo /u/;
 *   U+1BE8 (named PAKPAK E) is the usual Karo /o/ (variant U+1BED KARO O).
 */

// ---------------------------------------------------------------- inventory

export const L: Record<string, string> = {
  a: 'ᯀ', // ᯀ  also /ha/
  h: 'ᯀ', // ᯀ  ha uses the A letter in Karo
  k: 'ᯂ', // ᯂ  letter named HA, Karo value /ka/
  b: 'ᯆ', // ᯆ  KARO BA (variant ᯅ)
  p: 'ᯇ', // ᯇ
  n: 'ᯉ', // ᯉ
  w: 'ᯋ', // ᯋ
  g: 'ᯎ', // ᯎ
  j: 'ᯐ', // ᯐ
  d: 'ᯑ', // ᯑ
  r: 'ᯒ', // ᯒ
  m: 'ᯔ', // ᯔ
  t: 'ᯗ', // ᯗ  northern ta
  s: 'ᯘ', // ᯘ
  y: 'ᯛ', // ᯛ
  ng: 'ᯝ', // ᯝ  onset only
  l: 'ᯞ', // ᯞ
  c: 'ᯡ', // ᯡ  CA (glyph variant ᯠ NYA used for /ca/ in Karo)
  nd: 'ᯢ', // ᯢ
  mb: 'ᯣ', // ᯣ
  i: 'ᯤ', // ᯤ  independent, word-initial / post-vocalic only
  u: 'ᯥ', // ᯥ  independent, word-initial / post-vocalic only
};

export const V: Record<string, string> = {
  a: '',
  e: 'ᯧ', // ᯧ  e-pepet (schwa)
  é: 'ᯩ', // ᯩ  e-taling
  i: 'ᯫ', // ᯫ  KARO I (variant ᯪ)
  o: 'ᯨ', // ᯨ  Karo o (variant ᯭ KARO O)
  u: 'ᯬ', // ᯬ  x-shaped sign, named O in Unicode, Karo value /u/
};

export const NG = 'ᯰ'; // ᯰ  coda -ng
export const H = 'ᯱ'; // ᯱ  coda -h
export const KILL = '᯳'; // ᯳  penengen / panongonan (variant ᯲ pangolat)

const VOWELS = new Set(['a', 'e', 'é', 'i', 'o', 'u']);

// -------------------------------------------------------------- normalizing

export function normalizeLatin(word: string): string {
  let w = word.normalize('NFC').toLowerCase().trim();
  w = w
    .replace(/ĕ/g, 'e')
    .replace(/ə/g, 'e')
    .replace(/ê/g, 'é')
    .replace(/è/g, 'é'); // Woollams' /ɛ/; script does not distinguish it from taling
  return w;
}

/** Nearest-sound respelling for letters with no Batak equivalent (spec §7.6).
 *  A display convenience, not orthography — callers must label it. */
export function adaptForeign(word: string): { word: string; adapted: boolean } {
  const map: Record<string, string> = { f: 'p', v: 'b', z: 'j', x: 'ks', q: 'k' };
  let adapted = false;
  const out = word.replace(/[fvzxq]/g, (c) => {
    adapted = true;
    return map[c];
  });
  return { word: out, adapted };
}

/** Glide-insertion preprocessing (spec §7.3): tua -> tuwa, sia -> siya. */
export function insertGlides(word: string): string {
  return word
    .replace(/([uo])(?=[aeéiou])/g, '$1w')
    .replace(/([ié])(?=[aeéou])/g, '$1y');
}

// ---------------------------------------------------------- syllabification

export interface Syllable {
  onset: string;
  nucleus: string;
  coda: string;
}

export interface TranslitOptions {
  /** Treat medial V.mbV / V.ndV as unit-letter onsets instead of the default
   *  killed-coda + onset split (spec §7.2 — genuinely ambiguous; user choice). */
  medialUnit?: boolean;
}

export function syllabify(word: string, opts: TranslitOptions = {}): Syllable[] {
  const w = normalizeLatin(word);
  // tokenize: 'ng' is always the unit phoneme /ŋ/ in Karo orthography
  const toks: string[] = [];
  let i = 0;
  while (i < w.length) {
    if (w.slice(i, i + 2) === 'ng') {
      toks.push('ng');
      i += 2;
    } else if (VOWELS.has(w[i]) || w[i] in L || w[i] === 'h') {
      toks.push(w[i]);
      i += 1;
    } else {
      throw new Error(`cannot map '${w[i]}' in '${word}'`);
    }
  }
  // mb/nd are unit letters (ᯣ/ᯢ) ONLY as word-initial onsets, incl. after
  // the epenthetic schwa (embah -> e+MBA+h); elsewhere V.mbV splits into
  // coda nasal + onset stop (im.bo, tan.dang) — unless medialUnit overrides.
  if (opts.medialUnit) {
    for (let pos = 0; pos < toks.length - 1; pos++) {
      const pair = toks[pos] + toks[pos + 1];
      if (pair === 'mb' || pair === 'nd') toks.splice(pos, 2, pair);
    }
  } else {
    const positions = toks[0] === 'e' ? [0, 1] : [0];
    for (const pos of positions) {
      const pair = toks.slice(pos, pos + 2).join('');
      if (pair === 'mb' || pair === 'nd') {
        toks.splice(pos, 2, pair);
        break;
      }
    }
  }
  // group into syllables: each nucleus takes the longest legal onset before
  // it; consonants before another consonant (or word end) become codas.
  const sylls: Syllable[] = [];
  let onset = '',
    nucleus = '',
    coda = '';
  const n = toks.length;
  toks.forEach((t, idx) => {
    if (VOWELS.has(t)) {
      if (nucleus) {
        // vowel after vowel: new syllable
        sylls.push({ onset, nucleus, coda });
        onset = coda = '';
      }
      nucleus = t;
    } else {
      const nxt = idx + 1 < n ? toks[idx + 1] : null;
      if (!nucleus) {
        // pre-nuclear consonant
        if (onset) {
          // word-initial nasal cluster (nggeluh-type spellings without the
          // schwa written): nasal becomes coda of an epenthetic schwa syllable
          if (onset === 'm' || onset === 'n' || onset === 'ng') {
            sylls.push({ onset: '', nucleus: 'e', coda: onset });
            onset = t;
          } else {
            throw new Error(`unhandled initial cluster '${onset + t}' in '${word}'`);
          }
        } else {
          onset = t;
        }
      } else if (nxt === null || !VOWELS.has(nxt)) {
        if (coda) {
          // already have a coda: close
          sylls.push({ onset, nucleus, coda });
          onset = t;
          nucleus = '';
          coda = '';
        } else {
          coda = t; // consonant before C/# = coda
        }
      } else {
        // consonant before vowel = onset
        sylls.push({ onset, nucleus, coda });
        onset = t;
        nucleus = '';
        coda = '';
      }
    }
  });
  sylls.push({ onset, nucleus, coda });
  return sylls.filter((s) => s.onset !== '' || s.nucleus !== '' || s.coda !== '');
}

// ------------------------------------------------------------ translit core

export type PieceRole = 'letter' | 'vowel-sign' | 'coda-sign' | 'killer';

export interface Piece {
  char: string;
  role: PieceRole;
  /** Latin value this piece writes ('' for the killer). */
  latin: string;
}

export interface SyllableGloss {
  syllable: Syllable;
  latin: string;
  pieces: Piece[];
}

/** Latin Karo word -> per-syllable pieces (phonetic encoding order, spec §1). */
export function transliterateGloss(word: string, opts: TranslitOptions = {}): SyllableGloss[] {
  const sylls = syllabify(word, opts);
  const out: SyllableGloss[] = [];
  sylls.forEach(({ onset, nucleus, coda }, k) => {
    const prevOpen = k > 0 && sylls[k - 1].coda === '';
    const pieces: Piece[] = [];
    const push = (char: string, role: PieceRole, latin: string) => {
      if (char) pieces.push({ char, role, latin });
    };
    // ---- onset + nucleus
    if (onset) {
      push(L[onset], 'letter', onset);
      push(V[nucleus], 'vowel-sign', nucleus);
    } else {
      // independent ᯤ/ᯥ: word-initially or after an open syllable.
      // Diacritic codas (-h, -ng) do not block them (dauh ᯑᯥᯱ), but a
      // penengen-killed consonant coda does (im.bo -> ᯀᯫᯔ᯳ᯆᯨ).  (spec §5.3)
      const indepOk = (coda === '' || coda === 'h' || coda === 'ng') && (k === 0 || prevOpen);
      if (nucleus === 'i' && indepOk) {
        push(L.i, 'letter', 'i');
      } else if (nucleus === 'u' && indepOk) {
        push(L.u, 'letter', 'u');
      } else {
        push(L.a, 'letter', nucleus === 'a' ? 'a' : 'a-carrier');
        push(V[nucleus], 'vowel-sign', nucleus);
      }
    }
    // ---- coda
    if (coda === 'ng') {
      push(NG, 'coda-sign', 'ng');
    } else if (coda === 'h') {
      push(H, 'coda-sign', 'h');
    } else if (coda) {
      if (coda === 'mb' || coda === 'nd') {
        throw new Error(`illegal coda '${coda}' in '${word}'`);
      }
      push(L[coda], 'letter', coda);
      push(KILL, 'killer', '');
    }
    out.push({ syllable: { onset, nucleus, coda }, latin: onset + nucleus + coda, pieces });
  });
  return out;
}

/** Latin Karo word -> Batak Unicode string (phonetic encoding order). */
export function transliterate(word: string, opts: TranslitOptions = {}): string {
  return transliterateGloss(word, opts)
    .map((s) => s.pieces.map((p) => p.char).join(''))
    .join('');
}

// -------------------------------------------------------------- variants

export interface VariantPrefs {
  iSign?: 'karo' | 'circle'; // ᯫ U+1BEB (default) | ᯪ U+1BEA
  oSign?: 'pakpak' | 'karo'; // ᯨ U+1BE8 (default) | ᯭ U+1BED
  killer?: 'panongonan' | 'pangolat'; // ᯳ U+1BF3 (default) | ᯲ U+1BF2
}

/** Map canonical output to the user's preferred variant signs (spec §7.4). */
export function applyVariants(s: string, prefs: VariantPrefs): string {
  let out = s;
  if (prefs.iSign === 'circle') out = out.replace(/ᯫ/g, 'ᯪ');
  if (prefs.oSign === 'karo') out = out.replace(/ᯨ/g, 'ᯭ');
  if (prefs.killer === 'pangolat') out = out.replace(/᯳/g, '᯲');
  return out;
}

/** Collapse attested variant signs before comparing (spec §8). */
export function normalizeVariants(s: string): string {
  return s
    .replace(/ᯪ/g, 'ᯫ') // i variants
    .replace(/ᯭ/g, 'ᯨ') // o variants
    .replace(/᯲/g, '᯳') // killer variants
    .replace(/ᯅ/g, 'ᯆ') // ba variants
    .replace(/ᯠ/g, 'ᯡ'); // ca/nya variants
}

// ------------------------------------------------------- reverse direction

/** Aksara -> Latin. Ambiguity-free except the readings of ᯀ:
 *  word-initial → bare vowel (embah); non-initial with a vowel SIGN → /h/ +
 *  vowel (tuhu — a bare medial i/u would use the independents ᯤ/ᯥ instead);
 *  non-initial with inherent /a/ → vowel-sequence /a/ (juah), since true
 *  medial /ha/ is rare in Karo. e vs é is preserved because the script
 *  distinguishes pepet from taling. */
export function reverse(aksara: string): string {
  const s = normalizeVariants(aksara.normalize('NFC'));
  const CONS: Record<string, string> = {};
  for (const [latin, ch] of Object.entries(L)) {
    if (latin === 'a' || latin === 'h' || latin === 'i' || latin === 'u') continue;
    CONS[ch] = latin;
  }
  const VOW: Record<string, string> = {};
  for (const [latin, ch] of Object.entries(V)) if (ch) VOW[ch] = latin;

  interface Unit {
    cons: string; // '' for carrier ᯀ, 'i'/'u' for independents
    kind: 'cons' | 'carrier' | 'indep';
    vowel: string; // '' once killed
    coda: string;
  }
  const units: Unit[] = [];
  for (const ch of s) {
    const last = units[units.length - 1];
    if (ch === 'ᯀ') {
      units.push({ cons: '', kind: 'carrier', vowel: 'a', coda: '' });
    } else if (ch === 'ᯤ') {
      units.push({ cons: 'i', kind: 'indep', vowel: '', coda: '' });
    } else if (ch === 'ᯥ') {
      units.push({ cons: 'u', kind: 'indep', vowel: '', coda: '' });
    } else if (ch in CONS) {
      units.push({ cons: CONS[ch], kind: 'cons', vowel: 'a', coda: '' });
    } else if (ch in VOW) {
      if (last) last.vowel = VOW[ch];
    } else if (ch === NG) {
      if (last) last.coda = 'ng';
    } else if (ch === H) {
      if (last) last.coda = 'h';
    } else if (ch === KILL) {
      if (last) last.vowel = '';
    } else {
      throw new Error(`cannot reverse '${ch}' (U+${ch.codePointAt(0)!.toString(16).toUpperCase()})`);
    }
  }
  return units
    .map((u, idx) => {
      if (u.kind === 'indep') return u.cons + u.coda;
      if (u.kind === 'carrier') {
        if (idx === 0) return u.vowel + u.coda; // embah, éda, anak
        if (u.vowel === 'a') return 'a' + u.coda; // vowel sequence: ju.ah
        if (u.vowel === '') return 'h'; // killed carrier (unusual)
        return 'h' + u.vowel + u.coda; // intervocalic h: tu.hu
      }
      return u.cons + u.vowel + u.coda;
    })
    .join('');
}

// ------------------------------------------------------------- names table

export interface CharInfo {
  cp: string; // "U+1BC2"
  unicodeName: string;
  karo: string; // Karo reading / function
}

export function charInfo(ch: string): CharInfo {
  const info = NAMES[ch];
  const cp = `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
  return info ? { cp, ...info } : { cp, unicodeName: 'UNKNOWN', karo: '?' };
}

const NAMES: Record<string, { unicodeName: string; karo: string }> = {
  'ᯀ': { unicodeName: 'BATAK LETTER A', karo: 'a / ha' },
  'ᯂ': { unicodeName: 'BATAK LETTER HA', karo: 'ka' },
  'ᯅ': { unicodeName: 'BATAK LETTER BA', karo: 'ba (variant)' },
  'ᯆ': { unicodeName: 'BATAK LETTER KARO BA', karo: 'ba' },
  'ᯇ': { unicodeName: 'BATAK LETTER PA', karo: 'pa' },
  'ᯉ': { unicodeName: 'BATAK LETTER NA', karo: 'na' },
  'ᯋ': { unicodeName: 'BATAK LETTER WA', karo: 'wa' },
  'ᯎ': { unicodeName: 'BATAK LETTER GA', karo: 'ga' },
  'ᯐ': { unicodeName: 'BATAK LETTER JA', karo: 'ja' },
  'ᯑ': { unicodeName: 'BATAK LETTER DA', karo: 'da' },
  'ᯒ': { unicodeName: 'BATAK LETTER RA', karo: 'ra' },
  'ᯔ': { unicodeName: 'BATAK LETTER MA', karo: 'ma' },
  'ᯗ': { unicodeName: 'BATAK LETTER NORTHERN TA', karo: 'ta' },
  'ᯘ': { unicodeName: 'BATAK LETTER SA', karo: 'sa' },
  'ᯛ': { unicodeName: 'BATAK LETTER YA', karo: 'ya' },
  'ᯝ': { unicodeName: 'BATAK LETTER NGA', karo: 'nga' },
  'ᯞ': { unicodeName: 'BATAK LETTER LA', karo: 'la' },
  'ᯠ': { unicodeName: 'BATAK LETTER NYA', karo: 'ca (variant)' },
  'ᯡ': { unicodeName: 'BATAK LETTER CA', karo: 'ca' },
  'ᯢ': { unicodeName: 'BATAK LETTER NDA', karo: 'nda' },
  'ᯣ': { unicodeName: 'BATAK LETTER MBA', karo: 'mba' },
  'ᯤ': { unicodeName: 'BATAK LETTER I', karo: 'i (independent)' },
  'ᯥ': { unicodeName: 'BATAK LETTER U', karo: 'u (independent)' },
  'ᯧ': { unicodeName: 'BATAK VOWEL SIGN E', karo: '-e (pepet, schwa)' },
  'ᯩ': { unicodeName: 'BATAK VOWEL SIGN EE', karo: '-é (taling)' },
  'ᯪ': { unicodeName: 'BATAK VOWEL SIGN I', karo: '-i (variant)' },
  'ᯫ': { unicodeName: 'BATAK VOWEL SIGN KARO I', karo: '-i' },
  'ᯨ': { unicodeName: 'BATAK VOWEL SIGN PAKPAK E', karo: '-o' },
  'ᯭ': { unicodeName: 'BATAK VOWEL SIGN KARO O', karo: '-o (variant)' },
  'ᯬ': { unicodeName: 'BATAK VOWEL SIGN O', karo: '-u' },
  'ᯰ': { unicodeName: 'BATAK CONSONANT SIGN NG', karo: 'coda -ng' },
  'ᯱ': { unicodeName: 'BATAK CONSONANT SIGN H', karo: 'coda -h' },
  '᯳': { unicodeName: 'BATAK PANONGONAN', karo: 'penengen (vowel killer)' },
  '᯲': { unicodeName: 'BATAK PANGOLAT', karo: 'vowel killer (variant)' },
};
