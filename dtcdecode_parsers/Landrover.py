#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Playwright scraper for dtcdecode.com — STREAMING writes + lazy-load discovery

Features
- Auto-accepts common cookie consent banners.
- Robust discovery: auto-scrolls to trigger lazy loading and collects links; also falls
  back to scanning visible text for DTC-shaped tokens if anchors are missing.
- Writes per DTC page immediately:
    * <OEM>_dtcs.ndjson            (one JSON object per line)
    * <OEM>_dtcs_with_hex.csv      (summary, appended & flushed)
    * <OEM>_dtcs_sections_long.csv (all text/list/table markers, appended & flushed)
    * tables/<OEM>/<DTC>/table_#.csv  (any tables)
- Debug option saves a few raw HTML pages.
"""

import argparse, csv, json, os, random, re, time
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

# ------------------------------ helpers ---------------------------------------
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
    return urlunparse((p.scheme, p.netloc, p.path.rstrip("/"), "", q_sorted, ""))

DTC_SEGMENT_RE = re.compile(r"^[PCBU][0-9A-F]{4}-[0-9A-F]{2}$", re.IGNORECASE)

# ----------------------------- Playwright fetcher ------------------------------
class PlaywrightFetcher:
    def __init__(self, base_delay=1.8, headless=True, proxy: Optional[str]=None,
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
        pairs = [c.strip() for c in cookie_header.split(";") if "=" in c]
        cookies = []
        for p in pairs:
            k, v = p.split("=", 1)
            cookies.append({
                "name": k.strip(), "value": v.strip(),
                "domain": "www.dtcdecode.com", "path": "/",
                "httpOnly": False, "secure": True,
            })
        if cookies:
            self.context.add_cookies(cookies)

    def _log(self, *a):
        if self.verbose:
            print("[playwright]", *a)

    # cookie consent
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
        # main page
        for sel in sel_candidates:
            try:
                el = self.page.locator(sel)
                if el.first.is_visible():
                    el.first.click(timeout=1000)
                    self._log("consent accepted:", sel)
                    return
            except Exception:
                pass
        # iframes
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
        self.get(f"{BASE}/"); self.get(f"{BASE}/{oem_slug}")

    def get(self, url: str, referer: Optional[str] = None) -> str:
        self._log("GET", url)
        kwargs = {"wait_until": "domcontentloaded", "timeout": 45000}
        if referer:
            kwargs["referer"] = referer
        self.page.goto(url, **kwargs)
        try:
            self._accept_consent()
        except Exception:
            pass
        gentle_sleep(self.base_delay)  # polite
        return self.page.content()

    def get_dtc_links(self, oem_slug: str, max_scrolls: int = 8, scroll_wait_ms: int = 500) -> List[str]:
        """
        Scrolls the page to trigger lazy loading, then collects anchors that look
        like DTC detail links. Falls back to scanning visible text for DTC tokens.
        """
        # 1) Trigger lazy loading by scrolling
        try:
            last_h = 0
            for _ in range(max_scrolls):
                self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                self.page.wait_for_timeout(scroll_wait_ms)
                h = self.page.evaluate("document.body.scrollHeight")
                if h == last_h:
                    break
                last_h = h
        except Exception:
            pass

        hrefs = []
        # 2) Collect anchors
        try:
            anchors = self.page.locator("a[href]").all()
            for a in anchors:
                href = a.get_attribute("href") or ""
                if not href:
                    continue
                if href.startswith(("http://", "https://")):
                    hrefs.append(href)
                else:
                    hrefs.append(urljoin(BASE, href))
        except Exception:
            pass

        # 3) Fallback: scan page text for DTC-shaped tokens
        try:
            body_text = self.page.locator("body").inner_text(timeout=2000)
            codes = set(re.findall(r"\b[PCBU][0-9A-F]{4}-[0-9A-F]{2}\b", body_text, flags=re.IGNORECASE))
            for code in codes:
                hrefs.append(f"{BASE}/{oem_slug}/{code.upper()}")
        except Exception:
            pass

        # 4) Keep only this OEM + DTC detail shape
        dtc_pat = re.compile(rf"/{re.escape(oem_slug)}/[PCBU][0-9A-F]{{4}}-[0-9A-F]{{2}}$", re.IGNORECASE)
        cleaned = []
        for u in hrefs:
            try:
                u = normalize_url(u)
                if dtc_pat.search(urlparse(u).path):
                    cleaned.append(u)
            except Exception:
                continue
        return sorted(set(cleaned))

    def close(self):
        try:
            self.context.close(); self.browser.close(); self._pw.stop()
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
            return m.group(1).upper(), m.group(2).strip()
        tok = text.split()
        if tok and DTC_SEGMENT_RE.match(tok[0]):
            return tok[0].upper(), text[len(tok[0]):].strip(" –-:") or None
    # fallback to <title>
    title = soup.find("title")
    if title:
        t = " ".join(title.get_text(" ", strip=True).split())
        m = re.search(r"([PCBU][0-9A-F]{4}-[0-9A-F]{2})", t, re.IGNORECASE)
        if m:
            code = m.group(1).upper()
            rest = t.replace(code, "").strip(" –-:|")
            return code, rest or None
    return None, None

def dtc_to_hex_triplet(dtc: str) -> str:
    base, fmi = dtc.upper().split('-')
    letter, digits = base[0], base[1:]
    nibble_map = {'P': 0x0, 'C': 0x1, 'B': 0x2, 'U': 0x3}
    value = (nibble_map[letter] << 12) + int(digits, 16)
    high = (value >> 8) & 0xFF; mid = value & 0xFF; low = int(fmi, 16)
    return f"{high:02X} {mid:02X} {low:02X}"

def html_table_to_data(table_tag: Tag) -> Dict[str, Any]:
    headers = [ " ".join(th.get_text(" ", strip=True).split()) for th in table_tag.select("thead th") ]
    rows = []
    for tr in table_tag.select("tr"):
        cells = [" ".join(td.get_text(" ", strip=True).split()) for td in tr.find_all(["td","th"])]
        if cells: rows.append(cells)
    if not headers and rows: headers, rows = rows[0], rows[1:]
    norm_rows = []
    h = len(headers)
    for r in rows:
        if len(r) < h: r = r + [""] * (h-len(r))
        elif len(r) > h: headers = headers + [f"col_{i}" for i in range(h, len(r))]; h = len(headers)
        norm_rows.append(r)
    return {"headers": headers, "rows": norm_rows}

def extract_sections(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    sections, headings = [], soup.select("h2, h3")
    if not headings: return sections
    def collect_after(heading: Tag) -> List[Dict[str, Any]]:
        chunks, sib = [], heading.next_sibling
        while sib:
            if isinstance(sib, Tag) and sib.name in ("h1","h2","h3"): break
            if isinstance(sib, Tag):
                if sib.name == "p":
                    t = " ".join(sib.get_text(" ", strip=True).split()); 
                    if t: chunks.append({"kind":"paragraph","text":t})
                elif sib.name in ("ul","ol"):
                    items = []
                    for li in sib.select("li"):
                        t = " ".join(li.get_text(" ", strip=True).split()); 
                        if t: items.append(t)
                    if items: chunks.append({"kind":"list","items":items})
                elif sib.name == "table":
                    table = html_table_to_data(sib); 
                    if table: chunks.append({"kind":"table","table":table})
                elif sib.name == "div":
                    t = " ".join(sib.get_text(" ", strip=True).split());
                    if t: chunks.append({"kind":"paragraph","text":t})
            sib = sib.next_sibling
        return chunks
    for idx, h in enumerate(headings):
        title = " ".join(h.get_text(" ", strip=True).split())
        content = collect_after(h)
        if content: sections.append({"title": title, "order_index": idx, "content": content})
    return sections

def parse_detail_page(html: str, url: str, verbose: bool=False) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    dtc, definition = parse_title_and_definition(soup)
    if not dtc: dtc = url.rstrip("/").split("/")[-1].upper()
    record: Dict[str, Any] = {"dtc": dtc, "url": url, "definition": definition}
    if DTC_SEGMENT_RE.match(dtc):
        base, fmi = dtc.upper().split("-")
        record["base_code"], record["fmi_hex"], record["fmi_meaning"] = base, fmi, fmi_meaning(fmi)
        try: record["hex_triplet"] = dtc_to_hex_triplet(dtc)
        except Exception as e: vlog(verbose, f"hex_triplet conversion failed for {dtc}: {e}")
    record["sections"] = extract_sections(soup)
    return record

# -------------------------- discovery & orchestration --------------------------
def discover_listing_pages(oem_slug: str, fetcher: PlaywrightFetcher, delay: float,
                           max_pages: Optional[int]=None, verbose: bool=False) -> List[str]:
    list_url = f"{BASE}/{oem_slug}"
    seen, q, pages = set(), [list_url], []
    while q:
        url = q.pop(0)
        nu = normalize_url(url)
        if nu in seen: continue
        seen.add(nu)
        html = fetcher.get(url, referer=f"{BASE}/")
        soup = BeautifulSoup(html, "html.parser")
        pages.append(url)
        if max_pages and len(pages) >= max_pages: break
        for a in soup.select("a[href]"):
            href = a.get("href", "").strip()
            if not href: continue
            absu = urljoin(BASE, href)
            if absu.startswith(list_url): q.append(absu)
        gentle_sleep(delay)
    vlog(verbose, f"discovered listing pages: {pages}")
    return sorted(set(pages))

def extract_dtc_links_playwright(oem_slug: str, fetcher: PlaywrightFetcher,
                                 listing_url: str, verbose: bool=False,
                                 max_scrolls: int = 8, scroll_wait_ms: int = 500) -> List[str]:
    fetcher.get(listing_url, referer=f"{BASE}/")
    links = fetcher.get_dtc_links(oem_slug, max_scrolls=max_scrolls, scroll_wait_ms=scroll_wait_ms)
    pat = re.compile(rf"/{re.escape(oem_slug)}/[PCBU][0-9A-F]{{4}}-[0-9A-F]{{2}}$", re.IGNORECASE)
    cleaned = []
    for u in links:
        path = urlparse(u).path
        if pat.search(path): cleaned.append(normalize_url(u))
    cleaned = sorted(set(cleaned))
    vlog(verbose, f"{listing_url} -> {len(cleaned)} dtc links")
    if verbose and cleaned: print("[debug] sample:", cleaned[:5])
    return cleaned

def discover_listing_and_links(oem_slug: str, fetcher: PlaywrightFetcher, delay: float,
                               max_pages: Optional[int], verbose: bool=False,
                               max_scrolls: int = 8, scroll_wait_ms: int = 500) -> List[str]:
    pages = discover_listing_pages(oem_slug, fetcher, delay, max_pages, verbose)
    all_links: List[str] = []
    for p in pages:
        all_links.extend(extract_dtc_links_playwright(
            oem_slug, fetcher, p, verbose, max_scrolls=max_scrolls, scroll_wait_ms=scroll_wait_ms
        ))
        gentle_sleep(delay)
    return sorted(set(all_links), key=str.lower)

def ensure_dir(p): os.makedirs(p, exist_ok=True)

def scrape_oem(oem_slug: str, fetcher: PlaywrightFetcher, delay: float, max_pages: Optional[int],
               no_warmup: bool, verbose: bool, output_dir: str, flush_every: int, debug_html_max: int,
               max_scrolls: int, scroll_wait_ms: int):
    print(f"\n=== {oem_slug} ===")
    ensure_dir(output_dir)
    dbg_dir = os.path.join(output_dir, "debug_html"); ensure_dir(dbg_dir)
    tables_root = os.path.join(output_dir, "tables", oem_slug); ensure_dir(tables_root)

    # Output file paths
    base_name = os.path.join(output_dir, oem_slug)
    wide_csv = f"{base_name}_dtcs_with_hex.csv"
    long_csv = f"{base_name}_dtcs_sections_long.csv"
    jsonl_path = f"{base_name}_dtcs.ndjson"     # streaming
    json_path = f"{base_name}_dtcs.json"        # final aggregate (at end)

    # Prepare CSV writers (header written once)
    wide_fields = ["dtc","base_code","fmi_hex","fmi_meaning","hex_triplet","definition","url"]
    long_fields = ["dtc","section_title","order_index","kind","text"]
    wide_f = open(wide_csv, "w", newline="", encoding="utf-8"); wide_w = csv.DictWriter(wide_f, fieldnames=wide_fields); wide_w.writeheader()
    long_f = open(long_csv, "w", newline="", encoding="utf-8"); long_w = csv.DictWriter(long_f, fieldnames=long_fields); long_w.writeheader()
    jsonl_f = open(jsonl_path, "w", encoding="utf-8")

    if not no_warmup:
        print("Warming up session…")
        try: fetcher.warmup(oem_slug)
        except Exception as e: print("Warmup failed (continuing):", e)

    print("Discovering listing pages & DTC links…")
    links = discover_listing_and_links(oem_slug, fetcher, delay, max_pages, verbose,
                                       max_scrolls=max_scrolls, scroll_wait_ms=scroll_wait_ms)
    print(f"Found {len(links)} DTC detail pages.")

    records: List[Dict[str, Any]] = []
    wrote = 0
    debug_saved = 0

    def write_record(rec: Dict[str, Any]):
        nonlocal wrote
        # JSONL per record
        jsonl_f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        wrote += 1
        # summary CSV row
        wide_w.writerow({k: rec.get(k) for k in wide_fields})
        # long CSV rows
        for sec in rec.get("sections", []) or []:
            title = sec["title"]; idx = sec["order_index"]
            for chunk in sec["content"]:
                if chunk["kind"] == "paragraph":
                    long_w.writerow({"dtc": rec.get("dtc"), "section_title": title, "order_index": idx, "kind": "paragraph", "text": chunk["text"]})
                elif chunk["kind"] == "list":
                    for item in chunk["items"]:
                        long_w.writerow({"dtc": rec.get("dtc"), "section_title": title, "order_index": idx, "kind": "list_item", "text": item})
                elif chunk["kind"] == "table":
                    long_w.writerow({"dtc": rec.get("dtc"), "section_title": title, "order_index": idx, "kind": "table", "text": "(see tables folder)"})
        # flush regularly so Ctrl-C preserves recent work
        if wrote % flush_every == 0:
            wide_f.flush(); long_f.flush(); jsonl_f.flush()

    print("Scraping detail pages (streaming writes)…")
    try:
        for url in tqdm(links, desc=f"{oem_slug} DTC pages"):
            try:
                html = fetcher.get(url, referer=f"{BASE}/{oem_slug}")
                # Save a few HTMLs for debugging if needed
                if verbose and debug_saved < debug_html_max:
                    fn = os.path.join(output_dir, "debug_html", urlparse(url).path.replace("/", "_").lstrip("_") + ".html")
                    with open(fn, "w", encoding="utf-8") as hf: hf.write(html)
                    debug_saved += 1

                rec = parse_detail_page(html, url, verbose=verbose)

                # Save any tables
                if rec.get("sections"):
                    for sec in rec["sections"]:
                        for chunk in sec["content"]:
                            if chunk["kind"] == "table":
                                headers = chunk["table"]["headers"]; rows = chunk["table"]["rows"]
                                dtc_fs = (rec.get("dtc", "UNKNOWN") or "UNKNOWN").replace("/", "_")
                                out_dir = os.path.join(tables_root, dtc_fs)
                                os.makedirs(out_dir, exist_ok=True)
                                idx = len([n for n in os.listdir(out_dir) if n.startswith("table_") and n.endswith(".csv")]) + 1
                                df = pd.DataFrame(rows, columns=headers if headers else None)
                                df.to_csv(os.path.join(out_dir, f"table_{idx}.csv"), index=False, encoding="utf-8")

                write_record(rec)      # <-- write immediately
                records.append(rec)
            except Exception as e:
                # write the error line to JSONL so you can resume later
                jsonl_f.write(json.dumps({"dtc": None, "url": url, "error": str(e)}, ensure_ascii=False) + "\n")
            gentle_sleep(delay)
    finally:
        # Always flush/close (even on Ctrl-C)
        wide_f.flush(); long_f.flush(); jsonl_f.flush()
        wide_f.close(); long_f.close(); jsonl_f.close()

    # Optional aggregate JSON at the end (safe if you let it finish)
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(records, jf, ensure_ascii=False, indent=2)

    print("Done for", oem_slug)
    print(" -", wide_csv)
    print(" -", long_csv)
    print(" -", jsonl_path, "(streamed as you go)")
    print(" -", json_path)
    print(" -", os.path.join(output_dir, "tables", oem_slug, "<DTC>", "table_#.csv"))
    if verbose:
        print(" -", os.path.join(output_dir, "debug_html", "*.html"), "(first pages saved)")

# -------------------------------------- CLI -----------------------------------
def main():
    import sys
    ap = argparse.ArgumentParser(description="Playwright scraper (streaming) for dtcdecode.com")
    ap.add_argument("--oems", nargs="+", default=["Land-Rover"], help="OEM slugs (e.g., Land-Rover, Jaguar)")
    ap.add_argument("--delay", type=float, default=1.8, help="Base delay seconds (jitter added)")
    ap.add_argument("--headless", action="store_true", help="Run Chromium headless")
    ap.add_argument("--proxy", type=str, default=None, help="Proxy URL, e.g. http://user:pass@host:port")
    ap.add_argument("--cookie", type=str, default=None, help='Cookie header (e.g., "cf_clearance=...; other=...")')
    ap.add_argument("--max-pages", type=int, default=None, help="Cap listing pages (debug)")
    ap.add_argument("--no-warmup", action="store_true", help="Skip warmup")
    ap.add_argument("--verbose", action="store_true", help="Verbose logs")
    ap.add_argument("--output-dir", type=str, default=".", help="Directory to write outputs")
    ap.add_argument("--flush-every", type=int, default=25, help="Flush CSV/JSONL every N records")
    ap.add_argument("--debug-html-max", type=int, default=5, help="Save up to N raw HTML pages to debug_html/ (verbose only)")
    ap.add_argument("--max-scrolls", type=int, default=8, help="Max scroll passes to load lazy content")
    ap.add_argument("--scroll-wait", type=int, default=500, help="Wait (ms) between scrolls")
    args = ap.parse_args()

    print("Note: Please ensure scraping complies with the site's Terms and robots.txt.")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except Exception:
        print("Playwright not installed. Install with:\n"
              "  python -m pip install playwright\n"
              "  python -m playwright install chromium")
        sys.exit(1)

    fetcher = PlaywrightFetcher(base_delay=args.delay, headless=args.headless,
                                proxy=args.proxy, cookie_header=args.cookie, verbose=args.verbose)
    try:
        for oem in args.oems:
            oem_slug = oem.strip().strip("/")
            scrape_oem(oem_slug, fetcher, args.delay, args.max_pages, args.no_warmup,
                       args.verbose, args.output_dir, args.flush_every, args.debug_html_max,
                       args.max_scrolls, args.scroll_wait)
    finally:
        fetcher.close()

if __name__ == "__main__":
    main()
