import '@fontsource/gentium-book-plus/latin-400.css';
import '@fontsource/gentium-book-plus/latin-400-italic.css';
import '@fontsource/gentium-book-plus/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';

import { convert, type Overrides, type WordPart, type Settings } from './lib/pipeline.ts';
import { applyVariants, charInfo, reverse, type VariantPrefs } from './lib/translit.ts';
import { exportPNG, exportSVG } from './lib/export.ts';
import { renderAbout } from './about.ts';

// ------------------------------------------------------------------- state

interface Prefs extends Settings, VariantPrefs {}

const DEFAULT_PREFS: Prefs = {
  glides: false,
  medialUnit: false,
  iSign: 'karo',
  oSign: 'pakpak',
  killer: 'panongonan',
};

const store = {
  load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`suratkaro:${key}`);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      // merge objects (so new pref keys get defaults); return scalars as-is
      if (typeof fallback === 'object' && fallback !== null && typeof parsed === 'object' && parsed !== null) {
        return { ...fallback, ...parsed };
      }
      return typeof parsed === typeof fallback ? (parsed as T) : fallback;
    } catch {
      return fallback;
    }
  },
  save(key: string, value: unknown): void {
    try {
      localStorage.setItem(`suratkaro:${key}`, JSON.stringify(value));
    } catch {
      /* private mode: fine */
    }
  },
};

let prefs: Prefs = store.load('prefs', DEFAULT_PREFS);
let mode: 'latin' | 'aksara' = 'latin';
const overrides: Overrides = new Map();
let selectedId: string | null = null;
let lastText = ''; // current full output (variants applied) for copy/export

// -------------------------------------------------------------------- els

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;
const input = $<HTMLTextAreaElement>('#input');
const output = $('#output');
const breakdown = $('#breakdown');
const prefsPanel = $('#prefs');
const modeLabel = $('#mode-label');
const outLabel = $('#out-label');
const eNote = $('#e-note');

const variantPrefs = (): VariantPrefs => ({ iSign: prefs.iSign, oSign: prefs.oSign, killer: prefs.killer });
const display = (s: string): string => applyVariants(s, variantPrefs());

// ------------------------------------------------------------- word blocks

function eToggleTitle(reading: 'pepet' | 'taling', explicit: boolean): string {
  return reading === 'pepet'
    ? `read as pepet ᯧ (schwa)${explicit ? '' : ' — assumed'} · tap to switch to taling ᯩ`
    : 'read as taling ᯩ · tap to switch back to pepet ᯧ (schwa)';
}

function renderWord(w: WordPart): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'word' + (w.error ? ' errored' : '') + (w.id === selectedId ? ' selected' : '');
  el.dataset.id = w.id;
  el.title = w.error ? 'No Batak equivalent — passed through unchanged' : 'Tap for syllable breakdown';

  const glyphs = document.createElement('span');
  glyphs.className = 'word-glyphs';
  if (!w.error) glyphs.lang = 'btk';
  glyphs.textContent = w.error ? w.latin : display(w.aksara);
  el.appendChild(glyphs);

  // Latin caption with clickable e/é vowels — the key affordance (spec §7.1)
  const latin = document.createElement('span');
  latin.className = 'word-latin';
  [...w.latin].forEach((ch, i) => {
    const ev = w.eVowels.find((e) => e.index === i);
    if (ev && !w.error) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className =
        'e-toggle' + (ev.explicit ? '' : ' assumed') + (ev.reading === 'taling' ? ' taling' : '');
      b.textContent = ev.reading === 'taling' ? 'é' : 'e';
      b.title = eToggleTitle(ev.reading, ev.explicit);
      b.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const map = overrides.get(w.id) ?? new Map<number, 'pepet' | 'taling'>();
        map.set(i, ev.reading === 'pepet' ? 'taling' : 'pepet');
        overrides.set(w.id, map);
        render();
      });
      latin.appendChild(b);
    } else {
      latin.appendChild(document.createTextNode(ch));
    }
  });
  el.appendChild(latin);

  const badges = document.createElement('span');
  badges.className = 'badges';
  if (w.adapted) {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = 'adaptation';
    b.title =
      'Contains letters with no Batak equivalent (f v q x z) — shown as a nearest-sound respelling, not Karo orthography';
    badges.appendChild(b);
  }
  if (!w.error && /[aeéiou](mb|nd)/.test(w.converted.slice(1))) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'badge warn';
    b.textContent = prefs.medialUnit ? 'mb·nd unit' : 'mb·nd split';
    b.title =
      'Medial mb/nd is genuinely ambiguous: killed coda + onset (default, as in tandang ᯗᯉ᯳ᯑᯰ) or the unit letters ᯣ/ᯢ. Tap to switch (applies to all words).';
    b.addEventListener('click', (evt) => {
      evt.stopPropagation();
      prefs.medialUnit = !prefs.medialUnit;
      syncPrefsPanel();
      persistAndRender();
    });
    badges.appendChild(b);
  }
  if (badges.childElementCount) el.appendChild(badges);

  el.addEventListener('click', () => {
    selectedId = selectedId === w.id ? null : w.id;
    render();
  });
  return el;
}

function renderRaw(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) {
      const br = document.createElement('span');
      br.className = 'line-break';
      frag.appendChild(br);
    }
    if (line) {
      const s = document.createElement('span');
      s.className = 'raw-seg';
      s.textContent = line;
      frag.appendChild(s);
    }
  });
  return frag;
}

// -------------------------------------------------------------- breakdown

function renderBreakdown(w: WordPart): void {
  breakdown.hidden = false;
  breakdown.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'breakdown-head';
  head.innerHTML = `<span class="breakdown-title"><i>${w.latin}</i> — ${w.gloss.length} syllable${w.gloss.length === 1 ? '' : 's'}: ${w.gloss.map((s) => s.latin).join(' · ')}</span>`;
  const close = document.createElement('button');
  close.className = 'breakdown-close';
  close.textContent = 'close ✕';
  close.addEventListener('click', () => {
    selectedId = null;
    render();
  });
  head.appendChild(close);
  breakdown.appendChild(head);

  const row = document.createElement('div');
  row.className = 'syll-row';
  for (const syll of w.gloss) {
    const card = document.createElement('div');
    card.className = 'syll-card';
    const title = document.createElement('div');
    title.className = 'syll-latin';
    title.textContent = syll.latin;
    card.appendChild(title);
    for (const piece of syll.pieces) {
      const ch = display(piece.char);
      const info = charInfo(ch);
      const div = document.createElement('div');
      div.className = 'piece';
      // an isolated diacritic renders with a dotted circle — that is the
      // shaper working correctly, not a bug (spec §9)
      div.innerHTML = `<span class="piece-glyph" lang="btk">${ch}</span>
        <span class="piece-meta">
          <span class="piece-karo">${info.karo}</span>
          <span class="piece-name">${info.unicodeName}</span>
          <span class="piece-cp">${info.cp} · ${piece.role}</span>
        </span>`;
      card.appendChild(div);
    }
    row.appendChild(card);
  }
  breakdown.appendChild(row);
}

// ----------------------------------------------------------------- render

function renderLatinMode(): void {
  const text = input.value;
  output.innerHTML = '';
  if (!text.trim()) {
    output.innerHTML =
      '<p class="output-empty">Type a Karo word above — <i>mejuah-juah</i> becomes <b lang="btk">ᯔᯧᯐᯬᯀᯱ-ᯐᯬᯀᯱ</b></p>';
    breakdown.hidden = true;
    lastText = '';
    return;
  }
  const conv = convert(text, overrides, { glides: prefs.glides, medialUnit: prefs.medialUnit });
  lastText = display(conv.text);
  for (const seg of conv.segments) {
    if (seg.kind === 'raw') output.appendChild(renderRaw(seg.text));
    else output.appendChild(renderWord(seg));
  }
  const selected = conv.words.find((w) => w.id === selectedId && !w.error);
  if (selected) renderBreakdown(selected);
  else {
    selectedId = null;
    breakdown.hidden = true;
  }
}

function renderAksaraMode(): void {
  const text = input.value;
  output.innerHTML = '';
  breakdown.hidden = true;
  if (!text.trim()) {
    output.innerHTML =
      '<p class="output-empty">Paste Aksara Karo above — <b lang="btk">ᯔᯉ᯳</b> becomes <i>man</i></p>';
    lastText = '';
    return;
  }
  let latin = '';
  let hadError = false;
  const out = text.replace(/[ᯀ-᯿]+/g, (run) => {
    try {
      return reverse(run);
    } catch {
      hadError = true;
      return run;
    }
  });
  latin = out;
  lastText = latin;
  const div = document.createElement('div');
  div.className = 'reverse-out';
  div.textContent = latin;
  output.appendChild(div);
  const note = document.createElement('p');
  note.className = 'reverse-note';
  note.textContent = hadError
    ? 'Some characters could not be read — they were left unchanged.'
    : 'Note: ᯀ is read as a bare vowel word-initially and for /a/ sequences (juah), as h before other vowels (tuhu); ᯧ is written e (pepet), ᯩ as é (taling).';
  output.appendChild(note);
}

function render(): void {
  if (mode === 'latin') renderLatinMode();
  else renderAksaraMode();
  autogrow();
}

function persistAndRender(): void {
  store.save('prefs', prefs);
  render();
}

// ------------------------------------------------------------------ input

function autogrow(): void {
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight}px`;
}

input.addEventListener('input', () => {
  store.save('text', input.value);
  render();
});

// é helper: insert at caret (spec feature 2)
$('#btn-eacute').addEventListener('click', () => {
  const { selectionStart: s, selectionEnd: e } = input;
  input.setRangeText('é', s ?? input.value.length, e ?? input.value.length, 'end');
  input.focus();
  store.save('text', input.value);
  render();
});

// keyboard: Ctrl/Cmd+E inserts é
input.addEventListener('keydown', (evt) => {
  if (evt.key.toLowerCase() === 'e' && (evt.ctrlKey || evt.metaKey) && !evt.altKey && !evt.shiftKey) {
    evt.preventDefault();
    $<HTMLButtonElement>('#btn-eacute').click();
  }
});

// ------------------------------------------------------------------- mode

$('#btn-swap').addEventListener('click', () => {
  mode = mode === 'latin' ? 'aksara' : 'latin';
  const latinMode = mode === 'latin';
  modeLabel.textContent = latinMode ? 'Latin → Aksara' : 'Aksara → Latin';
  outLabel.textContent = latinMode ? 'Aksara Karo' : 'Latin';
  input.placeholder = latinMode ? 'mejuah-juah kita kerina' : 'ᯔᯧᯐᯬᯀᯱ-ᯐᯬᯀᯱ';
  input.classList.toggle('input-batak', !latinMode);
  input.style.fontFamily = latinMode ? '' : "'Noto Sans Batak', serif";
  eNote.hidden = !latinMode;
  $<HTMLButtonElement>('#btn-eacute').hidden = !latinMode;
  $<HTMLButtonElement>('#btn-png').hidden = !latinMode;
  $<HTMLButtonElement>('#btn-svg').hidden = !latinMode;
  $<HTMLButtonElement>('#btn-prefs').hidden = !latinMode;
  prefsPanel.hidden = true;
  input.value = '';
  render();
});

// ------------------------------------------------------------ copy/export

function flash(btn: HTMLElement): void {
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 600);
}

$('#btn-copy').addEventListener('click', async (evt) => {
  if (!lastText) return;
  await navigator.clipboard.writeText(lastText);
  flash(evt.currentTarget as HTMLElement);
});

$('#btn-png').addEventListener('click', async (evt) => {
  if (!lastText) return;
  await exportPNG(lastText, 'surat-karo.png');
  flash(evt.currentTarget as HTMLElement);
});

$('#btn-svg').addEventListener('click', async (evt) => {
  if (!lastText) return;
  await exportSVG(lastText, 'surat-karo.svg');
  flash(evt.currentTarget as HTMLElement);
});

// ------------------------------------------------------------------ prefs

$('#btn-prefs').addEventListener('click', (evt) => {
  prefsPanel.hidden = !prefsPanel.hidden;
  (evt.currentTarget as HTMLElement).setAttribute('aria-expanded', String(!prefsPanel.hidden));
});

function syncPrefsPanel(): void {
  for (const el of prefsPanel.querySelectorAll<HTMLInputElement>('input[type=radio]')) {
    el.checked = prefs[el.name as 'iSign' | 'oSign' | 'killer'] === el.value;
  }
  for (const el of prefsPanel.querySelectorAll<HTMLInputElement>('input[type=checkbox]')) {
    el.checked = Boolean(prefs[el.name as 'glides' | 'medialUnit']);
  }
}

prefsPanel.addEventListener('change', (evt) => {
  const el = evt.target as HTMLInputElement;
  const p = prefs as unknown as Record<string, unknown>;
  if (el.type === 'radio') p[el.name] = el.value;
  else p[el.name] = el.checked;
  persistAndRender();
});

// -------------------------------------------------------------------- nav

function setView(view: 'convert' | 'about'): void {
  $('#view-convert').hidden = view !== 'convert';
  $('#view-about').hidden = view !== 'about';
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.nav-link')) {
    a.classList.toggle('active', a.dataset.view === view);
  }
  if (view === 'about' && !$('#view-about').innerHTML) {
    $('#view-about').innerHTML = renderAbout();
  }
}

window.addEventListener('hashchange', () => setView(location.hash === '#about' ? 'about' : 'convert'));

// ------------------------------------------------------------------- init

syncPrefsPanel();
input.value = store.load('text', 'mejuah-juah');
setView(location.hash === '#about' ? 'about' : 'convert');
render();

// offline after first load (nice-to-have per the brief)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
