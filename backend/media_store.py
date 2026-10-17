"""Question pictures → files on the server (instead of base64 inside MongoDB).

Imports (Excel pictures, Word/PDF figures, admin uploads) arrive as data:image/...;base64 URLs.
externalize_question() writes each picture once to MEDIA_DIR (name = content hash, so the
same picture used twice is stored once) and replaces it with a short URL: /api/media/<hash>.<ext>.
The backend serves those files (see GET /api/media/{name} in server.py) with long cache headers.

MEDIA_DIR defaults to backend/media; on the VPS docker-compose mounts a volume there so pictures
survive rebuilds (back it up together with the Mongo dump).
"""
from __future__ import annotations

import base64
import hashlib
import os
import re
from pathlib import Path
from typing import Optional

MEDIA_DIR = Path(os.environ.get("MEDIA_DIR") or (Path(__file__).parent / "media"))
MEDIA_URL_PREFIX = "/api/media/"
NAME_RE = re.compile(r"^[a-f0-9]{24}\.(png|jpg|webp|gif)$")
_DATA_URL = re.compile(r"^data:image/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$")
_INLINE = re.compile(r"(!\[[^\]]*\]\()(data:image/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)(\))")
MAX_BYTES = 8 * 1024 * 1024


def _ensure_dir():
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)


def store_data_url(url: str) -> Optional[str]:
    """Save one data URL as a file; return its public path (or None if not a valid picture)."""
    if not isinstance(url, str) or not url.startswith("data:image/"):
        return None
    m = _DATA_URL.match(url.strip())
    if not m:
        return None
    ext = {"jpeg": "jpg", "jpg": "jpg"}.get(m.group(1), m.group(1))
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except Exception:
        return None
    if not raw or len(raw) > MAX_BYTES:
        return None
    name = hashlib.sha256(raw).hexdigest()[:24] + "." + ext
    _ensure_dir()
    path = MEDIA_DIR / name
    if not path.exists():
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(raw)
        os.replace(tmp, path)
    return MEDIA_URL_PREFIX + name


def _inline(text):
    if not isinstance(text, str) or "data:image/" not in text:
        return text
    return _INLINE.sub(lambda m: m.group(1) + (store_data_url(m.group(2)) or m.group(2)) + m.group(3), text)


def externalize_question(q: dict) -> dict:
    """In-place: move every embedded picture of a question dict to a file. Never raises."""
    try:
        for key in ("image_url", "explanation_image_url"):
            v = q.get(key)
            if isinstance(v, str) and v.startswith("data:image/"):
                q[key] = store_data_url(v) or v
        for key in ("text", "explanation", "hint", "text_hi"):
            if key in q:
                q[key] = _inline(q[key])
        for key in ("options", "options_hi"):
            if isinstance(q.get(key), list):
                q[key] = [_inline(o) for o in q[key]]
    except Exception:
        pass
    return q


def media_path(name: str) -> Optional[Path]:
    if not NAME_RE.match(name or ""):
        return None
    p = MEDIA_DIR / name
    return p if p.is_file() else None
