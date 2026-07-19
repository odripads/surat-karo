# Surat Karo

Latin → **Aksara Karo** (Surat Sepuluh Siwah) transliterator. A
language-preservation web app: type a Karo Batak word, see, copy, and export
its correct traditional spelling in the Unicode Batak block (U+1BC0–U+1BFF).

**Try it live: [odripads.github.io/surat-karo](https://odripads.github.io/surat-karo/)** —
featured as a Kalcer Experiment on
[kalcerinstitute.com](https://kalcerinstitute.com), the website of the Kalcer
Institute (Yogyakarta).

Rule system: [`AKSARA_KARO_SPEC.md`](AKSARA_KARO_SPEC.md) — derived from Uli
Kozok's *Aksara Karo* lessons and Woollams (1996) *A Grammar of Karo Batak,
Sumatra*, validated against all 27 attested spellings in the lessons. Read it
before touching the transliterator: Unicode names the Batak characters after
their Toba values, and several Karo readings differ (the letter named HA reads
/ka/; the vowel sign named O writes /u/). General "Batak script" knowledge is
not a substitute for the spec.

## Features

- Live per-word conversion; punctuation and unconvertible tokens pass through.
- **e/é disambiguation** — plain `e` defaults to pepet ᯧ (schwa) and is
  marked under each word; tap it to switch to taling ᯩ. `é è ê` input as
  taling, `ĕ ə` as pepet. Ctrl/Cmd+E or the é button inserts taling.
- Copy Unicode, PNG and SVG export (SVG embeds the font as a data URI).
- Tap a word for a syllable-by-syllable breakdown with Karo readings,
  Unicode names, and codepoints.
- Display preferences: i-sign ᯫ/ᯪ, o-sign ᯨ/ᯭ, killer ᯳/᯲, glide style
  (*tua*→*tuwa*), medial mb/nd unit-letter override.
- Reverse direction (Aksara → Latin).
- "About the script" page: the 19 induk surat, anak ni surat, and the two
  Unicode traps (letter named HA reads /ka/; vowel sign named O writes /u/).
- Offline after first load (service worker); fully static, zero runtime deps.

## Develop

```sh
npm install
npm test        # spec §8 acceptance suite + pipeline tests (node:test)
npm run dev     # vite dev server
npm run build   # typecheck + production build to dist/
```

`npm test` is the correctness gate: 27 attested words + derived checks from
spec §8, compared after variant-sign normalization. All must stay green.

## Deploy

`npm run build`, then host `dist/` anywhere static (GitHub Pages, Netlify —
`base: './'` makes all paths relative). Noto Sans Batak (SIL OFL) is bundled;
no platform ships a Batak font, so the app never relies on system fonts.

## Lexicon (kamus groundwork)

`src/data/lexicon.json` is a growing Indonesian → Karo word lexicon
(~300 headwords) compiled by `scripts/build_lexicon.py` from openly licensed
and attributed sources: the id.wiktionary *Kamus bahasa Indonesia – bahasa
Karo* appendix (CC BY-SA, after Bangun et al. 1999), id.wiktionary Karo
entries, two detik.com Sumut vocabulary lists, and a curated set of common
words kept **only** when auto-attested in Woollams (1996). Every entry carries
its source tags. This will power a word-by-word kamus mode — dictionary
lookup, not grammatical translation.

## Contributing

Contributions are very welcome — this script has almost no tooling, and every
improvement helps keep it alive. Good starting points:

- **Lexicon / e-disambiguation**: a list of attested taling (`é`) words would
  let the app suggest readings instead of defaulting to schwa (spec §6).
- **Translation layer**: an Indonesian→Karo lexicon in front of the pure
  transliterator module (`src/lib/translit.ts` has no DOM dependencies).
- **More attested spellings**: manuscript or primary-source spellings to grow
  the §8 acceptance suite.
- **Keyboards, corrections, docs** — anything grounded in the spec.

Ground rules: `npm test` (the spec §8 acceptance suite) must stay green; cite
a primary source for any rule change; encoding order stays phonetic — visual
reordering is the font's job.

## Attribution

Rules derived from Uli Kozok's *Aksara Karo* lessons and Geoff Woollams,
*A Grammar of Karo Batak, Sumatra* (Pacific Linguistics C-130, ANU, 1996).
Font: [Noto Sans Batak](https://fonts.google.com/noto/specimen/Noto+Sans+Batak)
(SIL Open Font License). Body/UI type: Gentium Book Plus (SIL OFL),
IBM Plex Mono (OFL).

This is a transliterator, not a translator — words from other languages are
only respelled by sound and are labeled as adaptations in the UI. A future
Indonesian→Karo translation layer can sit in front of `src/lib/translit.ts`,
which is a pure module with no DOM dependencies.
