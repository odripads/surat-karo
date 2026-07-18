/*
 * PNG / SVG export of Aksara Karo text.
 * The browser's shaper does the visual reordering, so canvas fillText is
 * already correct once the bundled font is loaded. The SVG embeds the woff2
 * as a data: URI so the file renders anywhere (browsers, not just this app).
 */

const FONT = 'Noto Sans Batak';
const FONT_URL = 'fonts/NotoSansBatak.woff2'; // relative: survives subpath deploys
const INK = '#211a11';

async function ensureFont(px: number): Promise<void> {
  await document.fonts.load(`${px}px "${FONT}"`, 'ᯀ');
}

function download(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

function measure(text: string, px: number): { width: number; ascent: number; descent: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${px}px "${FONT}", serif`;
  const m = ctx.measureText(text);
  return {
    width: m.width,
    ascent: m.fontBoundingBoxAscent ?? px * 1.1,
    descent: m.fontBoundingBoxDescent ?? px * 0.4,
  };
}

export async function exportPNG(text: string, filename: string, px = 160): Promise<void> {
  await ensureFont(px);
  const pad = px * 0.25;
  const { width, ascent, descent } = measure(text, px);
  const canvas = document.createElement('canvas');
  const scale = 2; // crisp on retina
  canvas.width = Math.ceil((width + pad * 2) * scale);
  canvas.height = Math.ceil((ascent + descent + pad * 2) * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.font = `${px}px "${FONT}", serif`;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, pad, pad + ascent);
  download(canvas.toDataURL('image/png'), filename);
}

let fontDataUri: string | null = null;

async function getFontDataUri(): Promise<string> {
  if (fontDataUri) return fontDataUri;
  const buf = await (await fetch(FONT_URL)).arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  fontDataUri = `data:font/woff2;base64,${btoa(bin)}`;
  return fontDataUri;
}

export async function exportSVG(text: string, filename: string, px = 160): Promise<void> {
  await ensureFont(px);
  const pad = px * 0.25;
  const { width, ascent, descent } = measure(text, px);
  const w = (width + pad * 2).toFixed(1);
  const h = (ascent + descent + pad * 2).toFixed(1);
  const font = await getFontDataUri();
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <style>@font-face{font-family:'${FONT}';src:url('${font}') format('woff2');}</style>
  <text x="${pad}" y="${(pad + ascent).toFixed(1)}" font-family="'${FONT}'" font-size="${px}" fill="${INK}">${esc}</text>
</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
