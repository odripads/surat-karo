/*
 * Text pipeline between the pure transliterator and the UI.
 * Tokenizes input into convertible word-parts and passthrough segments,
 * applies per-part e/é overrides, glide preprocessing and foreign-letter
 * adaptation, and reports what assumption was made for each plain `e`.
 */
import {
  transliterate,
  transliterateGloss,
  normalizeLatin,
  adaptForeign,
  insertGlides,
  type SyllableGloss,
  type TranslitOptions,
} from './translit.ts';

export interface Settings {
  glides: boolean;
  medialUnit: boolean;
}

/** Positions (index into the part's normalized Latin) of e/é vowels,
 *  with the reading currently in effect. */
export interface EVowel {
  index: number; // index in the normalized part text
  reading: 'pepet' | 'taling';
  /** true when the reading came from the user's input (é typed) or a toggle,
   *  false when it is the schwa default assumed for a plain `e`. */
  explicit: boolean;
}

export type Segment = WordPart | Passthrough;

export interface WordPart {
  kind: 'word';
  /** Normalized Latin as currently read (overrides applied). */
  latin: string;
  /** Latin after foreign adaptation + glides — what was actually converted. */
  converted: string;
  aksara: string; // canonical signs; UI applies variant prefs for display
  gloss: SyllableGloss[];
  eVowels: EVowel[];
  adapted: boolean; // foreign letters were respelled (spec §7.6)
  error?: string; // token could not be converted; aksara === latin passthrough
  /** id: segment index + part index, for override bookkeeping */
  id: string;
}

export interface Passthrough {
  kind: 'raw';
  text: string; // whitespace, hyphens, punctuation — emitted unchanged
}

/** e/é overrides: map from WordPart.id to a map of e-position → reading. */
export type Overrides = Map<string, Map<number, 'pepet' | 'taling'>>;

const WORD_RE = /[a-zA-ZéèêĕəÉÈÊ]+/g;

/** Split raw input into convertible parts and passthrough segments.
 *  Words are whitespace/hyphen-separated; hyphens and punctuation pass through. */
export function segment(input: string): { parts: { text: string; id: string }[]; layout: ({ id: string } | { raw: string })[] } {
  const parts: { text: string; id: string }[] = [];
  const layout: ({ id: string } | { raw: string })[] = [];
  let last = 0;
  const seen = new Map<string, number>();
  for (const m of input.matchAll(WORD_RE)) {
    if (m.index! > last) layout.push({ raw: input.slice(last, m.index!) });
    // occurrence-based id: overrides stay attached to their word when the
    // surrounding text is edited (position-based ids would shift)
    const norm = normalizeLatin(m[0]);
    const occ = seen.get(norm) ?? 0;
    seen.set(norm, occ + 1);
    const id = `${norm}#${occ}`;
    parts.push({ text: m[0], id });
    layout.push({ id });
    last = m.index! + m[0].length;
  }
  if (last < input.length) layout.push({ raw: input.slice(last) });
  return { parts, layout };
}

export function convertPart(
  text: string,
  id: string,
  overrides: Overrides,
  settings: Settings,
): WordPart {
  let latin = normalizeLatin(text);
  // apply e/é overrides at recorded positions
  const ov = overrides.get(id);
  if (ov) {
    const chars = [...latin];
    for (const [idx, reading] of ov) {
      if (chars[idx] === 'e' || chars[idx] === 'é') {
        chars[idx] = reading === 'taling' ? 'é' : 'e';
      }
    }
    latin = chars.join('');
  }
  // record e/é state for the UI
  const eVowels: EVowel[] = [];
  [...latin].forEach((c, i) => {
    if (c === 'e' || c === 'é') {
      const overridden = ov?.has(i) ?? false;
      eVowels.push({
        index: i,
        reading: c === 'é' ? 'taling' : 'pepet',
        explicit: c === 'é' || overridden,
      });
    }
  });
  const { word: adaptedWord, adapted } = adaptForeign(latin);
  const converted = settings.glides ? insertGlides(adaptedWord) : adaptedWord;
  const opts: TranslitOptions = { medialUnit: settings.medialUnit };
  try {
    return {
      kind: 'word',
      latin,
      converted,
      aksara: transliterate(converted, opts),
      gloss: transliterateGloss(converted, opts),
      eVowels,
      adapted,
      id,
    };
  } catch (e) {
    return {
      kind: 'word',
      latin,
      converted,
      aksara: text,
      gloss: [],
      eVowels,
      adapted: false,
      error: e instanceof Error ? e.message : String(e),
      id,
    };
  }
}

export interface Conversion {
  segments: Segment[];
  words: WordPart[];
  /** Full output string (canonical signs) with passthrough preserved. */
  text: string;
}

export function convert(input: string, overrides: Overrides, settings: Settings): Conversion {
  const { parts, layout } = segment(input);
  const byId = new Map<string, WordPart>();
  for (const p of parts) byId.set(p.id, convertPart(p.text, p.id, overrides, settings));
  const segments: Segment[] = layout.map((l) =>
    'raw' in l ? { kind: 'raw' as const, text: l.raw } : byId.get(l.id)!,
  );
  const words = [...byId.values()];
  const text = segments.map((s) => (s.kind === 'raw' ? s.text : s.aksara)).join('');
  return { segments, words, text };
}
