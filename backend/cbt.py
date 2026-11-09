"""DigiALM-style Computer-Based Test (CBT) module.

Self-contained, non-breaking add-on to the existing ExamNest backend.

- Reuses existing `tests` + `questions` collections (read-only for structure).
- Owns two new collections:
    cbt_attempts  : live attempt state (server-authoritative timer, lock).
    cbt_responses : per (attempt, question) saved answer + palette + version.
- On final submit, writes a standard result document into the existing
  `attempts` collection so the current Result page renders it unchanged.

Correct answers / solutions are NEVER exposed through student exam APIs.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from collections import OrderedDict
import asyncio, uuid, logging

log = logging.getLogger("cbt")
LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]
GRACE_SECONDS = 120  # network grace past the hard deadline


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


def cbt_type(q: dict) -> str:
    """Map stored question type -> CBT answer widget type."""
    t = (q.get("type") or "mcq_single").lower()
    if t == "mcq_multi":
        return "msq"
    if t in ("integer", "numerical", "decimal", "numeric"):
        return "numerical"
    return "scm"  # single-correct (mcq_single, true_false, assertion_reason)


def numerical_validation_for(q: dict) -> dict:
    nv = q.get("numerical_validation") or {}
    if nv:
        return {
            "integerOnly": bool(nv.get("integerOnly", q.get("type") == "integer")),
            "allowDecimal": bool(nv.get("allowDecimal", q.get("type") != "integer")),
            "allowNegative": bool(nv.get("allowNegative", True)),
            "maxDecimalPlaces": int(nv.get("maxDecimalPlaces", 4)),
            "maxLength": int(nv.get("maxLength", 12)),
        }
    is_int = q.get("type") == "integer"
    return {
        "integerOnly": is_int,
        "allowDecimal": not is_int,
        "allowNegative": True,
        "maxDecimalPlaces": 4,
        "maxLength": 12,
    }


def build_options(q: dict) -> list:
    """Bilingual option list with stable option IDs (index based)."""
    raw = q.get("options") or []
    if not raw and q.get("type") == "true_false":
        raw = ["True", "False"]
    raw_hi = q.get("options_hi") or []
    opts = []
    for i, text in enumerate(raw):
        hi = raw_hi[i] if i < len(raw_hi) and raw_hi[i] else text
        opts.append({"id": f"opt_{i}", "en": text, "hi": hi})
    return opts


def opt_ids_to_letters(ids: list) -> list:
    out = []
    for oid in ids:
        if isinstance(oid, str) and oid.startswith("opt_"):
            try:
                out.append(LETTERS[int(oid.split("_")[1])])
            except (ValueError, IndexError):
                pass
    return sorted(out)


def _is_numeric_answered(val: str) -> bool:
    if val is None:
        return False
    v = str(val).strip()
    return v not in ("", "-", ".", "-.", "+")


def _parse_float(val: str):
    try:
        return float(str(val).strip())
    except (ValueError, TypeError):
        return None


def register_cbt(app, db, get_current_user, require_role, on_submit=None, gate=None):
    """on_submit(user, test, result, qmap): coins, streak, revision queue, emails — shared with the classic exam.
    gate(test, user) -> reason a student may not open the test yet (draft / opens later), or None."""
    router = APIRouter(prefix="/api/cbt")

    # ---------- request models ----------
    class StartIn(BaseModel):
        test_id: str
        retake: bool = False   # True = start a fresh attempt even if this test was already submitted

    class ResponseIn(BaseModel):
        question_id: str
        answer: List[str] = []          # option ids (MCQ/MSQ) or ["<numeric string>"]
        marked_for_review: bool = False
        visited: bool = True
        action: str = "save"            # save | mark | clear
        seq: int = 0                    # client monotonic counter per question

    class SubmitIn(BaseModel):
        pass

    # ---------- helpers ----------
    async def _load_test_questions(test: dict):
        qids = test.get("question_ids", []) or []
        qs = await db.questions.find({"id": {"$in": qids}}, {"_id": 0}).to_list(2000)
        qmap = {q["id"]: q for q in qs}
        order = [qid for qid in qids if qid in qmap]
        return qmap, order

    def _remaining_seconds(attempt: dict) -> int:
        try:
            ends = datetime.fromisoformat(attempt["ends_at"])
            return max(0, int((ends - datetime.now(timezone.utc)).total_seconds()))
        except Exception:
            return 0

    async def _get_owned_attempt(aid: str, user: dict) -> dict:
        a = await db.cbt_attempts.find_one({"id": aid}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Attempt not found")
        if a["user_id"] != user["id"]:
            raise HTTPException(403, "Not your attempt")
        return a

    # ---------- structure (view-only, no answers) ----------
    @router.get("/exam/{tid}")
    async def get_exam(tid: str, user: dict = Depends(require_role("student", "admin", "teacher"))):
        test = await db.tests.find_one({"id": tid}, {"_id": 0})
        if not test:
            raise HTTPException(404, "Exam not found")
        if test.get("published") is False and user["role"] == "student":
            raise HTTPException(403, "This exam is not published yet.")
        if gate and user["role"] == "student":
            why = gate(test, user)
            if why and not await db.attempts.find_one(
                    {"test_id": tid, "user_id": user["id"], "status": "submitted"}, {"_id": 1}):
                raise HTTPException(403, why)
        qmap, order = await _load_test_questions(test)

        # Group dynamically: subject -> section -> [qid].
        # Prefer the exam's declared section structure (test.sections) so admins
        # can name sections (e.g. "Section A"/"Section B") per subject; fall back
        # to the question-level `section` field, then "Section 1".
        sec_name_by_qid = {}
        sec_instr_by_name = {}
        for sec in (test.get("sections") or []):
            sname = sec.get("name") or "Section 1"
            if sec.get("instructions"):
                sec_instr_by_name[sname] = sec.get("instructions")
            for qid in (sec.get("question_ids") or []):
                if qid in qmap and qid not in sec_name_by_qid:
                    sec_name_by_qid[qid] = sname

        grouped = OrderedDict()
        for qid in order:
            q = qmap[qid]
            subj = q.get("subject") or "General"
            sec = sec_name_by_qid.get(qid) or q.get("section") or "Section 1"
            grouped.setdefault(subj, OrderedDict()).setdefault(sec, []).append(qid)

        subjects = []
        questions_out = {}
        for subj, secs in grouped.items():
            sec_list = []
            qnum = 0
            for sec_name, qids in secs.items():
                sec_id = f"{subj}::{sec_name}"
                for qid in qids:
                    q = qmap[qid]
                    qnum += 1
                    ctype = cbt_type(q)
                    questions_out[qid] = {
                        "id": qid,
                        "subject": subj,
                        "section_id": sec_id,
                        "section_name": sec_name,
                        "question_number": qnum,
                        "type": ctype,
                        "marks": q.get("marks", 4),
                        "negative_marks": q.get("negative_marks", 1),
                        "en": {"text": q.get("text") or ""},
                        "hi": {"text": q.get("text_hi") or q.get("text") or ""},
                        "image_url": q.get("image_url") or None,
                        "image_alt": q.get("image_alt") or "Question diagram",
                        "options": build_options(q) if ctype in ("scm", "msq") else [],
                        "numerical_validation": numerical_validation_for(q) if ctype == "numerical" else None,
                    }
                sec_list.append({"id": sec_id, "name": sec_name, "question_ids": qids,
                                 "instructions": sec_instr_by_name.get(sec_name)})
            subjects.append({"id": subj, "name": subj, "sections": sec_list})

        return {
            "exam": {
                "id": test["id"],
                "title": test.get("title", "Examination"),
                "exam_type": test.get("exam_type", "mock"),
                "duration_minutes": test.get("duration_minutes", 60),
                "total_marks": test.get("total_marks", 0),
                "negative_marking": test.get("negative_marking", True),
                "instructions_en": test.get("instructions_en") or test.get("description") or "",
                "instructions_hi": test.get("instructions_hi") or "",
            },
            "subjects": subjects,
            "questions": questions_out,
            "order": order,
            "total_questions": len(order),
        }

    # ---------- start / resume (idempotent, double-click safe) ----------
    @router.post("/attempts/start")
    async def start(inp: StartIn, user: dict = Depends(require_role("student"))):
        test = await db.tests.find_one({"id": inp.test_id}, {"_id": 0})
        if not test:
            raise HTTPException(404, "Exam not found")
        if test.get("published") is False:
            raise HTTPException(403, "This exam is not published yet.")
        if gate:
            why = gate(test, user)
            if why:
                raise HTTPException(400, why)

        # Demo exam: always let the candidate retake it — clear any prior
        # attempt/responses for this user so /demo can be experienced repeatedly.
        if test.get("is_demo"):
            prev = await db.cbt_attempts.find({"test_id": inp.test_id, "user_id": user["id"]}, {"_id": 0, "id": 1}).to_list(50)
            prev_ids = [a["id"] for a in prev]
            if prev_ids:
                await db.cbt_responses.delete_many({"attempt_id": {"$in": prev_ids}})
            await db.cbt_attempts.delete_many({"test_id": inp.test_id, "user_id": user["id"]})
            await db.attempts.delete_many({"test_id": inp.test_id, "user_id": user["id"]})

        # Resume a live attempt first (also covers a retake that is in progress).
        existing = await db.cbt_attempts.find_one(
            {"test_id": inp.test_id, "user_id": user["id"], "status": "in_progress"}, {"_id": 0})
        if existing:
            return {**existing, "remaining_seconds": _remaining_seconds(existing)}

        # Already submitted -> show the locked result, unless the student asked to retake
        # (retakes are free; every attempt keeps its own result and "best of" is shown).
        submitted = await db.cbt_attempts.find_one(
            {"test_id": inp.test_id, "user_id": user["id"], "status": "submitted"}, {"_id": 0},
            sort=[("submitted_at", -1)])
        if submitted and not inp.retake:
            return {**submitted, "remaining_seconds": 0}

        # Create exactly one attempt; guard a race with a unique compound index.
        now = datetime.now(timezone.utc)
        duration = int(test.get("duration_minutes", 60))
        attempt = {
            "id": _new_id(),
            "test_id": inp.test_id,
            "user_id": user["id"],
            "mode": "cbt",
            "status": "in_progress",
            "started_at": now.isoformat(),
            "ends_at": (now + timedelta(minutes=duration)).isoformat(),
            "extra_time_seconds": 0,
            "created_at": now.isoformat(),
            "language": "en",
            "result_id": None,
        }
        try:
            await db.cbt_attempts.insert_one(attempt)
        except Exception:
            # Unique index tripped by a concurrent create -> return the winner.
            again = await db.cbt_attempts.find_one(
                {"test_id": inp.test_id, "user_id": user["id"], "status": "in_progress"}, {"_id": 0})
            if again:
                return {**again, "remaining_seconds": _remaining_seconds(again)}
            raise
        attempt.pop("_id", None)
        return {**attempt, "remaining_seconds": _remaining_seconds(attempt)}

    # ---------- state (refresh recovery) ----------
    @router.get("/attempts/{aid}/state")
    async def state(aid: str, user: dict = Depends(require_role("student"))):
        a = await _get_owned_attempt(aid, user)
        resps = await db.cbt_responses.find({"attempt_id": aid}, {"_id": 0}).to_list(5000)
        responses = {}
        for r in resps:
            responses[r["question_id"]] = {
                "saved_answer": r.get("saved_answer", []),
                "marked_for_review": r.get("marked_for_review", False),
                "visited": r.get("visited", True),
                "is_answered": r.get("is_answered", False),
                "version": r.get("version", 1),
                "seq": r.get("seq", 0),
            }
        return {
            "attempt": {
                "id": a["id"], "test_id": a["test_id"], "status": a["status"],
                "started_at": a["started_at"], "ends_at": a["ends_at"],
                "language": a.get("language", "en"), "result_id": a.get("result_id"),
            },
            "remaining_seconds": _remaining_seconds(a) if a["status"] == "in_progress" else 0,
            "server_now": _now_iso(),
            "responses": responses,
        }

    @router.post("/attempts/{aid}/language")
    async def set_language(aid: str, body: dict, user: dict = Depends(require_role("student"))):
        a = await _get_owned_attempt(aid, user)
        lang = "hi" if str(body.get("language")) == "hi" else "en"
        await db.cbt_attempts.update_one({"id": aid}, {"$set": {"language": lang}})
        return {"ok": True, "language": lang}

    # ---------- per-question save (primary commit) ----------
    @router.post("/attempts/{aid}/response")
    async def save_response(aid: str, inp: ResponseIn, user: dict = Depends(require_role("student"))):
        a = await _get_owned_attempt(aid, user)
        if a["status"] != "in_progress":
            raise HTTPException(409, "Exam already submitted — responses are locked.")
        # Server-authoritative deadline: reject edits past the hard deadline.
        try:
            ends = datetime.fromisoformat(a["ends_at"])
            if datetime.now(timezone.utc) > ends + timedelta(seconds=GRACE_SECONDS):
                raise HTTPException(409, "Time is up — the exam is closed for new responses.")
        except HTTPException:
            raise
        except Exception:
            pass

        test = await db.tests.find_one({"id": a["test_id"]}, {"_id": 0, "question_ids": 1})
        if not test or inp.question_id not in (test.get("question_ids") or []):
            raise HTTPException(400, "Question does not belong to this exam.")

        existing = await db.cbt_responses.find_one(
            {"attempt_id": aid, "question_id": inp.question_id}, {"_id": 0})
        # Stale-write guard: ignore an out-of-order client request.
        if existing and inp.seq < existing.get("seq", 0):
            return {
                "ok": True, "stale": True, "question_id": inp.question_id,
                "version": existing.get("version", 1),
                "is_answered": existing.get("is_answered", False),
            }

        q = await db.questions.find_one({"id": inp.question_id}, {"_id": 0, "type": 1})
        ctype = cbt_type(q or {})

        answer = inp.answer if inp.action != "clear" else []
        # Determine answered state
        if ctype == "numerical":
            val = answer[0] if answer else ""
            is_answered = _is_numeric_answered(val)
            saved = [str(val).strip()] if is_answered else []
        else:
            saved = [x for x in answer if isinstance(x, str) and x.startswith("opt_")]
            if ctype == "scm" and len(saved) > 1:
                saved = saved[:1]
            is_answered = len(saved) > 0

        version = (existing.get("version", 0) + 1) if existing else 1
        doc = {
            "attempt_id": aid,
            "question_id": inp.question_id,
            "saved_answer": saved,
            "marked_for_review": bool(inp.marked_for_review),
            "visited": True,
            "is_answered": is_answered,
            "version": version,
            "seq": max(inp.seq, existing.get("seq", 0) if existing else 0),
            "updated_at": _now_iso(),
        }
        await db.cbt_responses.update_one(
            {"attempt_id": aid, "question_id": inp.question_id},
            {"$set": doc}, upsert=True)
        return {"ok": True, "question_id": inp.question_id, "version": version, "is_answered": is_answered}

    # ---------- summary (for submit confirmation) ----------
    @router.get("/attempts/{aid}/summary")
    async def summary(aid: str, user: dict = Depends(require_role("student"))):
        a = await _get_owned_attempt(aid, user)
        test = await db.tests.find_one({"id": a["test_id"]}, {"_id": 0})
        qmap, order = await _load_test_questions(test)
        resps = {r["question_id"]: r for r in
                 await db.cbt_responses.find({"attempt_id": aid}, {"_id": 0}).to_list(5000)}
        by_subject = OrderedDict()
        totals = {"total": 0, "answered": 0, "not_answered": 0, "not_visited": 0,
                  "marked": 0, "answered_marked": 0}
        for qid in order:
            subj = qmap[qid].get("subject") or "General"
            s = by_subject.setdefault(subj, {"total": 0, "answered": 0, "not_answered": 0,
                                             "not_visited": 0, "marked": 0, "answered_marked": 0})
            r = resps.get(qid)
            totals["total"] += 1
            s["total"] += 1
            if not r or not r.get("visited"):
                totals["not_visited"] += 1; s["not_visited"] += 1
                continue
            ans = r.get("is_answered")
            mark = r.get("marked_for_review")
            if ans and mark:
                totals["answered_marked"] += 1; s["answered_marked"] += 1; totals["answered"] += 1; s["answered"] += 1
            elif ans:
                totals["answered"] += 1; s["answered"] += 1
            elif mark:
                totals["marked"] += 1; s["marked"] += 1
            else:
                totals["not_answered"] += 1; s["not_answered"] += 1
        return {"totals": totals, "by_subject": by_subject}

    # ---------- scoring ----------
    def _score_question(q: dict, saved_answer: list):
        """Return (result, marks_awarded, user_answer_display, correct_display)."""
        ctype = cbt_type(q)
        marks = float(q.get("marks", 4))
        neg = float(q.get("negative_marks", 1) or 0)
        correct_raw = sorted([str(x).strip().lower() for x in (q.get("correct") or [])])

        if ctype == "numerical":
            if not saved_answer:
                return "unattempted", 0.0, [], q.get("correct", [])
            uval = _parse_float(saved_answer[0])
            user_disp = [saved_answer[0]]
            if uval is None:
                return "wrong", -neg, user_disp, q.get("correct", [])
            nv = q.get("numerical_validation") or {}
            tol = float(nv.get("tolerance", 0) or 0)
            rng = nv.get("accepted_range")  # [lo, hi]
            ok = False
            for c in (q.get("correct") or []):
                cval = _parse_float(c)
                if cval is None:
                    continue
                if abs(uval - cval) <= tol or (tol == 0 and uval == cval):
                    ok = True
                    break
            if not ok and isinstance(rng, (list, tuple)) and len(rng) == 2:
                lo, hi = _parse_float(rng[0]), _parse_float(rng[1])
                if lo is not None and hi is not None and lo <= uval <= hi:
                    ok = True
            if ok:
                return "correct", marks, user_disp, q.get("correct", [])
            return "wrong", -neg, user_disp, q.get("correct", [])

        # MCQ / MSQ -> option ids back to letters
        letters = opt_ids_to_letters(saved_answer)
        user_norm = sorted([x.lower() for x in letters])
        if not user_norm:
            return "unattempted", 0.0, letters, q.get("correct", [])

        if ctype == "msq":
            pcfg = q.get("partial_marks_config") or {}
            correct_set = set(correct_raw)
            user_set = set(user_norm)
            if user_set == correct_set:
                return "correct", marks, letters, q.get("correct", [])
            # any wrong option chosen -> negative (JEE-style)
            if user_set - correct_set:
                return "wrong", -neg, letters, q.get("correct", [])
            # subset of correct, none wrong -> partial if enabled
            if pcfg.get("enabled") or pcfg.get("partial"):
                per = float(pcfg.get("per_correct", 1))
                awarded = min(per * len(user_set), marks)
                return "partial", awarded, letters, q.get("correct", [])
            return "wrong", -neg, letters, q.get("correct", [])

        # single correct
        if user_norm == correct_raw:
            return "correct", marks, letters, q.get("correct", [])
        return "wrong", -neg, letters, q.get("correct", [])

    async def _finalize(a: dict, auto: bool = False):
        """Idempotent finalization -> writes a standard `attempts` result doc."""
        # If already finalized, return existing result.
        locked = await db.cbt_attempts.find_one({"id": a["id"]}, {"_id": 0})
        if locked and locked.get("status") == "submitted" and locked.get("result_id"):
            res = await db.attempts.find_one({"id": locked["result_id"]}, {"_id": 0})
            if res:
                return res

        # Claim the attempt (double click / submit + timer expiry at once -> exactly one result).
        result_id = _new_id()
        claim = await db.cbt_attempts.update_one(
            {"id": a["id"], "status": "in_progress", "result_id": None}, {"$set": {"result_id": result_id}})
        owner = claim.modified_count == 1
        if not owner:
            for _ in range(40):            # another request is finishing it — wait for its result
                cur = await db.cbt_attempts.find_one({"id": a["id"]}, {"_id": 0})
                if cur and cur.get("status") == "submitted" and cur.get("result_id"):
                    res = await db.attempts.find_one({"id": cur["result_id"]}, {"_id": 0})
                    if res:
                        return res
                await asyncio.sleep(0.25)
            cur = await db.cbt_attempts.find_one({"id": a["id"]}, {"_id": 0}) or {}
            result_id = cur.get("result_id") or result_id   # stale claim (crashed mid-way) -> finish it here
        test = await db.tests.find_one({"id": a["test_id"]}, {"_id": 0})
        qmap, order = await _load_test_questions(test)
        resps = {r["question_id"]: r for r in
                 await db.cbt_responses.find({"attempt_id": a["id"]}, {"_id": 0}).to_list(5000)}
        negative_on = test.get("negative_marking", True)

        score = 0.0; correct = 0; wrong = 0; unattempted = 0
        detailed = []; subject_stats = {}; answers_compat = []
        for qid in order:
            q = qmap[qid]
            subj = q.get("subject", "Other")
            subject_stats.setdefault(subj, {"correct": 0, "wrong": 0, "total": 0, "score": 0})
            subject_stats[subj]["total"] += 1
            r = resps.get(qid)
            saved = (r or {}).get("saved_answer", []) if (r and r.get("is_answered")) else []
            result, awarded, user_disp, correct_disp = _score_question(q, saved)
            if not negative_on and awarded < 0:
                awarded = 0.0
            if result == "unattempted":
                unattempted += 1
            elif result in ("correct", "partial"):
                score += awarded
                if result == "correct":
                    correct += 1
                subject_stats[subj]["correct"] += 1 if result == "correct" else 0
                subject_stats[subj]["score"] += awarded
            else:  # wrong
                score += awarded
                wrong += 1
                subject_stats[subj]["wrong"] += 1
            detailed.append({
                "question_id": qid,
                "user_answer": user_disp,
                "correct": sorted([str(x).strip().lower() for x in (q.get("correct") or [])]),
                "result": result,
                "marks_awarded": round(awarded, 2),
                "difficulty": q.get("difficulty"),
                "marked_for_review": bool((r or {}).get("marked_for_review")),
            })
            answers_compat.append({
                "question_id": qid,
                "answer": user_disp,
                "marked_review": bool((r or {}).get("marked_for_review")),
            })

        now = datetime.now(timezone.utc)
        try:
            started = datetime.fromisoformat(a["started_at"])
            time_taken = int((now - started).total_seconds())
        except Exception:
            time_taken = None

        result_doc = {
            "id": result_id,
            "test_id": a["test_id"],
            "user_id": a["user_id"],
            "mode": "cbt",
            "cbt_attempt_id": a["id"],
            "status": "submitted",
            "started_at": a["started_at"],
            "submitted_at": now.isoformat(),
            "ends_at": a["ends_at"],
            "answers": answers_compat,
            "score": round(score, 2),
            "correct": correct,
            "wrong": wrong,
            "unattempted": unattempted,
            "total_marks": test.get("total_marks", 0),
            "time_taken_seconds": time_taken,
            "late_submission": bool(auto),
            "detailed": detailed,
            "subject_stats": subject_stats,
        }
        await db.attempts.replace_one({"id": result_id}, result_doc, upsert=True)
        await db.cbt_attempts.update_one(
            {"id": a["id"]},
            {"$set": {"status": "submitted", "submitted_at": now.isoformat(), "result_id": result_id}})
        result_doc.pop("_id", None)
        if on_submit and owner:
            try:
                student = await db.users.find_one({"id": a["user_id"]}, {"_id": 0, "password": 0})
                if student:
                    await on_submit(student, test, result_doc, qmap)
            except Exception as e:
                log.warning("CBT post-submit (coins/revision/emails) failed: %s", e)
        return result_doc

    @router.post("/attempts/{aid}/submit")
    async def submit(aid: str, request: Request, user: dict = Depends(require_role("student"))):
        a = await _get_owned_attempt(aid, user)
        if a["status"] == "submitted":
            res = await db.attempts.find_one({"id": a.get("result_id")}, {"_id": 0}) if a.get("result_id") else None
            return {"ok": True, "result_id": a.get("result_id"), "result": res}
        res = await _finalize(a, auto=False)
        return {"ok": True, "result_id": res["id"], "result": res}

    @router.post("/attempts/{aid}/expire")
    async def expire(aid: str, user: dict = Depends(require_role("student"))):
        """Called by the client when the server-authoritative timer hits zero."""
        a = await _get_owned_attempt(aid, user)
        if a["status"] == "submitted":
            return {"ok": True, "result_id": a.get("result_id")}
        if _remaining_seconds(a) > GRACE_SECONDS:
            raise HTTPException(400, "Exam is still in progress.")
        res = await _finalize(a, auto=True)
        return {"ok": True, "result_id": res["id"]}

    # ==================== ADMIN: CBT exam management ====================
    async def _validate_test_questions(test: dict):
        """Pre-publish validation. Returns a list of human-readable issues."""
        qids = test.get("question_ids", []) or []
        qs = await db.questions.find({"id": {"$in": qids}}, {"_id": 0}).to_list(2000)
        have = {q["id"]: q for q in qs}
        issues = []
        for qid in qids:
            if qid not in have:
                issues.append(f"Missing question (id {str(qid)[:8]}…)")
        seen = set()
        for qid in qids:
            if qid in seen:
                issues.append(f"Duplicate question id {str(qid)[:8]}… in the paper")
            seen.add(qid)
        for qid, q in have.items():
            label = (q.get("text") or str(qid))[:40]
            ctype = cbt_type(q)
            if not (q.get("text") or "").strip():
                issues.append(f"Question '{label}…' has empty text")
            if ctype in ("scm", "msq") and len(q.get("options") or []) < 2:
                issues.append(f"Question '{label}…' needs at least 2 options")
            if not q.get("correct"):
                issues.append(f"Question '{label}…' has no correct answer set")
            if ctype == "numerical":
                for c in (q.get("correct") or []):
                    if _parse_float(c) is None:
                        issues.append(f"Numerical question '{label}…' has a non-numeric answer '{c}'")
            try:
                if float(q.get("marks", 0) or 0) <= 0:
                    issues.append(f"Question '{label}…' has invalid marks")
            except (ValueError, TypeError):
                issues.append(f"Question '{label}…' has invalid marks")
            img = q.get("image_url")
            if img and not str(img).startswith(("http://", "https://", "data:", "/")):
                issues.append(f"Question '{label}…' has an invalid image path")
        return issues

    @router.get("/admin/exams")
    async def admin_list_exams(user: dict = Depends(require_role("admin"))):
        docs = await db.tests.find({"personal": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(500)
        out = []
        for t in docs:
            out.append({
                "id": t["id"], "title": t.get("title"), "exam_type": t.get("exam_type"),
                "duration_minutes": t.get("duration_minutes"), "subjects": t.get("subjects", []),
                "total_marks": t.get("total_marks"),
                "question_count": len(t.get("question_ids", []) or []),
                "section_count": len(t.get("sections", []) or []),
                "published": t.get("published", True),
                "negative_marking": t.get("negative_marking", True),
                "created_at": t.get("created_at"),
            })
        return out

    class CbtExamUpdateIn(BaseModel):
        title: Optional[str] = None
        duration_minutes: Optional[int] = None
        negative_marking: Optional[bool] = None
        instructions_en: Optional[str] = None
        instructions_hi: Optional[str] = None
        subjects: Optional[List[str]] = None
        sections: Optional[List[dict]] = None
        question_ids: Optional[List[str]] = None

    @router.put("/admin/exams/{tid}")
    async def admin_update_exam(tid: str, inp: CbtExamUpdateIn, user: dict = Depends(require_role("admin"))):
        test = await db.tests.find_one({"id": tid}, {"_id": 0})
        if not test:
            raise HTTPException(404, "Exam not found")
        upd = {k: v for k, v in inp.model_dump().items() if v is not None}
        if inp.sections:
            qids = []
            for sec in inp.sections:
                qids.extend(sec.get("question_ids", []))
            for qid in (inp.question_ids or []):
                if qid not in qids:
                    qids.append(qid)
            if qids:
                upd["question_ids"] = qids
        if "question_ids" in upd:
            qs = await db.questions.find({"id": {"$in": upd["question_ids"]}}, {"_id": 0, "marks": 1}).to_list(2000)
            upd["total_marks"] = round(sum(float(q.get("marks", 4)) for q in qs), 2)
        upd["updated_at"] = _now_iso()
        upd_unset = {"content": ""} if "question_ids" in upd else {}   # subject/chapter summary is recomputed
        await db.tests.update_one({"id": tid}, {"$set": upd, **({"$unset": upd_unset} if upd_unset else {})})
        return await db.tests.find_one({"id": tid}, {"_id": 0})

    @router.post("/admin/exams/{tid}/validate")
    async def admin_validate_exam(tid: str, user: dict = Depends(require_role("admin"))):
        test = await db.tests.find_one({"id": tid}, {"_id": 0})
        if not test:
            raise HTTPException(404, "Exam not found")
        issues = await _validate_test_questions(test)
        return {"valid": len(issues) == 0, "issue_count": len(issues), "issues": issues}

    @router.post("/admin/exams/{tid}/publish")
    async def admin_publish_exam(tid: str, body: dict, user: dict = Depends(require_role("admin"))):
        test = await db.tests.find_one({"id": tid}, {"_id": 0})
        if not test:
            raise HTTPException(404, "Exam not found")
        publish = bool(body.get("published", True))
        if publish:
            issues = await _validate_test_questions(test)
            if issues:
                raise HTTPException(400, detail={"message": "Fix these issues before publishing", "issues": issues})
        await db.tests.update_one(
            {"id": tid},
            {"$set": {"published": publish, "published_at": _now_iso() if publish else None}})
        return {"ok": True, "published": publish}

    app.include_router(router)
    log.info("CBT module registered")
