#!/usr/bin/env python3
"""
Build the Indonesian -> Karo lexicon for Surat Karo's kamus mode.

Sources (all openly licensed or short factual word lists, attributed per entry):
  wikt-lampiran  id.wiktionary Lampiran:Kamus bahasa Indonesia - bahasa Karo
                 (CC BY-SA; itself sourced from Bangun et al. 1999, Kata Tugas
                 Bahasa Karo, Pusat Pembinaan dan Pengembangan Bahasa)
  wikt-btx       id.wiktionary entries in Kategori:Kata bahasa Karo (CC BY-SA)
  detik-100      detik.com "100 Kosakata Bahasa Karo dengan Artinya" (factual
                 word-equivalence list, attributed)
  detik-60       detik.com "60 Kosakata Bahasa Karo Lengkap Dengan Artinya"

Output: src/data/lexicon.json
  { "built": iso-date, "sources": {tag: description},
    "pairs": [{"id": indonesian, "karo": [words], "src": [tags]}] }

Stdlib only. Be polite: identify ourselves, throttle requests.
"""
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

UA = "SuratKaroLexiconBot/1.0 (+https://github.com/odripads/surat-karo; language preservation)"
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "lexicon.json"

SOURCES = {
    "wikt-lampiran": "id.wiktionary Lampiran: Kamus bahasa Indonesia – bahasa Karo (CC BY-SA; after Bangun et al. 1999, Kata Tugas Bahasa Karo)",
    "wikt-btx": "id.wiktionary, Kategori: Kata bahasa Karo (CC BY-SA)",
    "detik-100": "detik.com Sumut, '100 Kosakata Bahasa Karo dengan Artinya' (2024)",
    "detik-60": "detik.com Sumut, '60 Kosakata Bahasa Karo Lengkap Dengan Artinya' (2023)",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def api(host: str, **params) -> dict:
    params.setdefault("format", "json")
    url = f"https://{host}/w/api.php?" + urllib.parse.urlencode(params)
    return json.loads(fetch(url))


SPELLFIX = {"terimakasih": "terima kasih"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s.strip().lower())
    s = re.sub(r"\s+", " ", s)
    s = s.strip(" .,;:!?\"'()")
    return SPELLFIX.get(s, s)


def clean_wiki(s: str) -> str:
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", s)  # [[a|b]] -> b
    s = re.sub(r"\{\{[^}]*\}\}", "", s)  # drop templates
    s = re.sub(r"''+", "", s)
    return s


# --------------------------------------------------------------- collectors

def lampiran():
    """Rows of the id->karo appendix table."""
    data = api(
        "id.wiktionary.org",
        action="parse",
        page="Lampiran:Kamus bahasa Indonesia – bahasa Karo",
        prop="wikitext",
    )
    text = data["parse"]["wikitext"]["*"]
    for m in re.finditer(r"^\|\s*\d+\.\s*\|\|\s*([^|]+?)\s*\|\|\s*(.+?)\s*$", text, re.M):
        indo_raw, karo_raw = clean_wiki(m.group(1)), clean_wiki(m.group(2))
        indos = [norm(x) for x in re.split(r"[/,]", indo_raw)]
        karos = [norm(x) for x in karo_raw.split(",")]
        for indo in indos:
            if indo and karos:
                yield indo, [k for k in karos if k], "wikt-lampiran"


def kategori_btx():
    """id.wiktionary entry pages: Karo headword -> Indonesian gloss."""
    members, cont = [], {}
    while True:
        data = api(
            "id.wiktionary.org",
            action="query",
            list="categorymembers",
            cmtitle="Kategori:Kata bahasa Karo",
            cmlimit="500",
            **cont,
        )
        members += [m["title"] for m in data["query"]["categorymembers"] if m["ns"] == 0]
        cont = data.get("continue", {})
        if not cont:
            break
    for title in members:
        time.sleep(0.3)
        try:
            data = api("id.wiktionary.org", action="parse", page=title, prop="wikitext")
            text = data["parse"]["wikitext"]["*"]
        except Exception as e:
            print(f"  skip {title}: {e}", file=sys.stderr)
            continue
        # isolate the Batak Karo (btx) language section
        m = re.search(r"==\{\{bahasa\|btx\}\}==(.*?)(?===\{\{bahasa\||\Z)", text, re.S)
        if not m:
            continue
        for d in re.finditer(r"^#\s*([^#:*].*)$", m.group(1), re.M):
            gloss = norm(clean_wiki(d.group(1)))
            # keep only tight glosses — long descriptions are not lookup keys
            if gloss and len(gloss.split()) <= 3:
                yield gloss, [norm(title)], "wikt-btx"


DETIK = {
    "detik-100": "https://www.detik.com/sumut/budaya/d-7566321/100-kosakata-bahasa-karo-dengan-artinya-cek-di-sini-yuk",
    "detik-60": "https://www.detik.com/sumut/berita/d-7085646/60-kosakata-bahasa-karo-lengkap-dengan-artinya-pernah-dengar-bujur",
}


def detik():
    """Numbered 'Karo = Indonesian' lists in the two detik articles."""
    for tag, url in DETIK.items():
        try:
            html = fetch(url)
        except Exception as e:
            print(f"  skip {tag}: {e}", file=sys.stderr)
            continue
        n = 0
        # two markups: <li>Karo = Indo</li> and <p>N. Karo : Indo</p>
        items = [m.group(1) for m in re.finditer(r"<li>([^<]+)</li>", html)]
        items += [m.group(1) for m in re.finditer(r"<p>(\s*\d+\.[^<]+)</p>", html)]
        for item in items:
            item = item.replace("&amp;", "&")
            m = re.match(r"^\s*(?:\d+\.\s*)?([^=:]{1,40}?)\s*[=:]\s*(.+)$", item)
            if not m:
                continue
            karo, indo_raw = norm(m.group(1)), m.group(2)
            # direction in the articles is Karo = Indonesian; split "a/b" glosses
            for indo in (norm(x) for x in re.split(r"[/,]", indo_raw)):
                if karo and indo and len(indo.split()) <= 4 and len(karo.split()) <= 3:
                    n += 1
                    yield indo, [karo], tag
        print(f"  {tag}: {n} pairs", file=sys.stderr)


WOOLLAMS_TXT = (
    Path(__file__).resolve().parent.parent.parent
    / "karo-glyph-translator"
    / "resources"
    / "Woollams 1996 - A Grammar of Karo Batak (extracted text).txt"
)

# High-frequency candidates: (indonesian, karo, english gloss to verify).
# An entry is kept ONLY if the Karo word occurs in Woollams (1996) with the
# English gloss within the surrounding context — no unattested entries.
WOOLLAMS_CANDIDATES = [
    ("rumah", "jabu", "house"),
    ("air", "lau", "water"),
    ("nasi", "nakan", "rice"),
    ("tanah", "taneh", "earth"),
    ("orang", "kalak", "person"),
    ("besar", "mbelin", "big"),
    ("kecil", "kitik", "small"),
    ("baik", "mehuli", "good"),
    ("ibu", "nande", "mother"),
    ("bapak", "bapa", "father"),
    ("telinga", "cuping", "ear"),
    ("gunung", "deleng", "mountain"),
    ("daun", "bulung", "leaf"),
    ("malam", "berngi", "night"),
    ("mati", "mate", "die"),
    ("tidur", "medem", "sleep"),
    ("duduk", "kundul", "sit"),
    ("kampung", "kuta", "village"),
    ("jauh", "ndauh", "far"),
    ("banyak", "melala", "many"),
    ("putih", "mbentar", "white"),
    ("hitam", "mbiring", "black"),
    ("merah", "megara", "red"),
    ("nama", "gelar", "name"),
    ("hujan", "udan", "rain"),
    ("ikan", "nurung", "fish"),
    ("anjing", "biang", "dog"),
    ("babi", "babi", "pig"),
    ("jalan", "dalan", "road"),
    ("mata", "mata", "eye"),
]


def woollams():
    """Curated common words, kept only when attested in Woollams (1996)."""
    if not WOOLLAMS_TXT.exists():
        print(f"  Woollams text not found at {WOOLLAMS_TXT}, skipping", file=sys.stderr)
        return
    text = WOOLLAMS_TXT.read_text(encoding="utf-8", errors="replace").lower()
    kept = dropped = 0
    for indo, karo, gloss in WOOLLAMS_CANDIDATES:
        attested = False
        for m in re.finditer(rf"\b{re.escape(karo)}\b", text):
            ctx = text[max(0, m.start() - 80) : m.end() + 80]
            if re.search(rf"\b{re.escape(gloss)}\b", ctx):
                attested = True
                break
        if attested:
            kept += 1
            yield indo, [karo], "woollams-1996"
        else:
            dropped += 1
            print(f"  NOT attested, dropped: {indo} -> {karo} '{gloss}'", file=sys.stderr)
    print(f"  woollams: kept {kept}, dropped {dropped}", file=sys.stderr)


# -------------------------------------------------------------------- merge

def main():
    merged: dict[str, dict[str, set]] = defaultdict(lambda: {"karo": [], "src": set()})
    total = 0
    for collector in (lampiran, kategori_btx, detik, woollams):
        print(f"collecting {collector.__name__} …", file=sys.stderr)
        for indo, karos, src in collector():
            entry = merged[indo]
            for k in karos:
                if k not in entry["karo"]:
                    entry["karo"].append(k)
            entry["src"].add(src)
            total += 1
    pairs = [
        {"id": indo, "karo": e["karo"], "src": sorted(e["src"])}
        for indo, e in sorted(merged.items())
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {"built": date.today().isoformat(), "sources": SOURCES, "pairs": pairs},
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"{total} raw pairs -> {len(pairs)} Indonesian headwords -> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
