"""'AI Fix' for the whole question bank: one button, runs in the background.

What it does to every question (students' personal questions excluded, archived ones skipped):
  1. No answer → the AI solves it (questions with pictures are sent WITH the picture, as a small PDF).
     The answer is saved with answer_origin='ai_generated'; the status becomes 'review' unless the admin
     ticked "approve AI answers" (then 'approved').
  2. Text talks about a figure/diagram/graph but the question has NO picture → tagged 'picture-missing'
     and set to 'review'. AI cannot recreate the original diagram; add it from the Screenshot import.
  3. If the AI is not sure, the question is tagged 'ai-unsure' and left for a person.
Every question it looked at gets ai_fix_at, so a second run continues with the rest
(tick "retry unsure" to try the 'ai-unsure' ones again).
"""
import asyncio
import json
import logging
import os
import re
import tempfile
from datetime import datetime, timezone

from answer_generator import LETTER_TYPES, SYSTEM_SOLVE, _normalize_answer, _sanitize, answer_missing
from ai_chat import ai_complete
from ai_parser import _loads_lenient

log = logging.getLogger("aifix")

FIG_WORDS = re.compile(r"\b(figure|fig\.|diagram|graph|shown\s+(?:below|above|in)|given\s+(?:below|above)|"
                       r"circuit|adjacent|following\s+(?:figure|diagram|graph|structure))\b", re.I)
_IMG_MD = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
BATCH = 8           # text-only questions per AI call
PARALLEL = 3        # AI calls at the same time
STATUS_ID = "ai_fix_status"

_state = {"running": False, "stop": False}


def is_running():
    return _state["running"]


def request_stop():
    _state["stop"] = True


def _pictures(q):
    pics = []
    for k in ("image_url",):
        if q.get(k):
            pics.append(q[k])
    for t in [q.get("text")] + list(q.get("options") or []):
        pics += _IMG_MD.findall(t or "")
    return [p for p in dict.fromkeys(pics) if p]


def _pdf_of(pics):
    """Question pictures → one temporary PDF (every AI provider here accepts PDFs). None if none load."""
    from PIL import Image
    from media_store import media_path
    imgs = []
    for p in pics[:4]:
        path = None
        if "/api/media/" in p:
            path = media_path(p.rsplit("/", 1)[-1])
        if path:
            try:
                im = Image.open(path)
                if im.mode in ("RGBA", "LA", "P"):
                    bg = Image.new("RGB", im.size, "white")
                    bg.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1])
                    im = bg
                imgs.append(im.convert("RGB"))
            except Exception:
                pass
    if not imgs:
        return None
    fd, out = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    imgs[0].save(out, "PDF", save_all=True, append_images=imgs[1:], resolution=150)
    return out


async def _solve(batch, with_pdf=None):
    """batch: [(idx, q)] → {idx: normalized answer or None}"""
    req = [_sanitize(q, i) for i, q in batch]
    prompt = json.dumps(req, ensure_ascii=False)
    if with_pdf:
        prompt = ("The attached PDF shows the picture(s) that belong to this question.\n" + prompt)
    out = await ai_complete(SYSTEM_SOLVE, prompt, file_paths=[with_pdf] if with_pdf else None, max_tokens=8192)
    out = re.sub(r"^```(?:json)?\s*|\s*```$", "", out.strip(), flags=re.I)
    items = _loads_lenient(out)
    if not isinstance(items, list):
        raise ValueError("AI did not return a JSON list")
    by = {x.get("index"): x for x in items if isinstance(x, dict) and type(x.get("index")) is int}
    return {i: _normalize_answer(q, by.get(i)) for i, q in batch}


async def run(db, by: str, subject=None, approve=False, retry_unsure=False, limit=None):
    if _state["running"]:
        return
    _state.update(running=True, stop=False)
    st = {"id": STATUS_ID, "state": "running", "started_at": datetime.now(timezone.utc).isoformat(), "by": by,
          "subject": subject or "All", "approve": approve, "checked": 0, "answered": 0, "unsure": 0,
          "picture_missing": 0, "errors": 0, "total": 0, "last_error": None}

    async def save():
        await db.settings.update_one({"id": STATUS_ID}, {"$set": dict(st)}, upsert=True)
    try:
        base = {"personal": {"$ne": True}, "status": {"$ne": "archived"}}
        if subject:
            base["subject"] = subject
        missing = {"$or": [
            {"type": {"$ne": "subjective"}, "$or": [{"correct": {"$exists": False}}, {"correct": {"$size": 0}}]},
            {"type": "subjective", "$or": [{"explanation": {"$exists": False}}, {"explanation": ""}]}]}
        todo_q = {**base, **missing}
        if retry_unsure:
            todo_q["$and"] = [{"$or": [{"ai_fix_at": {"$exists": False}}, {"tags": "ai-unsure"}]}]
        else:
            todo_q["ai_fix_at"] = {"$exists": False}
        st["total"] = await db.questions.count_documents(todo_q)
        # picture check runs over everything not yet looked at (cheap, no AI)
        fig_q = {**base, "ai_fig_at": {"$exists": False}}
        await save()
        async for q in db.questions.find(fig_q, {"_id": 0, "id": 1, "text": 1, "image_url": 1, "options": 1}):
            if _state["stop"]:
                break
            upd = {"$set": {"ai_fig_at": datetime.now(timezone.utc).isoformat()}}
            if FIG_WORDS.search(q.get("text") or "") and not _pictures(q):
                upd["$set"]["status"] = "review"
                upd["$addToSet"] = {"tags": "picture-missing"}
                st["picture_missing"] += 1
            await db.questions.update_one({"id": q["id"]}, upd)
        await save()

        sem = asyncio.Semaphore(PARALLEL)

        async def apply(batch, pdf=None):
            async with sem:
                if _state["stop"]:
                    return
                try:
                    res = await _solve(batch, pdf)
                except Exception as e:
                    st["errors"] += 1
                    st["last_error"] = str(e)[:300]
                    return
                finally:
                    if pdf:
                        try: os.remove(pdf)
                        except OSError: pass
                now = datetime.now(timezone.utc).isoformat()
                for i, q in batch:
                    ans = res.get(i)
                    if ans:
                        s = {"correct": ans["correct"], "answer_origin": "ai_generated", "ai_fix_at": now,
                             "answer_review_required": not approve, "status": "approved" if approve else "review",
                             "updated_at": now}
                        if ans.get("explanation") and not (q.get("explanation") or "").strip():
                            s["explanation"] = ans["explanation"]
                        await db.questions.update_one({"id": q["id"]}, {"$set": s, "$pull": {"tags": "ai-unsure"}})
                        st["answered"] += 1
                    else:
                        await db.questions.update_one({"id": q["id"]}, {"$set": {"ai_fix_at": now, "status": "review"},
                                                                        "$addToSet": {"tags": "ai-unsure"}})
                        st["unsure"] += 1
                    st["checked"] += 1

        text_batch, tasks = [], []
        cur = db.questions.find(todo_q, {"_id": 0}).sort("created_at", 1)
        if limit:
            cur = cur.limit(int(limit))
        async for q in cur:
            if _state["stop"]:
                break
            if not answer_missing(q) or not (q.get("text") or "").strip():
                continue
            if q.get("type") in LETTER_TYPES and len(q.get("options") or []) < 2:
                await db.questions.update_one({"id": q["id"]}, {"$set": {"ai_fix_at": datetime.now(timezone.utc).isoformat()},
                                                                "$addToSet": {"tags": "options-missing"}})
                st["unsure"] += 1; st["checked"] += 1
                continue
            pics = _pictures(q)
            if pics:
                pdf = await asyncio.to_thread(_pdf_of, pics)
                tasks.append(asyncio.create_task(apply([(0, q)], pdf)))
            else:
                text_batch.append((len(text_batch), q))
                if len(text_batch) == BATCH:
                    tasks.append(asyncio.create_task(apply(text_batch)))
                    text_batch = []
            if len(tasks) >= PARALLEL * 4:          # keep memory small: wait for a wave
                await asyncio.gather(*tasks); tasks = []
                await save()
        if text_batch and not _state["stop"]:
            tasks.append(asyncio.create_task(apply(text_batch)))
        if tasks:
            await asyncio.gather(*tasks)
        st["state"] = "stopped" if _state["stop"] else "done"
    except Exception as e:
        log.exception("AI fix failed")
        st["state"] = "error"
        st["last_error"] = str(e)[:500]
    finally:
        st["finished_at"] = datetime.now(timezone.utc).isoformat()
        _state["running"] = False
        await save()
