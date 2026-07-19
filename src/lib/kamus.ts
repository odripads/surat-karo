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
  entry: KamusEntry | null;
  isWord: boolean;
}

/** Split a phrase and look each word up. Deliberately word-by-word — see the
 *  module note and `caveats()`. */
export function lookupPhrase(data: KamusData, text: string): Token[] {
  const out: Token[] = [];
  const re = /[a-zA-ZéèêÉÈÊ]+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ raw: text.slice(last, m.index!), entry: null, isWord: false });
    out.push({ raw: m[0], entry: lookup(data, m[0]), isWord: true });
    last = m.index! + m[0].length;
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
  return out;
}
