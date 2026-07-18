/* "About the script" view — content drawn from AKSARA_KARO_SPEC.md §§1–5,
 * rendered with the real bundled font. */
import { charInfo } from './lib/translit.ts';

const INDUK: [string, string, string?][] = [
  // [latin, glyph, note] — the nineteen letters (Surat Sepuluh Siwah)
  ['a', 'ᯀ', 'also ha'],
  ['ka', 'ᯂ'],
  ['ba', 'ᯆ'],
  ['pa', 'ᯇ'],
  ['na', 'ᯉ'],
  ['wa', 'ᯋ'],
  ['ga', 'ᯎ'],
  ['ja', 'ᯐ'],
  ['da', 'ᯑ'],
  ['ra', 'ᯒ'],
  ['ma', 'ᯔ'],
  ['ta', 'ᯗ'],
  ['sa', 'ᯘ'],
  ['ya', 'ᯛ'],
  ['nga', 'ᯝ'],
  ['la', 'ᯞ'],
  ['ca', 'ᯡ'],
  ['nda', 'ᯢ'],
  ['mba', 'ᯣ'],
];

const ANAK: [string, string, string][] = [
  // [sign shown on ma, reads, function]
  ['ᯔ', 'ma', 'inherent /a/ — no sign'],
  ['ᯔᯧ', 'me', 'e-pepet (schwa) ᯧ'],
  ['ᯔᯩ', 'mé', 'e-taling ᯩ'],
  ['ᯔᯫ', 'mi', 'i-sign ᯫ (variant ᯪ)'],
  ['ᯔᯨ', 'mo', 'o-sign ᯨ (variant ᯭ)'],
  ['ᯔᯬ', 'mu', 'u-sign ᯬ — named “O” in Unicode'],
  ['ᯔᯰ', 'mang', 'coda -ng ᯰ'],
  ['ᯔᯱ', 'mah', 'coda -h ᯱ'],
  ['ᯔ᯳', 'm', 'penengen ᯳ kills the vowel'],
];

function letterCard([latin, glyph, note]: [string, string, string?]): string {
  const info = charInfo(glyph);
  return `<div class="letter-card">
    <div class="letter-glyph" lang="btk">${glyph}</div>
    <div class="letter-latin">${latin}${note ? ` <small>· ${note}</small>` : ''}</div>
    <div class="letter-cp">${info.cp}</div>
  </div>`;
}

export function renderAbout(): string {
  return `<div class="about">
  <section class="about-section reveal">
    <h2>Surat Sepuluh Siwah — <i>the nineteen letters</i></h2>
    <p>
      Aksara Karo is the Karo variant of the Batak script, an abugida once
      written on bark books (<i>pustaha</i>) and bamboo. Each letter
      (<i>induk surat</i>) carries an inherent /a/; small signs
      (<i>anak ni surat</i>) change the vowel, add a coda, or silence the
      vowel entirely. The script fell out of everyday use in the twentieth
      century — this tool exists so that writing it again is effortless.
    </p>
    <div class="letter-grid">${INDUK.map(letterCard).join('')}</div>
    <p style="margin-top:1rem">
      Two independent vowel letters,
      <span lang="btk">ᯤ</span> <b>i</b> (U+1BE4) and
      <span lang="btk">ᯥ</span> <b>u</b> (U+1BE5), appear word-initially or
      after an open syllable: <i>ido</i> <span lang="btk">ᯤᯑᯨ</span>,
      <i>dauh</i> <span lang="btk">ᯑᯥᯱ</span>.
    </p>
  </section>

  <section class="about-section reveal" style="--d:0.06s">
    <h2>Anak ni surat — <i>the vowel and coda signs</i></h2>
    <p>Shown here on <span lang="btk">ᯔ</span> <i>ma</i>:</p>
    <div class="table-scroll">
      <table class="sign-table">
        <thead><tr><th>written</th><th>reads</th><th>sign</th></tr></thead>
        <tbody>
          ${ANAK.map(([g, r, f]) => `<tr><td lang="btk">${g}</td><td><b>${r}</b></td><td>${f}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p style="margin-top:0.9rem">
      A closed syllable takes the killer on its final letter:
      <i>man</i> 'eat' → <span lang="btk">ᯔᯉ᯳</span> (MA + NA + penengen).
      The codas <b>-ng</b> and <b>-h</b> are their own signs and never use the
      killer. Encoding is always in <b>phonetic order</b> — in
      <i>lun</i> <span lang="btk">ᯞᯬᯉ᯳</span> the vowel sign is typed on LA
      but the font draws it after NA. That reordering is the font's job, never
      the keyboard's.
    </p>
  </section>

  <section class="about-section reveal" style="--d:0.12s">
    <h2>Two traps <i>in Unicode</i></h2>
    <p>Unicode named the Batak block after Toba readings; Karo differs:</p>
    <div class="trap">
      <b lang="btk">ᯂ</b> — the letter <b>named “HA”</b> (U+1BC2) always reads
      <b>/ka/</b> in Karo. The rare true <i>ha</i> is written with
      <b lang="btk">ᯀ</b> A (U+1BC0), which also carries vowel-initial
      syllables: <i>tuhu</i> → <span lang="btk">ᯗᯬᯀᯬ</span>.
    </div>
    <div class="trap">
      <b lang="btk">◌ᯬ</b> — the vowel sign <b>named “O”</b> (U+1BEC, the
      ×-shape) writes Karo <b>/u/</b>. Karo /o/ uses
      <b lang="btk">◌ᯨ</b> (U+1BE8, named “PAKPAK E”; variant
      <b lang="btk">◌ᯭ</b> KARO O).
    </div>
    <p>
      Latin spelling hides one more ambiguity: plain <b>e</b> covers both the
      schwa (<i>pepet</i> ᯧ) and the full vowel (<i>taling</i> ᯩ). Standard
      Karo text writes both as <b>e</b>, so converting it needs a human
      choice — that is what the marked <b>e</b> toggles in the converter are for.
    </p>
  </section>

  <section class="about-section reveal" style="--d:0.18s">
    <h2>Sources <i>&amp; attribution</i></h2>
    <p>
      Transliteration rules derived from Uli Kozok's <i>Aksara Karo</i>
      lessons and Geoff Woollams, <i>A Grammar of Karo Batak, Sumatra</i>
      (Pacific Linguistics C-130, Australian National University, 1996),
      validated against all 27 attested spellings in the lessons.
      Rendered with Noto Sans Batak (SIL Open Font License), bundled with this
      page. This is a transliterator, not a translator: it writes Karo words
      in the Karo script. Words from other languages are only respelled by
      sound, and the converter labels them as adaptations.
    </p>
  </section>
</div>`;
}
