"""Gemini-powered question extraction + difficulty prediction.
Chunked + parallel extraction so long question papers don't lose questions."""
import os, json, re, logging, asyncio
from typing import List, Tuple

log = logging.getLogger("ai_parser")

SYSTEM_EXTRACT = """You are an expert at parsing exam question papers for IIT-JEE and NEET.
Extract EVERY question you can identify from the given text — do not skip any.
Output ONLY a JSON array (no prose, no markdown fences, no commentary).
Each item MUST have these fields:
  type: one of "mcq_single","mcq_multi","true_false","integer","assertion_reason","match","subjective"
  subject: guess from "Mathematics","Physics","Chemistry","Biology" (use the hint if given)
  chapter: string (best guess or empty)
  topic: string (best guess or empty)
  difficulty: "easy" | "medium" | "hard"
  marks: number (default 4)
  negative_marks: number (default 1)
  text: the question text (plain, no leading numbering like "1." or "Q1.")
  options: array of original option strings (2-6 if present; do not invent options)
  correct: option LETTERS for MCQ, or the numeric answer for integer, ONLY IF PRESENT IN THE DOCUMENT; otherwise []
  explanation: string (empty if not present)
Rules:
- Preserve every question in the input. Fill missing fields with reasonable defaults.
- If an answer key is given at the end (like "1) 3   2) 1   3) 2"), map each question to its correct letter.
- NEVER solve or guess an answer during extraction. If no source answer exists, correct MUST be [].
- Return [] only if truly no questions found. Never return prose."""


MAX_CHUNK = 9000  # smaller chunks give better recall from Gemini
MAX_PARALLEL = 5  # own-key direct API allows concurrent calls — run chunks in parallel
CHUNK_RETRIES = 2

from ai_key import resolve as _ai_resolve
from ai_chat import ai_complete


def _get_key():
    from ai_key import resolve
    return resolve()[0]


def _split_chunks(text: str, size: int = MAX_CHUNK) -> List[str]:
    """Split text at question boundaries when possible."""
    text = (text or "").strip()
    if not text: return []
    if len(text) <= size: return [text]
    # find question-start anchors like "1.", "2.", "Q1.", "(1)"
    anchors = [m.start() for m in re.finditer(r"(?m)^\s*(?:Q?\d{1,3}[\.)]|\(\d{1,3}\))\s", text)]
    if not anchors:
        # simple slice at whitespace boundaries
        return [text[i:i + size] for i in range(0, len(text), size)]
    chunks: List[str] = []
    start = 0
    current_end = 0
    for i, a in enumerate(anchors):
        # accumulate until next anchor would break the size budget
        next_anchor = anchors[i + 1] if i + 1 < len(anchors) else len(text)
        if next_anchor - start > size and start != a:
            chunks.append(text[start:a])
            start = a
        current_end = next_anchor
    chunks.append(text[start:len(text)])
    # merge very small trailing chunk into previous
    if len(chunks) > 1 and len(chunks[-1]) < 500:
        chunks[-2] = chunks[-2] + "\n" + chunks[-1]
        chunks.pop()
    return chunks


def _sanitize_json(s: str) -> str:
    """Repair the #1 cause of json.loads failures on AI output: LaTeX / chemistry
    backslashes like \\sigma, \\pi, \\frac that aren't valid JSON escapes. Any backslash
    not starting a valid escape (\" \\ / b f n r t u) is doubled so it survives decoding."""
    return re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', s)


def _loads_lenient(s: str):
    """json.loads, but retry once with escape sanitisation before giving up."""
    try:
        return json.loads(s)
    except Exception:
        return json.loads(_sanitize_json(s))



async def _extract_one(chat_cls, user_msg_cls, chunk: str, subject_hint: str, key: str) -> Tuple[list, list]:
    """One AI call for one chunk. Handles retries on rate-limit and multiple JSON arrays."""
    errors: list = []
    prompt = f"Subject hint: {subject_hint}\n\n---\n{chunk}\n---\n\nReturn a single JSON array with every question you find. No prose, no fences."
    raw = ""
    for attempt in range(CHUNK_RETRIES):
        try:
            raw = await ai_complete(SYSTEM_EXTRACT, prompt, max_tokens=32768)
            break
        except Exception as e:
            msg = str(e)
            if "concurrent_request_limit" in msg or "CONCURRENCY_REQUEST_LIMIT" in msg or "429" in msg:
                await asyncio.sleep(1.5 + attempt * 1.5)
                continue
            return [], [f"AI call failed: {e}"]
    if not raw:
        return [], ["AI call failed after retries"]

    # normalise the response
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r"```$", "", raw).strip()

    # 1) Try parsing whole response as JSON array
    if raw.startswith("["):
        try:
            items = _loads_lenient(raw)
            if isinstance(items, list): return items, errors
        except Exception:
            pass

    # 2) Find every balanced [...] block of OBJECTS and pick the one with the most items.
    #    (Require dict elements so we never latch onto an inner options array of strings
    #    when the outer array was truncated by a token limit.)
    best: list = []
    depth = 0; start = -1
    for i, ch in enumerate(raw):
        if ch == "[":
            if depth == 0: start = i
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0 and start >= 0:
                block = raw[start:i + 1]
                try:
                    val = _loads_lenient(block)
                    if (isinstance(val, list) and val
                            and all(isinstance(x, dict) for x in val)
                            and len(val) > len(best)):
                        best = val
                except Exception:
                    pass
                start = -1
    if best: return best, errors

    # 3) Last resort: extract JSON objects and collect them
    objs: list = []
    depth = 0; start = -1
    for i, ch in enumerate(raw):
        if ch == "{":
            if depth == 0: start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                block = raw[start:i + 1]
                try:
                    val = _loads_lenient(block)
                    if isinstance(val, dict): objs.append(val)
                except Exception:
                    pass
                start = -1
    if objs: return objs, errors
    return [], ["AI returned non-JSON output"]


async def ai_extract_questions(text: str, subject_hint: str = "Physics", progress_cb=None) -> Tuple[list, list]:
    """Extract structured questions. Chunks long text + parallel Gemini calls."""
    errors: list = []
    key = _get_key()
    if not key: return [], ["AI key missing — set one in Admin → AI Settings"]
    text = (text or "").strip()
    if not text: return [], ["Empty document text"]
    # hard cap for extreme cases but MUCH bigger than before
    text = text[:120000]

    chunks = _split_chunks(text, MAX_CHUNK)
    log.info(f"AI extract: {len(chunks)} chunk(s), total {len(text)} chars")

    # bounded parallelism
    sem = asyncio.Semaphore(MAX_PARALLEL)
    total = len(chunks); done = 0

    async def _run(chunk_text):
        nonlocal done
        async with sem:
            res = await _extract_one(None, None, chunk_text, subject_hint, key)
        done += 1
        if progress_cb:
            # Map chunk completion onto the 35-90% band of the overall bar.
            pct = 35 + int(55 * done / max(1, total))
            try: await progress_cb(pct, f"AI reading section {done} of {total}…")
            except Exception: pass
        return res

    results = await asyncio.gather(*[_run(c) for c in chunks], return_exceptions=True)

    all_items: list = []
    for r in results:
        if isinstance(r, Exception):
            errors.append(f"chunk failed: {r}"); continue
        items, errs = r
        errors.extend(errs)
        for it in items:
            if isinstance(it, dict): all_items.append(it)

    parsed = []
    seen_texts = set()
    for it in all_items:
        it.setdefault("type", "mcq_single")
        it.setdefault("subject", subject_hint)
        it.setdefault("chapter", "")
        it.setdefault("topic", "")
        it.setdefault("difficulty", "medium")
        it.setdefault("marks", 4)
        it.setdefault("negative_marks", 1)
        it.setdefault("options", [])
        it.setdefault("correct", [])
        it.setdefault("explanation", "")
        it.setdefault("language", "English")
        it.setdefault("status", "approved")
        if isinstance(it.get("correct"), str):
            it["correct"] = [it["correct"]] if it["correct"] else []
        txt = (it.get("text") or "").strip()
        if not txt: continue
        # dedupe by first 120 chars
        sig = re.sub(r"\s+", " ", txt.lower())[:120]
        if sig in seen_texts: continue
        seen_texts.add(sig)
        it["text"] = txt
        parsed.append(it)
    log.info(f"AI extract done: {len(parsed)} unique questions")
    return parsed, errors


async def ai_predict_difficulty(texts: List[str]) -> List[str]:
    """Predict difficulty for each question text."""
    key = _get_key()
    if not key or not texts: return ["medium"] * len(texts)
    numbered = "\n".join(f"{i+1}. {t[:400]}" for i, t in enumerate(texts))
    try:
        raw = await ai_complete(
            "Rate difficulty of each numbered question. Output ONLY a JSON array of lowercase strings from {easy,medium,hard}, same length as input.",
            numbered)
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if m:
            arr = json.loads(m.group(0))
            return [str(x).lower() if str(x).lower() in ("easy", "medium", "hard") else "medium" for x in arr][:len(texts)]
    except Exception as e:
        log.warning(f"difficulty predict fail: {e}")
    return ["medium"] * len(texts)


SYSTEM_GENERATE = """You are an expert NEET/JEE question setter.
From the study material provided, CREATE brand-new multiple-choice questions that TEST understanding of the material.
Output ONLY a JSON array (no prose, no markdown fences). Each item MUST have:
  type: "mcq_single"
  subject: one of "Mathematics","Physics","Chemistry","Biology" (use the hint if given)
  chapter: best-guess topic name from the material
  topic: specific sub-topic
  difficulty: "easy" | "medium" | "hard"
  marks: 4
  negative_marks: 1
  text: a clear, self-contained question
  options: array of EXACTLY 4 plausible strings
  correct: array with ONE option LETTER "A"/"B"/"C"/"D"
  explanation: 1-2 line reason why the answer is correct
Rules: questions must be answerable purely from general subject knowledge of the material. Vary difficulty. No duplicates. Return [] only if the material has no testable content."""


async def ai_generate_quiz(text: str, subject_hint: str = "Physics", n: int = 15):
    """Generate n fresh MCQs FROM study material (notes/chapter), not extract existing ones."""
    key = _get_key()
    if not key:
        return [], ["AI key missing — set one in Admin → AI Settings"]
    text = (text or "").strip()[:20000]
    if not text:
        return [], ["Empty document text"]
    n = max(3, min(int(n or 15), 25))
    prompt = f"Subject hint: {subject_hint}\nCreate exactly {n} MCQs.\n\n---\n{text}\n---\n\nReturn a single JSON array of {n} questions. No prose."
    try:
        raw = (await ai_complete(SYSTEM_GENERATE, prompt)).strip()
    except Exception as e:
        return [], [f"AI call failed: {e}"]
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r"```$", "", raw).strip()
    items = []
    m = re.search(r"\[.*\]", raw, re.DOTALL)
    if m:
        try:
            val = json.loads(m.group(0))
            if isinstance(val, list):
                items = val
        except Exception:
            pass
    parsed = []
    for it in items:
        if not isinstance(it, dict):
            continue
        it.setdefault("type", "mcq_single")
        it.setdefault("subject", subject_hint)
        it.setdefault("chapter", "")
        it.setdefault("topic", "")
        it.setdefault("difficulty", "medium")
        it.setdefault("marks", 4)
        it.setdefault("negative_marks", 1)
        it.setdefault("options", [])
        it.setdefault("correct", [])
        it.setdefault("explanation", "")
        if isinstance(it.get("correct"), str):
            it["correct"] = [it["correct"]] if it["correct"] else []
        if (it.get("text") or "").strip() and len(it.get("options") or []) >= 2:
            parsed.append(it)
    return parsed, ([] if parsed else ["AI returned no usable questions"])
