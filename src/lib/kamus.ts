/*
 * Kamus lookup: Indonesian → Karo → Aksara.
 *
 * This is a DICTIONARY, not a translator. It resolves one Indonesian word to
 * the Karo word(s) attested for it, then writes those in Aksara Karo. It does
 * not produce Karo grammar: Karo morphology and word order differ from
 * Indonesian, so a word-by-word pass over a sentence yields glossed
 * vocabulary, not a Karo sentence. The UI must say so — see `caveats()`.
 *
 * Data sources are pluggable so a licensed dataset can replace the open one
 * without touching this module (see loadKamus).
 */
import { transliterate } from './translit.ts';

export interface KamusHit {
  /** Karo headword */
  karo: string;
  /** Aksara Karo spelling, or null when the word cannot be written */
  aksara: string | null;
  /** True when the Aksara rests on the pepet default (spec §6) */
  eAssumed: boolean;
  /** Source tags, for attribution */
  src: string[];
  /** Page citation, when the source is a paginated dictionary */
  page?: number;
}

export interface KamusEntry {
  indonesian: string;
  hits: KamusHit[];
}

export interface KamusData {
  /** name shown in the attribution line */
  label: string;
  attribution: string;
  headwords: number;
  entries: Map<string, KamusHit[]>;
}

interface OpenLexicon {
  built: string;
  sources: Record<string, string>;
  pairs: { id: string; karo: string[]; src: string[] }[];
}

export function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function toHit(karo: string, src: string[], page?: number): KamusHit {
  let aksara: string | null = null;
  try {
    aksara = karo
      .split('-')
      .map((p) => transliterate(p))
      .join('-');
  } catch {
    aksara = null; // consonant clusters Karo phonotactics forbid (spec §5.5)
  }
  return { karo, aksara, eAssumed: /e/.test(karo), src, page };
}

/** Build the lookup table from the openly-licensed lexicon. */
export function fromOpenLexicon(raw: OpenLexicon): KamusData {
  const entries = new Map<string, KamusHit[]>();
  for (const p of raw.pairs) {
    entries.set(
      normalize(p.id),
      p.karo.map((k) => toHit(k, p.src)),
    );
  }
  return {
    label: 'Lexicon terbuka',
    attribution:
      'id.wiktionary (CC BY-SA, dari Bangun dkk. 1999) · detik.com Sumut · Woollams 1996',
    headwords: entries.size,
    entries,
  };
}

/* A licensed dataset (e.g. the Kamus 2001 extraction) can be dropped in with
 * the same shape. Kept here so the swap is a data change, not a code change. */
export interface LicensedKamus {
  meta: { label: string; attribution: string };
  entries: Record<string, { karo: string; page: number }[]>;
}

export function fromLicensed(raw: LicensedKamus): KamusData {
  const entries = new Map<string, KamusHit[]>();
  for (const [id, hits] of Object.entries(raw.entries)) {
    entries.set(
      normalize(id),
      hits.map((h) => toHit(h.karo, ['kamus-2001'], h.page)),
    );
  }
  return {
    label: raw.meta.label,
    attribution: raw.meta.attribution,
    headwords: entries.size,
    entries,
  };
}

/** Look one Indonesian word up. Returns null when absent. */
export function lookup(data: KamusData, word: string): KamusEntry | null {
  const q = normalize(word);
  const hits = data.entries.get(q);
  return hits ? { indonesian: q, hits } : null;
}

/** Merge two datasets. `primary` wins per headword; `secondary` fills gaps.
 *  Used to layer the licensed kamus over the open lexicon. */
export function mergeKamus(primary: KamusData, secondary: KamusData): KamusData {
  const entries = new Map(secondary.entries);
  for (const [k, v] of primary.entries) entries.set(k, v);
  return {
    label: `${primary.label} + ${secondary.label}`,
    attribution: `${primary.attribution} · ${secondary.attribution}`,
    headwords: entries.size,
    entries,
  };
}

// ------------------------------------------------------- morphology (id)

/* Indonesian affix stripping as CANDIDATE GENERATION only: a stripped stem
 * counts solely when the dictionary confirms it, so no guessing. The Karo
 * equivalents shown for stripped affixes come from Woollams (1996) ch. 3 and
 * are informational hints, not auto-conjugation — the app must not fabricate
 * inflected Karo words it cannot verify. */
export interface Morph {
  stem: string;
  prefix?: string;
  suffix?: string;
}

/** Indonesian affix → Karo counterpart, per Woollams 1996 ch. 3. */
export const AFFIX_KARO: Record<string, string> = {
  'di-': 'i-',
  'ber-': 'er-',
  'ter-': 'ter-',
  'me-': 'awalan sengau N-',
  'se-': 'se-',
  '-kan': '-ken',
  '-an': '-en',
  '-nya': '-na',
  '-ku': '-ku',
  '-mu': '-ndu',
};

const SUFFIXES: [string, string][] = [
  ['lah', ''], ['kah', ''], // discourse particles: strip silently
  ['nya', '-nya'], ['kan', '-kan'], ['ku', '-ku'], ['mu', '-mu'], ['an', '-an'], ['i', ''],
];

function stemCandidates(word: string): Morph[] {
  const out: Morph[] = [];
  const seen = new Set<string>();
  const push = (stem: string, prefix?: string, suffix?: string) => {
    if (stem.length >= 3 && !seen.has(stem + '|' + prefix + '|' + suffix)) {
      seen.add(stem + '|' + prefix + '|' + suffix);
      out.push({ stem, prefix, suffix });
    }
  };
  const bases: Morph[] = [{ stem: word }];
  for (const [suf, label] of SUFFIXES) {
    if (word.endsWith(suf)) bases.push({ stem: word.slice(0, -suf.length), suffix: label || undefined });
  }
  for (const b of bases) {
    const w = b.stem;
    push(w, undefined, b.suffix);
    if (w.startsWith('di')) push(w.slice(2), 'di-', b.suffix);
    if (w.startsWith('ber')) push(w.slice(3), 'ber-', b.suffix);
    if (w.startsWith('be')) push(w.slice(2), 'ber-', b.suffix);
    if (w.startsWith('ter')) push(w.slice(3), 'ter-', b.suffix);
    if (w.startsWith('se')) push(w.slice(2), 'se-', b.suffix);
    if (w.startsWith('ke')) push(w.slice(2), undefined, b.suffix);
    // meN- with nasal restoration: memakan→makan, menulis→tulis, memukul→pukul…
    if (w.startsWith('meng')) { push(w.slice(4), 'me-', b.suffix); push('k' + w.slice(4), 'me-', b.suffix); }
    if (w.startsWith('meny')) push('s' + w.slice(4), 'me-', b.suffix);
    if (w.startsWith('mem')) { push(w.slice(3), 'me-', b.suffix); push('p' + w.slice(3), 'me-', b.suffix); }
    if (w.startsWith('men')) { push(w.slice(3), 'me-', b.suffix); push('t' + w.slice(3), 'me-', b.suffix); }
    if (w.startsWith('me')) push(w.slice(2), 'me-', b.suffix);
    if (w.startsWith('pe')) push(w.slice(2), undefined, b.suffix);
  }
  return out;
}

export interface StemmedEntry extends KamusEntry {
  via?: Morph;
}

/** Lookup with morphology fallback: exact first, then validated stems.
 *  When several stripped stems exist in the dictionary (memakan → makan but
 *  also mem-|akan), the LONGEST stem wins — it preserves the most of the
 *  original word and is the linguistically likelier segmentation. */
export function lookupSmart(data: KamusData, word: string): StemmedEntry | null {
  const q = normalize(word);
  const direct = lookup(data, q);
  if (direct) return direct;
  let best: StemmedEntry | null = null;
  for (const m of stemCandidates(q)) {
    if (m.stem === q) continue;
    const hit = lookup(data, m.stem);
    if (hit && (!best || m.stem.length > best.via!.stem.length)) {
      best = { ...hit, via: m };
    }
  }
  return best;
}

/** Human-readable hint for a stripped affix, or null. */
export function affixHint(m: Morph): string | null {
  const parts: string[] = [];
  if (m.prefix && AFFIX_KARO[m.prefix]) parts.push(`${m.prefix} ≈ Karo ${AFFIX_KARO[m.prefix]}`);
  if (m.suffix && AFFIX_KARO[m.suffix]) parts.push(`${m.suffix} ≈ Karo ${AFFIX_KARO[m.suffix]}`);
  return parts.length ? parts.join(' · ') + ' (Woollams 1996, bab 3)' : null;
}

/** Words in the lexicon that start with the query — for suggestions. */
export function suggest(data: KamusData, prefix: string, limit = 8): string[] {
  const q = normalize(prefix);
  if (q.length < 2) return [];
  const out: string[] = [];
  for (const k of data.entries.keys()) {
    if (k.startsWith(q) && k !== q) {
      out.push(k);
      if (out.length >= limit) break;
    }
  }
  return out.sort();
}

export interface Token {
  raw: string;
  /** null for punctuation/whitespace passthrough */
  entry: StemmedEntry | null;
  isWord: boolean;
}

/** Split a phrase and look each word up. Deliberately word-by-word — see the
 *  module note and `caveats()`. Multi-word headwords ("terima kasih") are
 *  matched greedily: a two-word window is tried before each single word. */
export function lookupPhrase(data: KamusData, text: string): Token[] {
  const re = /[a-zA-ZéèêÉÈÊ]+/g;
  const words: { raw: string; index: number }[] = [];
  for (const m of text.matchAll(re)) words.push({ raw: m[0], index: m.index! });

  const out: Token[] = [];
  let last = 0;
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (w.index > last) out.push({ raw: text.slice(last, w.index), entry: null, isWord: false });
    // greedy: try "this next" as one headword when only whitespace separates
    const next = words[i + 1];
    if (next && /^\s+$/.test(text.slice(w.index + w.raw.length, next.index))) {
      const pair = `${w.raw} ${next.raw}`;
      const hit = lookup(data, pair);
      if (hit) {
        out.push({ raw: text.slice(w.index, next.index + next.raw.length), entry: hit, isWord: true });
        last = next.index + next.raw.length;
        i += 2;
        continue;
      }
    }
    out.push({ raw: w.raw, entry: lookupSmart(data, w.raw), isWord: true });
    last = w.index + w.raw.length;
    i += 1;
  }
  if (last < text.length) out.push({ raw: text.slice(last), entry: null, isWord: false });
  return out;
}

/** Honest description of what a result is and isn't. */
export function caveats(tokens: Token[]): string[] {
  const out: string[] = [];
  const words = tokens.filter((t) => t.isWord);
  const found = words.filter((t) => t.entry);
  const missing = words.filter((t) => !t.entry);
  if (words.length > 1) {
    out.push(
      'Ini pencarian kata per kata, bukan terjemahan kalimat. Tata bahasa dan ' +
        'urutan kata Karo berbeda dari bahasa Indonesia.',
    );
  }
  if (missing.length) {
    out.push(
      `${missing.length} kata tidak ada di kamus: ${missing.map((t) => t.raw).join(', ')}.`,
    );
  }
  if (found.some((t) => t.entry!.hits.some((h) => h.eAssumed))) {
    out.push(
      'Kata bertanda ᵉ: ejaan aksaranya memakai pepet ᯧ sebagai asumsi, ' +
        'karena sumber tidak membedakan pepet dan taling.',
    );
  }
  if (found.some((t) => t.entry!.hits.some((h) => h.aksara === null))) {
    out.push('Sebagian kata tidak dapat ditulis beraksara: gugus konsonannya asing bagi Karo.');
  }
  if (found.some((t) => t.entry!.hits.length > 1)) {
    out.push('Beberapa kata punya lebih dari satu padanan — pilih sesuai konteks.');
  }
  if (found.some((t) => t.entry!.via)) {
    out.push(
      'Kata berimbuhan dicari lewat kata dasarnya; padanan Karo yang tampil ' +
        'adalah bentuk dasar. Petunjuk imbuhan Karo hanyalah perkiraan — ' +
        'bentuk jadian yang benar perlu penutur.',
    );
  }
  return out;
}
