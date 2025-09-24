#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Playwright-only scraper for dtcdecode.com (Python 3.12 friendly)

- Uses Playwright (Chromium) to fetch pages and auto-accept cookie consent banners.
- Scrapes one or more OEMs (default: Land-Rover).
- Extracts full DTC detail content (definition + h2/h3 sections, lists, tables).
- Converts DTCs to UDS 3-byte hex; includes FMI meanings.
- Outputs per OEM:
    <OEM>_dtcs_with_hex.csv
    <OEM>_dtcs_sections_long.csv
    <OEM>_dtcs.json
    tables/<OEM>/<DTC>/table_#.csv

Install:
  python -m pip install playwright beautifulsoup4 pandas tqdm
  python -m playwright install chromium

Usage:
  python scrape_dtcs_playwright.py --oems Land-Rover --headless --delay 1.8 --verbose
"""

import argparse
import csv
import json
import os
import random
import re
import time
from typing import Dict, List, Any, Tuple, Optional

from bs4 import BeautifulSoup, Tag
from urllib.parse import urljoin, urlparse, urlunparse, parse_qs, urlencode
from tqdm import tqdm
import pandas as pd

BASE = "https://www.dtcdecode.com"

# ----------------------------- small logger -----------------------------------
def vlog(enabled: bool, *args):
    if enabled:
        print("[debug]", *args)

# ------------------- FMI (suffix) meanings (Ford/JLR style) -------------------
FMI_MEANINGS = {
    "00": "General failure / no sub-type",
    "11": "Circuit short to ground",
    "12": "Circuit short to battery/positive",
    "13": "Circuit open",
    "14": "Circuit short to ground or open",
    "15": "Circuit short to battery or open",
    "16": "Circuit voltage below threshold",
    "17": "Circuit voltage above threshold",
    "18": "Circuit current below threshold",
    "19": "Circuit current above threshold",
    "21": "Signal stuck low",
    "22": "Signal stuck high",
    "23": "Signal intermittent/erratic",
    "28": "Signal implausible",
    "29": "Signal invalid",
    "62": "Actuator stuck",
    "63": "Actuator stuck open",
    "64": "Actuator stuck closed",
    "71": "Mechanical failure",
    "72": "Calibration/parameter not learned",
    "73": "Performance/range issue",
    "7A": "Module not configured / software incompatible",
    "7F": "Security/component protection fault",
}
def fmi_meaning(fmi_hex: str) -> str:
    return FMI_MEANINGS.get(fmi_hex.upper(), "")

# ------------------------------ helper utils ----------------------------------
FALLBACK_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

def gentle_sleep(base_delay: float):
    time.sleep(max(0.05, base_delay * random.uniform(1.2, 1.6)))

def normalize_url(u: str) -> str:
    p = urlparse(u)
    q = parse_qs(p.query, keep_blank_values=True)
    q_sorted = urlencode(sorted((k, v[0]) for k, v in q.items()))
    return urlunparse((p.scheme, p.netloc, p.path, "", q_sorted, ""))

# --------------------------------- patterns -----------------------------------
DTC_SEGMENT_RE = re.compile(r"^[PCBU][0-9A-F]{4}-[0-9A-F]{2}$", re.IGNORECASE)

# ----------------------------- Playwright fetcher ------------------------------
class PlaywrightFetcher:
    def __init__(self, base_delay=1.5, headless=True, proxy: Optional[str]=None,
                 cookie_header: Optional[str]=None, verbose: bool=False):
        try:
            from playwright.sync_api import sync_playwright  # type: ignore
        except ImportError as e:
            raise SystemExit("Playwright not installed. Run:\n"
                             "  python -m pip install playwright\n"
                             "  python -m playwright install chromium") from e
        self._pw = sync_playwright().start()
        launch_args = {"headless": headless}
        if proxy:
            launch_args["proxy"] = {"server": proxy}
        self.browser = self._pw.chromium.launch(**launch_args)
        # Extra headers (UA & language) to look more like a real browser
        self.context = self.browser.new_context(
            locale="en-GB",
            user_agent=FALLBACK_UA,
        )
        if cookie_header:
            self._apply_cookie_header(cookie_header)
        self.page = self.context.new_page()
        self.base_delay = base_delay
        self.verbose = verbose

    def _apply_cookie_header(self, cookie_header: str):
        # crude Cookie: "k=v; k2=v2" parser -> add cookies for dtcdecode.com
        pairs = [c.strip() for c in cookie_header.split(";") if "=" in c]
        cookies = []
        for p in pairs:
            k, v = p.split("=", 1)
            cookies.append({
                "name": k.strip(),
                "value": v.strip(),
                "domain": "www.dtcdecode.com",
                "path": "/",
                "httpOnly": False,
                "secure": True,
            })
        if cookies:
            self.context.add_cookies(cookies)

    def _log(self, *a):
        if self.verbose:
            print("[playwright]", *a)

    # rudimentary consent clicker
    def _accept_consent(self):
        sel_candidates = [
            "#onetrust-accept-btn-handler",
            "button#onetrust-accept-btn-handler",
            ".qc-cmp2-summary-buttons .qc-cmp2-accept-all",
            ".qc-cmp2-footer .qc-cmp2-accept-all",
            "button[aria-label*='Accept' i]",
            "button[aria-label*='Agree' i]",
            "button[data-action='accept-all']",
            "text=/^(Accept all|I agree|Agree|Allow all)$/i",
        ]
        # try main page
        for sel in sel_candidates:
            try:
                el = self.page.locator(sel)
                if el.first.is_visible():
                    el.first.click(timeout=1000)
                    self._log("consent accepted:", sel)
                    return
            except Exception:
                pass
        # try iframes
        for frame in self.page.frames:
            for sel in sel_candidates:
                try:
                    el = frame.locator(sel)
                    if el.first.is_visible():
                        el.first.click(timeout=1000)
                        self._log("consent accepted in iframe:", sel)
                        return
                except Exception:
                    pass

    def warmup(self, oem_slug: str):
        self.get(f"{BASE}/")
        self.get(f"{BASE}/{oem_slug}")

    def get(self, url: str, referer: Optional[str] = None) -> str:
        self._log("GET", url)
        kwargs = {"wait_until": "domcontentloaded", "timeout": 30000}
        if referer:
            kwargs["referer"] = referer
        self.page.goto(url, **kwargs)
        try:
            self._accept_consent()
        except Exception:
            pass
        gentle_sleep(self.base_delay)  # polite & let JS settle
        return self.page.content()

    def close(self):
        try:
            self.context.close()
            self.browser.close()
            self._pw.stop()
        except Exception:
            pass

# ---------------------------------- parsing -----------------------------------
def parse_title_and_definition(soup: BeautifulSoup) -> Tuple[Optional[str], Optional[str]]:
    h1 = soup.find("h1")
    dtc, definition = None, None
    if h1:
        text = " ".join(h1.get_text(" ", strip=True).split())
        m = re.match(r"^([PCBU][0-9A-F]{4}-[0-9A-F]{2})\s*[–-]\s*(.+)$", text, re.IGNORECASE)
        if m:
            dtc, definition = m.group(1).upper(), m.group(2).strip()
        else:
            tok = text.split()
            if tok and DTC_SEGMENT_RE.match(tok[0]):
                dtc = tok[0].upper()
                definition = text[len(tok[0]):].strip(" –-:") or None
    return dtc, definition

def dtc_to_hex_triplet(dtc: str) -> str:
    base, fmi = dtc.upper().split('-')
    letter, digits = base[0], base[1:]
    nibble_map = {'P': 0x0, 'C': 0x1, 'B': 0x2, 'U': 0x3}
    if letter not in nibble_map:
        raise ValueError(f"Unknown DTC type: {letter}")
    value = (nibble_map[letter] << 12) + int(digits, 16)
    high = (value >> 8) & 0xFF
    mid = value & 0xFF
    low = int(fmi, 16)
    return f"{high:02X} {mid:02X} {low:02X}"

def html_table_to_data(table_tag: Tag) -> Dict[str, Any]:
    headers = []
    for th in table_tag.select("thead th"):
        headers.append(" ".join(th.get_text(" ", strip=True).split()))
    rows = []
    for tr in table_tag.select("tr"):
        cells = [" ".join(td.get_text(" ", strip=True).split()) for td in tr.find_all(["td", "th"])]
        if cells:
            rows.append(cells)
    if not headers and rows:
        headers = rows[0]
        rows = rows[1:]
    norm_rows = []
    h = len(headers)
    for r in rows:
        if len(r) < h:
            r = r + [""] * (h - len(r))
        elif len(r) > h:
            headers = headers + [f"col_{i}" for i in range(h, len(r))]
            h = len(headers)
        norm_rows.append(r)
    return {"headers": headers, "rows": norm_rows}

def extract_sections(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    sections = []
    headings = soup.select("h2, h3")
    if not headings:
        return sections

    def collect_after(heading: Tag) -> List[Dict[str, Any]]:
        chunks = []
        sib = heading.next_sibling
        while sib:
            if isinstance(sib, Tag) and sib.name in ("h1", "h2", "h3"):
                break
            if isinstance(sib, Tag):
                if sib.name == "p":
                    t = " ".join(sib.get_text(" ", strip=True).split())
                    if t:
                        chunks.append({"kind": "paragraph", "text": t})
                elif sib.name in ("ul", "ol"):
                    items = []
                    for li in sib.select("li"):
                        t = " ".join(li.get_text(" ", strip=True).split())
                        if t:
                            items.append(t)
                    if items:
                        chunks.append({"kind": "list", "items": items})
                elif sib.name == "table":
                    table = html_table_to_data(sib)
                    if table:
                        chunks.append({"kind": "table", "table": table})
                elif sib.name == "div":
                    t = " ".join(sib.get_text(" ", strip=True).split())
                    if t:
                        chunks.append({"kind": "paragraph", "text": t})
            sib = sib.next_sibling
        return chunks

    for idx, h in enumerate(headings):
        title = " ".join(h.get_text(" ", strip=True).split())
        content = collect_after(h)
        if content:
            sections.append({"title": title, "order_index": idx, "content": content})
    return sections

def parse_detail_page(html: str, url: str, verbose: bool=False) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    dtc, definition = parse_title_and_definition(soup)
    if not dtc:
        dtc = url.rstrip("/").split("/")[-1].upper()
    record: Dict[str, Any] = {"dtc": dtc, "url": url, "definition": definition}
    if DTC_SEGMENT_RE.match(dtc):
        base, fmi = dtc.upper().split("-")
        record["base_code"] = base
        record["fmi_hex"] = fmi
        record["fmi_meaning"] = fmi_meaning(fmi)
        try:
            record["hex_triplet"] = dtc_to_hex_triplet(dtc)
        except Exception as e:
            vlog(verbose, f"hex_triplet conversion failed for {dtc}: {e}")
    record["sections"] = extract_sections(soup)
    return record

# -------------------------- discovery & orchestration --------------------------
def discover_listing_pages(oem_slug: str, fetcher: PlaywrightFetcher, delay: float,
                           max_pages: Optional[int]=None, verbose: bool=False) -> List[str]:
    list_url = f"{BASE}/{oem_slug}"
    seen = set()
    q = [list_url]
    pages = []
    while q:
        url = q.pop(0)
        nu = normalize_url(url)
        if nu in seen:
            continue
        seen.add(nu)
        html = fetcher.get(url, referer=f"{BASE}/")
        soup = BeautifulSoup(html, "html.parser")
        pages.append(url)
        if max_pages and len(pages) >= max_pages:
            break
        for a in soup.select("a[href]"):
            href = a.get("href", "").strip()
            if not href:
                continue
            absu = urljoin(BASE, href)
            if absu.startswith(list_url):
                q.append(absu)
        gentle_sleep(delay)
    vlog(verbose, f"discovered listing pages: {pages}")
    return sorted(set(pages))

def extract_dtc_links(oem_slug: str, listing_html: str, verbose: bool=False) -> List[str]:
    soup = BeautifulSoup(listing_html, "html.parser")
    dtc_path_re = re.compile(rf"^/{re.escape(oem_slug)}/[PCBU][0-9A-F]{{4}}-[0-9A-F]{{2}}$", re.IGNORECASE)
    links = []
    for a in soup.select("a[href]"):
        href = a.get("href", "").strip()
        if href and dtc_path_re.match(href):
            links.append(urljoin(BASE, href))
    links = sorted(set(links), key=str.lower)
    vlog(verbose, f"found {len(links)} dtc links on listing page")
    return links

def discover_listing_and_links(oem_slug: str, fetcher: PlaywrightFetcher, delay: float,
                               max_pages: Optional[int], verbose: bool=False) -> List[str]:
    pages = discover_listing_pages(oem_slug, fetcher, delay, max_pages, verbose)
    links: List[str] = []
    for p in pages:
        html = fetcher.get(p, referer=f"{BASE}/{oem_slug}")
        links.extend(extract_dtc_links(oem_slug, html, verbose))
        gentle_sleep(delay)
    return sorted(set(links), key=str.lower)

def save_tables_for_dtc(oem_slug: str, dtc: str, sections: List[Dict[str, Any]]):
    out_dir = os.path.join("tables", oem_slug, dtc)
    os.makedirs(out_dir, exist_ok=True)
    table_idx = 1
    for sec in sections:
        for chunk in sec["content"]:
            if chunk["kind"] == "table":
                headers = chunk["table"]["headers"]
                rows = chunk["table"]["rows"]
                df = pd.DataFrame(rows, columns=headers if headers else None)
                df.to_csv(os.path.join(out_dir, f"table_{table_idx}.csv"), index=False, encoding="utf-8")
                table_idx += 1

def scrape_oem(oem_slug: str, fetcher: PlaywrightFetcher, delay: float, max_pages: Optional[int],
               no_warmup: bool, verbose: bool):
    print(f"\n=== {oem_slug} ===")
    if not no_warmup:
        print("Warming up session…")
        try:
            fetcher.warmup(oem_slug)
        except Exception as e:
            print("Warmup failed (continuing):", e)

    print("Discovering listing pages…")
    links = discover_listing_and_links(oem_slug, fetcher, delay, max_pages, verbose)
    print(f"Found {len(links)} DTC detail pages.")

    print("Scraping detail pages…")
    records: List[Dict[str, Any]] = []
    sections_long_rows: List[Dict[str, Any]] = []

    for url in tqdm(links, desc=f"{oem_slug} DTC pages"):
        try:
            html = fetcher.get(url, referer=f"{BASE}/{oem_slug}")
            rec = parse_detail_page(html, url, verbose=verbose)
            dtc_fs = rec.get("dtc", "UNKNOWN").replace("/", "_")
            if rec.get("sections"):
                save_tables_for_dtc(oem_slug, dtc_fs, rec["sections"])
                for sec in rec["sections"]:
                    title = sec["title"]
                    order_index = sec["order_index"]
                    for chunk in sec["content"]:
                        if chunk["kind"] == "paragraph":
                            sections_long_rows.append({
                                "dtc": rec.get("dtc"),
                                "section_title": title,
                                "order_index": order_index,
                                "kind": "paragraph",
                                "text": chunk["text"]
                            })
                        elif chunk["kind"] == "list":
                            for item in chunk["items"]:
                                sections_long_rows.append({
                                    "dtc": rec.get("dtc"),
                                    "section_title": title,
                                    "order_index": order_index,
                                    "kind": "list_item",
                                    "text": item
                                })
                        elif chunk["kind"] == "table":
                            sections_long_rows.append({
                                "dtc": rec.get("dtc"),
                                "section_title": title,
                                "order_index": order_index,
                                "kind": "table",
                                "text": "(see tables folder)"
                            })
            records.append(rec)
        except Exception as e:
            records.append({"dtc": None, "url": url, "error": str(e)})
        gentle_sleep(delay)

    # Write per-OEM outputs
    base_name = oem_slug
    wide_csv = f"{base_name}_dtcs_with_hex.csv"
    long_csv = f"{base_name}_dtcs_sections_long.csv"
    json_path = f"{base_name}_dtcs.json"

    fieldnames = ["dtc", "base_code", "fmi_hex", "fmi_meaning", "hex_triplet", "definition", "url"]
    with open(wide_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in records:
            row = {k: r.get(k) for k in fieldnames}
            w.writerow(row)

    if sections_long_rows:
        with open(long_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["dtc", "section_title", "order_index", "kind", "text"])
            w.writeheader()
            for row in sections_long_rows:
                w.writerow(row)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print("Done for", oem_slug)
    print(" -", wide_csv)
    print(" -", long_csv)
    print(" -", json_path)
    print(" - tables/{}/<DTC>/table_#.csv".format(oem_slug))

# -------------------------------------- CLI -----------------------------------
def main():
    ap = argparse.ArgumentParser(description="Playwright scraper for dtcdecode.com (full DTC pages)")
    ap.add_argument("--oems", nargs="+", default=["Land-Rover"],
                    help="OEM slugs as in the URL (e.g., Land-Rover, Jaguar, Ford)")
    ap.add_argument("--delay", type=float, default=1.8,
                    help="Base delay (seconds) between requests (jitter added automatically)")
    ap.add_argument("--headless", action="store_true",
                    help="Run Chromium headless")
    ap.add_argument("--proxy", type=str, default=None,
                    help="Proxy URL, e.g. http://user:pass@host:port")
    ap.add_argument("--cookie", type=str, default=None,
                    help='Optional Cookie header (e.g., "cf_clearance=...; other=...")')
    ap.add_argument("--max-pages", type=int, default=None,
                    help="Cap listing pages for debugging")
    ap.add_argument("--no-warmup", action="store_true",
                    help="Skip warmup hits")
    ap.add_argument("--verbose", action="store_true",
                    help="Verbose logs")
    args = ap.parse_args()

    print("Note: Please ensure scraping complies with the site's Terms and robots.txt.")

    fetcher = PlaywrightFetcher(
        base_delay=args.delay,
        headless=args.headless,
        proxy=args.proxy,
        cookie_header=args.cookie,
        verbose=args.verbose
    )

    try:
        for oem in args.oems:
            oem_slug = oem.strip().strip("/")
            scrape_oem(oem_slug, fetcher, args.delay, args.max_pages, args.no_warmup, args.verbose)
    finally:
        fetcher.close()

if __name__ == "__main__":
    main()
