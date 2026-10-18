"""Backup of the whole question bank to a Google Sheet (website → Sheet only, on a button press).

Setup (once, by the admin):
  1. Google Cloud console → create a service account → Keys → Add key → JSON (downloads a .json file).
  2. Enable "Google Sheets API" for that project.
  3. Make a blank Google Sheet and Share it with the service account's e-mail (…@….iam.gserviceaccount.com) as Editor.
  4. Admin → Settings → "Google Sheet backup": paste the JSON + the Sheet link, Save, then "Backup now".

Each subject gets its own tab (Physics, Chemistry, Mathematics, Biology, …) and an "About" tab records
when the backup ran. Every run rewrites the tabs completely, so the Sheet always equals the website.
Pictures are not copied into the Sheet; their full links (https://fnjee.com/api/media/…) are.
"""
import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger("gsheet")

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
CHUNK = 2000                # rows per write request
CELL_MAX = 49000            # Google's limit is 50,000 characters per cell
COLS = ["Question ID", "Subject", "Class", "Exam", "Chapter", "Topic", "Question Type", "Difficulty",
        "Question", "Option A", "Option B", "Option C", "Option D", "Option E", "Correct Answer",
        "Solution", "Pictures", "Marks", "Negative Marks", "Status", "Year", "Source", "Tags",
        "Language", "Created"]
TYPE_LABEL = {"mcq_single": "MCQ Single", "mcq_multi": "MCQ Multiple", "true_false": "True/False",
              "integer": "Integer", "assertion_reason": "Assertion-Reason", "match": "Match",
              "subjective": "Subjective", "image": "Image"}
_MEDIA = re.compile(r"(?<![\w/])(/api/media/[A-Za-z0-9._-]+)")
_IMG_MD = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")

_state = {"running": False}


def sheet_id_from(link: str) -> Optional[str]:
    link = (link or "").strip()
    m = re.search(r"/spreadsheets/d/([A-Za-z0-9_-]{20,})", link)
    if m:
        return m.group(1)
    return link if re.fullmatch(r"[A-Za-z0-9_-]{20,}", link) else None


def _abs(text: str, base: str) -> str:
    return _MEDIA.sub(lambda m: base + m.group(1), text or "") if base else (text or "")


def _cell(v) -> str:
    s = "" if v is None else str(v)
    if len(s) > CELL_MAX:
        s = s[:CELL_MAX] + " …[cut: too long for Google Sheets]"
    return s          # written with valueInputOption=RAW, so "=x+1" stays text, never a formula


def row_of(q: dict, base: str) -> list:
    opts = list(q.get("options") or [])[:5]
    opts += [""] * (5 - len(opts))
    pics = []
    for k in ("image_url", "explanation_image_url"):
        if q.get(k) and not str(q[k]).startswith("data:"):
            pics.append(q[k])
    for t in [q.get("text"), q.get("explanation")] + list(q.get("options") or []):
        pics += _IMG_MD.findall(t or "")
    pics = [_abs(p, base) for p in dict.fromkeys(pics) if not str(p).startswith("data:")]
    return [_cell(x) for x in [
        q.get("id"), q.get("subject"), q.get("student_class"), q.get("exam"), q.get("chapter"), q.get("topic"),
        TYPE_LABEL.get(q.get("type"), q.get("type")), (q.get("difficulty") or "").title(),
        _abs(q.get("text"), base), *[_abs(o, base) for o in opts], ",".join(map(str, q.get("correct") or [])),
        _abs(q.get("explanation"), base), "\n".join(pics), q.get("marks"), q.get("negative_marks"),
        (q.get("status") or "").title(), q.get("year"), q.get("source"), ", ".join(q.get("tags") or []),
        q.get("language"), (q.get("created_at") or "")[:19]]]


def _service(sa_info: dict):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_info(sa_info, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _call(req, tries=6):
    """Execute with back-off on Google's per-minute write limit (HTTP 429) and brief 5xx errors."""
    from googleapiclient.errors import HttpError
    for i in range(tries):
        try:
            return req.execute()
        except HttpError as e:
            code = getattr(e.resp, "status", 0)
            if code in (429, 500, 502, 503) and i < tries - 1:
                time.sleep(min(60, 5 * 2 ** i))
                continue
            raise


def check_access(sa_info: dict, sheet_id: str) -> str:
    """Raises with a readable message if the Sheet cannot be opened. Returns its title."""
    svc = _service(sa_info)
    meta = _call(svc.spreadsheets().get(spreadsheetId=sheet_id, fields="properties.title"))
    return meta["properties"]["title"]


def _ensure_tab(svc, sheet_id: str, title: str, rows: int, cols: int) -> None:
    meta = _call(svc.spreadsheets().get(spreadsheetId=sheet_id, fields="sheets.properties"))
    tabs = {s["properties"]["title"]: s["properties"] for s in meta.get("sheets", [])}
    grid = {"rowCount": max(rows, 2), "columnCount": cols, "frozenRowCount": 1}
    if title not in tabs:
        _call(svc.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body={"requests": [
            {"addSheet": {"properties": {"title": title, "gridProperties": grid}}}]}))
        return
    _call(svc.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body={"requests": [
        {"updateSheetProperties": {"properties": {"sheetId": tabs[title]["sheetId"], "gridProperties": grid},
                                   "fields": "gridProperties(rowCount,columnCount,frozenRowCount)"}}]}))
    _call(svc.spreadsheets().values().clear(spreadsheetId=sheet_id, range=f"'{title}'", body={}))


def _write_tab(svc, sheet_id: str, title: str, rows: list) -> None:
    _ensure_tab(svc, sheet_id, title, len(rows) + 1, len(COLS))
    data = [COLS] + rows
    for i in range(0, len(data), CHUNK):
        _call(svc.spreadsheets().values().update(
            spreadsheetId=sheet_id, range=f"'{title}'!A{i + 1}", valueInputOption="RAW",
            body={"values": data[i:i + CHUNK]}))


def is_running() -> bool:
    return _state["running"]


async def run_backup(db, sa_info: dict, sheet_id: str, by: str) -> None:
    """Background job: every question (except students' personal ones) → one tab per subject."""
    if _state["running"]:
        return
    _state["running"] = True
    base = os.environ.get("APP_BASE_URL", "").rstrip("/")
    t0 = time.time()
    status = {"id": "gsheet_status", "state": "running", "started_at": datetime.now(timezone.utc).isoformat(),
              "by": by, "done": 0, "total": 0, "tabs": {}, "error": None}
    await db.settings.update_one({"id": "gsheet_status"}, {"$set": status}, upsert=True)
    try:
        q = {"personal": {"$ne": True}}
        status["total"] = await db.questions.count_documents(q)
        svc = await asyncio.to_thread(_service, sa_info)
        subjects = sorted(s for s in await db.questions.distinct("subject", q) if s)
        for subj in subjects:
            rows = []
            cur = db.questions.find({**q, "subject": subj}, {"_id": 0}).sort("created_at", 1)
            async for doc in cur:
                rows.append(row_of(doc, base))
            title = re.sub(r"[\[\]:*?/\\']", " ", subj)[:90]
            await asyncio.to_thread(_write_tab, svc, sheet_id, title, rows)
            status["done"] += len(rows)
            status["tabs"][title] = len(rows)
            await db.settings.update_one({"id": "gsheet_status"}, {"$set": {"done": status["done"],
                                                                            "tabs": status["tabs"]}})
        about = [["FNJEE question bank backup"], ["Last backup (UTC)", datetime.now(timezone.utc).isoformat()[:19]],
                 ["Questions", str(status["done"])], ["Note", "Website → Sheet copy. Edits here are NOT sent "
                                                              "back to the website; the next backup overwrites them."]]
        about += [[f"Tab: {k}", str(v)] for k, v in status["tabs"].items()]

        def _about():
            _ensure_tab(svc, sheet_id, "About", len(about) + 1, 2)
            _call(svc.spreadsheets().values().update(spreadsheetId=sheet_id, range="'About'!A1",
                                                     valueInputOption="RAW", body={"values": about}))
        await asyncio.to_thread(_about)
        status.update(state="done", finished_at=datetime.now(timezone.utc).isoformat(),
                      seconds=int(time.time() - t0))
        log.info(f"Google Sheet backup done: {status['done']} questions in {status['seconds']}s")
    except Exception as e:
        msg = str(e)
        if "403" in msg or "PERMISSION_DENIED" in msg:
            msg = ("Sheet khul nahi payi (permission). Sheet ko service account ke e-mail ke saath "
                   "Editor bana ke share kijiye, aur Google Sheets API enable kijiye. ") + msg[:300]
        status.update(state="error", error=msg[:800], finished_at=datetime.now(timezone.utc).isoformat())
        log.warning(f"Google Sheet backup failed: {e}")
    finally:
        _state["running"] = False
        await db.settings.update_one({"id": "gsheet_status"}, {"$set": status}, upsert=True)
