#!/usr/bin/env python3
"""
Scrape DTCs from dtcdecode.com for one or more OEMs, including full detail-page
content (sections, lists, tables). Converts DTCs to UDS 3-byte hex and includes
FMI meanings.

Anti-403 measures:
 - Session warm-up (home + OEM page) to collect cookies
 - Browser-like headers, rotating realistic User-Agents
 - Referer headers
 - Jittered delays + exponential backoff retries
 - Optional 'cloudscraper' fetcher
 - Optional headless browser fetcher via undetected-chromedriver

Outputs per OEM (slug as in URL, e.g. "Land-Rover"):
 - <OEM>_dtcs_with_hex.csv          (key fields per DTC)
 - <OEM>_dtcs_sections_long.csv     (long format of all textual content)
 - <OEM>_dtcs.json                  (FULL structured JSON, one file per OEM)
 - tables/<OEM>/<DTC>/table_#.csv   (any tables, exported to CSV)

Usage examples:
  python scrape_dtcs.py
  python scrape_dtcs.py --oems Land-Rover Jaguar --delay 1.8
  python scrape_dtcs.py --fetcher cloudscraper
  python scrape_dtcs.py --fetcher browser --headless
  python scrape_dtcs.py --user-agent "Mozilla/5.0 ..."
"""

import argparse
import csv
import json
import os
import random
import re
import time
from typing import Dict, List, Any, Tuple, Optional

import requests
from bs4 import BeautifulSoup, Tag
from urllib.parse import urljoin, urlparse, urlunparse, parse_qs, urlencode
from tqdm import tqdm
import pandas as pd

BASE = "https://www.dtcdecode.com"

# ---------- FMI (suffix) meanings (Ford/JLR style commonly seen) ----------
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

# ---------- UA rotation & headers ----------
FALLBACK_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

def make_headers(ua: Optional[str] = None, referer: Optional[str] = None) -> Dict[str, str]:
    h = {
        "User-Agent": ua or FALLBACK_UAS[0],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }
    if referer:
        h["Referer"] = referer
    return h

def gentle_sleep(base_delay: float):
    # Add 20–60% jitter
    time.sleep(max(0.05, base_delay * random.uniform(1.2, 1.6)))

# ---------- Fetchers ----------
class BaseFetcher:
    def warmup(self, oem_slug: str): ...
    def get(self, url: str, referer: Optional[str] = None) -> str: ...

class RequestsFetcher(BaseFetcher):
    def __init__(self, base_delay=1.2, user_agent: Optional[str]=None):
        self.s = requests.Session()
        self.base_delay = base_delay
        self.ua_index = 0
        self.custom_ua = user_agent

    def _current_ua(self) -> str:
        return self.custom_ua or FALLBACK_UAS[self.ua_index]

    def rotate_ua(self):
        if self.custom_ua:
            return
        self.ua_index = (self.ua_index + 1) % len(FALLBACK_UAS)

    def warmup(self, oem_slug: str):
        self.s.headers.update(make_headers(self._current_ua()))
        # Visit homepage and OEM list page to collect cookies
        self.get(f"{BASE}/", referer=None)
        self.get(f"{BASE}/{oem_slug}", referer=f"{BASE}/")

    def get(self, url: str, referer: Optional[str] = None) -> str:
        headers = make_headers(self._current_ua(), referer=referer)
        backoff = self.base_delay
        last_exc = None
        for attempt in range(1, 6):
            try:
                resp = self.s.get(url, headers=headers, timeout=25)
                status = resp.status_code
                if status == 403:
                    # rotate UA + wait longer
                    self.rotate_ua()
                    gentle_sleep(backoff * 1.5)
                    backoff *= 1.8
                    continue
                if status in (429, 500, 502, 503, 504):
                    gentle_sleep(backoff)
                    backoff *= 1.7
                    continue
                resp.raise_for_status()
                gentle_sleep(self.base_delay)
                return resp.text
            except requests.RequestException as e:
                last_exc = e
                gentle_sleep(backoff)
                backoff *= 1.7
        if last_exc:
            raise last_exc
        raise RuntimeError("Unreachable")

class CloudscraperFetcher(RequestsFetcher):
    def __init__(self, base_delay=1.2, user_agent: Optional[str]=None):
        try:
            import cloudscraper  # type: ignore
        except ImportError as e:
            raise SystemExit("cloudscraper not installed. pip install cloudscraper") from e
        self.scraper_mod = __import__("cloudscraper")
        self.s = self.scraper_mod.create_scraper()
        self.base_delay = base_delay
        self.ua_index = 0
        self.custom_ua = user_agent

class BrowserFetcher(BaseFetcher):
    def __init__(self, base_delay=1.2, headless=True):
        try:
            import undetected_chromedriver as uc  # type: ignore
            from selenium.webdriver.common.by import By  # type: ignore
            from selenium.webdriver.support.ui import WebDriverWait  # type: ignore
            from selenium.webdriver.support import expected_conditions as EC  # type: ignore
        except ImportError as e:
            raise SystemExit("Browser fetcher requires: pip install undetected-chromedriver selenium") from e
        self.uc = __import__("undetected_chromedriver")
        self.By = __import__("selenium.webdriver.common.by", fromlist=['By']).By
        self.WebDriverWait = __import__("selenium.webdriver.support.ui", fromlist=['WebDriverWait']).WebDriverWait
        self.EC = __import__("selenium.webdriver.support.expected_conditions", fromlist=['EC'])
        opts = self.uc.ChromeOptions()
        if headless:
            opts.add_argument("--headless=new")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        self.driver = self.uc.Chrome(options=opts)
        self.base_delay = base_delay

    def warmup(self, oem_slug: str):
        self.get(f"{BASE}/")
        self.get(f"{BASE}/{oem_slug}")

    def get(self, url: str, referer: Optional[str] = None) -> str:
        self.driver.get(url)
        self.WebDriverWait(self.driver, 25).until(
            self.EC.presence_of_element_located((self.By.TAG_NAME, "body"))
        )
        gentle_sleep(self.base_delay)
        return self.driver.page_source

    def close(self):
        try:
            self.driver.quit()
        except Exception:
            pass

# ---------- Utility ----------
def normalize_url(u: str) -> str:
    p = urlparse(u)
    q = parse_qs(p.query, keep_blank_values=True)
    q_sorted = urlencode(sorted((k, v[0]) for k, v in q.items()))
    return urlunparse((p.scheme, p.netloc, p.path, "", q_sorted, ""))

# ---------- Patterns ----------
DTC_SEGMENT_RE = re.compile(r"^[PCBU][0-9A-F]{4}-[0-9A-F]{2}$", re.IGNORECASE)

# ---------- Discovery ----------
def discover_listing_pages(oem_slug: str, fetcher: BaseFetcher, delay: float, max_pages: Optional[int]=None) -> List[str]:
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

        # Follow pagination that stays under /<OEM>
        for a in soup.select("a[href]"):
            href = a.get("href", "").strip()
            if not href:
                continue
            absu = urljoin(BASE, href)
            if absu.startswith(list_url):
                q.append(absu)

        gentle_sleep(delay)

    return sorted(set(pages))

def extract_dtc_links(oem_slug: str, listing_html: str) -> List[str]:
    soup = BeautifulSoup(listing_html, "html.parser")
    dtc_path_re = re.compile(rf"^/{re.escape(oem_slug)}/[PCBU][0-9A-F]{{4}}-[0-9A-F]{{2}}$", re.IGNORECASE)
    links = []
    for a in soup.select("a[href]"):
        href = a.get("href", "").strip()
        if href and dtc_path_re.match(href):
            links.append(urljoin(BASE, href))
    return sorted(set(links), key=str.lower)

# ---------- DTC helpers ----------
def dtc_to_hex_triplet(dtc: str) -> str:
    """
    Convert 'P05FF-00' -> '05 FF 00'
    """
    base, fmi = dtc.upper().split('-')
    letter, digits = base[0], base[1:]

    nibble_map = {'P': 0x0, 'C': 0x1, 'B': 0x2, 'U': 0x3}
    if letter not in nibble_map:
        raise ValueError(f"Unknown DTC type: {letter}")

    # First two bytes: (type nibble << 12) + 4 hex digits of base
    value = (nibble_map[letter] << 12) + int(digits, 16)
    high = (value >> 8) & 0xFF
    mid = value & 0xFF
    low = int(fmi, 16)
    return f"{high:02X} {mid:02X} {low:02X}"

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

# ---------- Section & table extraction ----------
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
    # Normalize row lengths
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

# ---------- Page parsing ----------
def parse_detail_page(html: str, url: str) -> Dict[str, Any]:
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
        except Exception:
            pass

    sections = extract_sections(soup)
    record["sections"] = sections
    return record

# ---------- Orchestration per OEM ----------
def scrape_oem(oem_slug: str, fetcher: BaseFetcher, delay: float, max_pages: Optional[int]=None):
    print(f"\n=== {oem_slug} ===")
    print("Warming up session…")
    fetcher.warmup(oem_slug)

    print("Discovering listing pages…")
    pages = discover_listing_pages(oem_slug, fetcher, delay, max_pages=max_pages)
    print(f"Found {len(pages)} listing page(s).")

    print("Collecting DTC links…")
    links: List[str] = []
    for p in pages:
        html = fetcher.get(p, referer=f"{BASE}/{oem_slug}")
        links.extend(extract_dtc_links(oem_slug, html))
        gentle_sleep(delay)
    links = sorted(set(links), key=str.lower)
    print(f"Found {len(links)} DTC detail pages.")

    print("Scraping detail pages…")
    records: List[Dict[str, Any]] = []
    sections_long_rows: List[Dict[str, Any]] = []

    for url in tqdm(links, desc=f"{oem_slug} DTC pages"):
        try:
            # Set referer to the OEM list page by default
            html = fetcher.get(url, referer=f"{BASE}/{oem_slug}")
            rec = parse_detail_page(html, url)
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

# ---------- CLI ----------
def build_fetcher(kind: str, delay: float, user_agent: Optional[str], headless: bool):
    kind = kind.lower().strip()
    if kind == "requests":
        return RequestsFetcher(base_delay=delay, user_agent=user_agent)
    if kind == "cloudscraper":
        return CloudscraperFetcher(base_delay=delay, user_agent=user_agent)
    if kind == "browser":
        return BrowserFetcher(base_delay=delay, headless=headless)
    raise SystemExit(f"Unknown --fetcher '{kind}'. Choose: requests | cloudscraper | browser")

def main():
    ap = argparse.ArgumentParser(description="Scrape DTCs (and subpage content) from dtcdecode.com")
    ap.add_argument("--oems", nargs="+", default=["Land-Rover"],
                    help="OEM slugs as in the site URL (e.g., Land-Rover, Jaguar, Ford)")
    ap.add_argument("--delay", type=float, default=1.4,
                    help="Base delay (seconds) between requests (jitter added automatically)")
    ap.add_argument("--user-agent", type=str, default=None,
                    help="Optional custom User-Agent (disables UA rotation)")
    ap.add_argument("--fetcher", type=str, default="requests",
                    help="Fetcher: requests | cloudscraper | browser")
    ap.add_argument("--headless", action="store_true",
                    help="Headless mode for browser fetcher")
    ap.add_argument("--max-pages", type=int, default=None,
                    help="Optional cap on listing pages to crawl (debugging)")
    args = ap.parse_args()

    # Respect robots.txt / terms and use polite delays.
    print("Note: Please ensure scraping complies with the site's Terms and robots.txt.")

    fetcher = build_fetcher(args.fetcher, args.delay, args.user_agent, args.headless)

    try:
        for oem in args.oems:
            oem_slug = oem.strip().strip("/")
            scrape_oem(oem_slug, fetcher, args.delay, max_pages=args.max_pages)
    finally:
        # Close browser if used
        if isinstance(fetcher, BrowserFetcher):
            fetcher.close()

if __name__ == "__main__":
    main()
