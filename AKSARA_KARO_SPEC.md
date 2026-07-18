# Aksara Karo Transliteration Specification

Latin (Karo practical orthography) → Surat Sepuluh Siwah (Karo Batak script), Unicode Batak block U+1BC0–U+1BFF.

**Status.** This rule system was derived from two primary sources and validated against every attested spelling in them (27/27 test words pass, see §8):

1. *Aksara Karo* lessons (Uli Kozok-style tutorial docx, in `resources/`) — the authority for Karo-specific glyph choices and orthographic rules.
2. Woollams, G. (1996). *A grammar of Karo Batak, Sumatra* (Pacific Linguistics C-130). ANU. — phonology (§2) and practical orthography (§2.6).

The reference implementation is `reference/aksara_karo.py`. Any port MUST reproduce its test suite exactly.

---

## 1. Script model

The script is an **abugida**: each consonant letter (*induk surat*) carries an inherent vowel /a/. Diacritics (*anak ni surat*) change the vowel, add coda -ng or -h, or kill the vowel entirely (*penengen*). There are no conjuncts and no ligatures in Karo.

**Encoding order is PHONETIC; visual reordering is the font's job.** Unicode's example: *lon* is entered `LA + O-sign + NA + killer` and a Batak-capable font displays it as L-N-O-killer. Never encode in visual order — a correct font/shaper (HarfBuzz, all modern browsers) inserts a dotted circle if you do. This resolves an apparent contradiction in the Kozok lessons: his prose rule "the vowel diacritic is placed on the final consonant before the killer" describes what you *see on the page*, not what you *type*.

## 2. Critical Karo-specific codepoint choices (non-obvious!)

Unicode named the Batak characters after their **Toba** values. Karo readings differ. Getting these wrong produces text that is Unicode-plausible but Karo-wrong:

| Karo value | Codepoint | Unicode name | Note |
|---|---|---|---|
| /ka/ | U+1BC2 ᯂ | BATAK LETTER **HA** | In Karo this letter is always read *ka* |
| /a/ and /ha/ | U+1BC0 ᯀ | BATAK LETTER A | Doubles as the (rare) *ha*; also the carrier for vowel-initial syllables |
| /ba/ | U+1BC6 ᯆ | BATAK LETTER **KARO BA** | variant shape ᯅ U+1BC5 |
| /u/ vowel sign | U+1BEC ᯬ | BATAK VOWEL SIGN **O** | the ×-shaped sign; its Karo value is /u/, NOT /o/. Do not use U+1BEE (Toba u) |
| /o/ vowel sign | U+1BE8 ᯨ | BATAK VOWEL SIGN **PAKPAK E** | primary Karo /o/ shape per the lessons; variant ᯭ U+1BED KARO O |
| /i/ vowel sign | U+1BEB ᯫ | BATAK VOWEL SIGN KARO I | two short strokes; variant ᯪ U+1BEA (small circle) — both attested |
| /ca/ | U+1BE1 ᯡ | BATAK LETTER CA | glyph is the *nya* shape; Karo has no /ɲ/, so the letter reads /ca/. ᯠ U+1BE0 NYA appears as a variant in the lessons |
| killer | U+1BF3 ᯳ | BATAK PANONGONAN | Karo *penengen* (default in the lessons); ᯲ U+1BF2 PANGOLAT occurs as a variant |

## 3. Letter inventory (induk surat)

Base consonant letters, inherent /a/:

| Latin | Glyph | Codepoint | | Latin | Glyph | Codepoint |
|---|---|---|---|---|---|---|
| a/ha | ᯀ | U+1BC0 | | m | ᯔ | U+1BD4 |
| k | ᯂ | U+1BC2 | | t | ᯗ | U+1BD7 (northern ta) |
| b | ᯆ | U+1BC6 | | s | ᯘ | U+1BD8 |
| p | ᯇ | U+1BC7 | | y | ᯛ | U+1BDB |
| n | ᯉ | U+1BC9 | | ng | ᯝ | U+1BDD (onset only) |
| w | ᯋ | U+1BCB | | l | ᯞ | U+1BDE |
| g | ᯎ | U+1BCE | | c | ᯡ | U+1BE1 |
| j | ᯐ | U+1BD0 | | nd | ᯢ | U+1BE2 (unit letter, see §5.4) |
| d | ᯑ | U+1BD1 | | mb | ᯣ | U+1BE3 (unit letter, see §5.4) |
| r | ᯒ | U+1BD2 | | | | |

Independent vowels (distribution restricted, see §5.3): **i** ᯤ U+1BE4, **u** ᯥ U+1BE5.

## 4. Diacritic inventory (anak ni surat)

| Function | Sign | Codepoint |
|---|---|---|
| -a | (none — inherent) | |
| -e (schwa, e-pepet) | ᯧ | U+1BE7 |
| -é (e-taling; also Woollams' è /ɛ/) | ᯩ | U+1BE9 |
| -i | ᯫ | U+1BEB (variant ᯪ U+1BEA) |
| -o | ᯨ | U+1BE8 (variant ᯭ U+1BED) |
| -u | ᯬ | U+1BEC |
| coda -ng | ᯰ | U+1BF0 |
| coda -h | ᯱ | U+1BF1 |
| vowel killer (penengen) | ᯳ | U+1BF3 (variant ᯲ U+1BF2) |

## 5. Rules

### 5.1 Core syllable encoding
- **CV**: letter + vowel sign (nothing for /a/). *gana* → ᯎᯉ, *ngalo* → ᯝᯞᯨ.
- **CVC, coda ≠ ng/h**: letter + vowel sign + coda letter + penengen. *lap* → ᯞᯇ᯳; *surat* → ᯘᯬᯒᯗ᯳; *man* → ᯔᯉ᯳. Emit in phonetic order (§1): *cires* (ci.res) → ᯡᯫᯒᯧᯘ᯳ (`CA, I, RA, E, SA, KILLER`).
- **coda -ng** → ᯰ, **coda -h** → ᯱ, no penengen: *igung* → ᯤᯎᯬᯰ, *embah* → ᯀᯧᯣᯱ. Combine freely with vowel signs: *bung* ᯆᯬᯰ, *beh* ᯆᯧᯱ.
- Intervocalic /h/ is NOT the ᯱ sign — it is the letter ᯀ: *tuhu* → ᯗᯬᯀᯬ.
- Intervocalic 'ng' before a vowel is the onset letter ᯝ: *ri.ngan* → ᯒᯫᯝᯉ᯳. Never write /ŋ/ as n+g.

### 5.2 Vowel-initial syllables
- /a/-initial: ᯀ. *anak* → ᯀᯉᯂ᯳. /e/ /é/ /o/-initial: ᯀ + vowel sign. *embah* → ᯀᯧ…, *éda* → ᯀᯩᯑ, *oge* → ᯀᯨᯎᯩ.
- /ə/-carrier for word-initial nasal clusters: words like *nggeluh*, or *enggo*, encode the initial nasal as coda of a schwa syllable: *enggo* (eng.go) → ᯀᯧᯰᯎᯨ.

### 5.3 Independent ᯤ (i) and ᯥ (u)
Used when the syllable is vowel-initial AND (word-initial OR preceded by an open syllable):
- *ido* → ᯤᯑᯨ, *udan* → ᯥᯑᯉ᯳, *ku.i.dah* → ᯂᯬᯤᯑᯱ, *ngaloi* → ᯝᯞᯨᯤ, *dauh* → ᯑᯥᯱ, *ndai* → ᯢᯤ.
- **Diacritic codas -h/-ng do NOT block them** (*dauh* ᯑᯥᯱ, *igung* ᯤᯎᯬᯰ), **but a penengen-killed coda DOES**: *im.bo* → ᯀᯫᯔ᯳ᯆᯨ (A + i-sign, not ᯤ). (Wikipedia's "open syllables only" is the Toba simplification; it is wrong for Karo — falsified by *dauh*.)
- Writing ᯀᯪ / ᯀᯬ instead of ᯤ / ᯥ is attested and acceptable as a fallback (*ido* = ᯤᯑᯨ or ᯀᯫᯑᯨ).

### 5.4 mb / nd unit letters (ᯣ / ᯢ)
Karo-specific prenasalized letters. They are used ONLY as syllable onsets:
- word-initially: *mbiring* → ᯣᯫᯒᯫᯰ, *ndauh* → ᯢᯥᯱ;
- after the word-initial epenthetic schwa: *embah* (e.mbah) → ᯀᯧᯣᯱ.
- Everywhere else a medial V-mb-V / V-nd-V sequence splits into killed coda + onset: *im.bo* → ᯀᯫᯔ᯳ᯆᯨ, *tan.dang* → ᯗᯉ᯳ᯑᯰ. This distinction is phonological (unit onset vs. heterosyllabic cluster) and cannot always be recovered from spelling — see §7.

### 5.5 Nothing else
No consonant clusters within a syllable onset besides mb/nd/ng-as-single-phoneme; no conjuncts; ᯝ (nga) cannot take the penengen (coda /ŋ/ is always ᯰ).

## 6. Input orthography

Follows Woollams (1996 §2.6.2): the Latin letter **e is ambiguous** between /ə/ (e-pepet → ᯧ) and /e/ (e-taling → ᯩ). Standard Karo spelling writes both as plain *e*.
- Input convention: `e` = schwa ᯧ, `é` = taling ᯩ (accept `è` and `ê` as taling too; accept `ĕ`/`ə` as schwa).
- Consequence: converting standard published Karo text requires a lexical lookup or human disambiguation for *e*. Schwa is the statistically safe default (taling words are a small closed-ish set), but flag it in any UI.

Case-insensitive; NFC-normalize input; `ng`, `mb`, `nd` are the only multigraphs.

## 7. Known ambiguities and limitations (do not paper over these in an app)

1. **e vs é** — underdetermined by standard spelling (§6). UI should offer an é input helper and mark the assumption.
2. **Medial mb/nd after schwa** — a word like *penduduk*-shaped items: whether *nd* is a unit onset or n.d split depends on morphology/phonology, not spelling. Default: split medially (per *tandang*, *imbo*); allow manual override.
3. **Glide style** — manuscripts commonly write vowel sequences with glides: *tua* → *tuwa* ᯗᯬᯋ, *sia* → *siya* ᯘᯫᯜ, and per Kozok this is MORE common than ᯗᯬᯀ / ᯘᯫᯀ. The reference implementation uses the ᯤ/ᯥ/ᯀ convention; a glide-insertion mode is a worthwhile toggle (insert *w* after u/o, *y* after i/é before a following vowel).
4. **Variant signs** — ᯪ~ᯫ (i), ᯨ~ᯭ (o), ᯳~᯲ (killer), ᯆ~ᯅ (ba), ᯡ~ᯠ (ca): all attested; offer as display preferences, normalize when comparing.
5. **Scope: Karo words only.** English/Indonesian input is transliterated as spelled, which is graphemic noise, not Karonese. A real translator needs (a) Indonesian/English → Karo lexicon lookup (translation), then (b) this transliterator (script). Keep the two stages architecturally separate. Woollams' extracted grammar text is in `resources/` for building the language side later.
6. **Foreign letters** f, v, q, x, z have no Batak letters. Nearest-sound respelling (f→p, v→b/w, z→j/s, x→ks, q→k) is a display convenience, not orthography — label it as such.

## 8. Acceptance test suite

Every attested spelling from the Kozok lessons. A port MUST pass all of these (compare after normalizing variants ᯪ→ᯫ, ᯭ→ᯨ, ᯲→᯳):

| Latin | Expected | Latin | Expected |
|---|---|---|---|
| gana | ᯎᯉ | ido | ᯤᯑᯨ |
| lapa | ᯞᯇ | ngaloi | ᯝᯞᯨᯤ |
| lap | ᯞᯇ᯳ | dauh | ᯑᯥᯱ |
| balbal | ᯆᯞ᯳ᯆᯞ᯳ | ndai | ᯢᯤ |
| kam | ᯂᯔ᯳ | embah | ᯀᯧᯣᯱ |
| aku | ᯀᯂᯬ | éda | ᯀᯩᯑ |
| kaca | ᯂᯡ | kuidah | ᯂᯬᯤᯑᯱ |
| ngalo | ᯝᯞᯨ | iluh | ᯤᯞᯬᯱ |
| ringan | ᯒᯫᯝᯉ᯳ | igung | ᯤᯎᯬᯰ |
| surat | ᯘᯬᯒᯗ᯳ | man | ᯔᯉ᯳ |
| takal | ᯗᯂᯞ᯳ | tandang | ᯗᯉ᯳ᯑᯰ |
| tuhu | ᯗᯬᯀᯬ | anjar | ᯀᯉ᯳ᯐᯒ᯳ |
| cires | ᯡᯫᯒᯧᯘ᯳ | imbo | ᯀᯫᯔ᯳ᯆᯨ |
| udan | ᯥᯑᯉ᯳ | | |

Additional derived checks: *mbiring* → ᯣᯫᯒᯫᯰ, *nggeluh* → ᯀᯧᯰᯎᯧᯞᯬᯱ, *enggo* → ᯀᯧᯰᯎᯨ, *mejuah-juah* → ᯔᯧᯐᯬᯀᯱ ᯐᯬᯀᯱ.

## 9. Rendering

- **Web**: output the phonetic-order Unicode string; browsers shape Batak correctly given a Batak font. Bundle Noto Sans Batak (`fonts/NotoSansBatak.woff2`, OFL license) via `@font-face` — do NOT rely on system fonts (macOS/Windows/iOS/Android ship none; users see tofu). Test string: ᯞᯬᯉ᯳ must display with the ᯬ after the ᯉ.
- **Server/native/SVG-PNG export**: shape with HarfBuzz (Batak is a Universal Shaping Engine script), then draw glyph outlines — see `render_svg()` in the reference implementation.
- An isolated diacritic (e.g. showing ᯳ alone in a UI legend) correctly renders with a dotted circle; that is the shaper working, not a bug.
