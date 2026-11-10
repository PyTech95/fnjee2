"""Changes from the 9 Nov review meeting: free retakes, teacher assignment with a test date,
DPP that mixes subjects / follows chapters, clean chapter lists, auto flashcards, JEE courses.

    cd backend && python -m pytest -n 0 -p no:cacheprovider tests/test_meeting_nov9.py
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "fnjee_test")
os.environ.setdefault("JWT_SECRET", "x" * 40)
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

mongomock_motor = pytest.importorskip("mongomock_motor")
httpx = pytest.importorskip("httpx")
from datetime import datetime, timezone, timedelta  # noqa: E402

ADMIN = {"id": "admin-1", "role": "admin", "email": "a@x.com", "name": "Admin"}
TEACHER = {"id": "t-1", "role": "teacher", "email": "t@x.com", "name": "Teacher"}
TEACHER2 = {"id": "t-2", "role": "teacher", "email": "t2@x.com", "name": "Other teacher"}
STUDENT = {"id": "s-1", "role": "student", "email": "s@x.com", "name": "Student One", "exam_target": "NEET"}
STUDENT2 = {"id": "s-2", "role": "student", "email": "s2@x.com", "name": "Student Two", "exam_target": "JEE"}


def _q(i, **kw):
    base = {"id": f"q{i}", "type": "mcq_single", "subject": "Physics", "chapter": "Laws of Motion", "topic": "Friction",
            "student_class": "11", "difficulty": "medium", "marks": 4, "negative_marks": 1, "text": f"Question {i}?",
            "options": ["Alpha", "Beta", "Gamma", "Delta"], "correct": ["B"], "explanation": "Because of Newton.",
            "status": "approved", "created_at": datetime.now(timezone.utc).isoformat()}
    base.update(kw)
    return base


@pytest.fixture()
def env():
    import server
    server.db = mongomock_motor.AsyncMongoMockClient()["fnjee_meeting"]
    me = {"user": ADMIN}

    async def _me():
        return me["user"]
    server.app.dependency_overrides[server.get_current_user] = _me
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test")

    def as_(u):
        me["user"] = u
        return client
    yield server, as_
    server.app.dependency_overrides.clear()


def test_retake_is_free_and_starts_a_new_attempt(env):
    server, as_ = env

    async def run():
        await server.db.users.insert_many([dict(STUDENT, retake_passes=0)])
        await server.db.questions.insert_many([_q(1), _q(2)])
        await server.db.tests.insert_one({"id": "t1", "title": "Mock", "duration_minutes": 30, "question_ids": ["q1", "q2"],
                                          "assigned_to": [], "created_by_role": "admin", "total_marks": 8})
        c = as_(STUDENT)
        a1 = (await c.post("/api/attempts/start", json={"test_id": "t1"})).json()
        await server.db.attempts.update_one({"id": a1["id"]}, {"$set": {"status": "submitted", "submitted_at": "2026-11-09T10:00:00"}})
        # opening the test again shows the result…
        again = (await c.post("/api/attempts/start", json={"test_id": "t1"})).json()
        assert again["id"] == a1["id"] and again["status"] == "submitted"
        # …and Retake works without any Retake Pass
        r = await c.post("/api/attempts/start", json={"test_id": "t1", "use_retake_pass": True})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "in_progress" and r.json()["id"] != a1["id"]
        store = (await c.get("/api/store")).json()
        assert all(i["id"] != "retake_pass" for i in store["items"])
    asyncio.run(run())


def test_teacher_assigns_with_date_and_drafts_stay_private(env):
    server, as_ = env

    async def run():
        await server.db.users.insert_many([dict(STUDENT), dict(STUDENT2), dict(TEACHER), dict(TEACHER2)])
        await server.db.questions.insert_many([_q(1), _q(2, subject="Biology", chapter="Human Health and Disease")])
        # teacher builds a paper → not visible to students yet
        t = (await as_(TEACHER).post("/api/tests", json={"title": "Weekly test", "question_ids": ["q1", "q2"]})).json()
        assert not [x for x in (await as_(STUDENT).get("/api/tests")).json() if x["id"] == t["id"]]
        # another teacher can't assign it
        r = await as_(TEACHER2).post("/api/tests/assign", json={"test_id": t["id"], "student_ids": ["s-1"]})
        assert r.status_code == 403
        # the directory lists students for the teacher
        names = [s["name"] for s in (await as_(TEACHER).get("/api/students/directory")).json()]
        assert names == ["Student One", "Student Two"]
        # assign to student 1 from tomorrow
        when = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        r = await as_(TEACHER).post("/api/tests/assign", json={"test_id": t["id"], "student_ids": ["s-1", "nobody"], "starts_at": when})
        assert r.status_code == 200 and r.json()["assigned"] == 1
        mine = [x for x in (await as_(STUDENT).get("/api/tests")).json() if x["id"] == t["id"]]
        assert mine and mine[0]["starts_at"] == when
        assert not [x for x in (await as_(STUDENT2).get("/api/tests")).json() if x["id"] == t["id"]]
        # subject + chapter summary on the card
        assert mine[0]["content"]["subjects"] == ["Physics", "Biology"] or set(mine[0]["content"]["subjects"]) == {"Physics", "Biology"}
        assert "Human Health and Disease" in mine[0]["content"]["chapters"]
        note = await server.db.notifications.find_one({"user_id": "s-1", "type": "test_assigned"})
        assert "Weekly test" in note["message"] and "opens" in note["message"]
        # can't start before the date
        r = await as_(STUDENT).post("/api/attempts/start", json={"test_id": t["id"]})
        assert r.status_code == 400 and "opens on" in r.json()["detail"]
        # date cleared → starts
        await as_(TEACHER).post("/api/tests/assign", json={"test_id": t["id"], "student_ids": ["s-1"], "starts_at": ""})
        r = await as_(STUDENT).post("/api/attempts/start", json={"test_id": t["id"]})
        assert r.status_code == 200, r.text
    asyncio.run(run())


def test_dpp_mixes_subjects_and_follows_chapters(env):
    server, as_ = env

    async def run():
        await server.db.users.insert_one(dict(STUDENT))
        qs = [_q(i, subject="Biology", chapter="Genetics") for i in range(1, 61)]                 # bank starts with Biology
        qs += [_q(100 + i, subject="Physics", chapter="Laws of Motion") for i in range(20)]
        qs += [_q(200 + i, subject="Chemistry", chapter="Equilibrium") for i in range(20)]
        await server.db.questions.insert_many(qs)
        c = as_(STUDENT)
        d = (await c.post("/api/dpp/generate", json={"subjects": ["Physics", "Chemistry", "Biology"], "count": 15})).json()
        t = await server.db.tests.find_one({"id": d["test_id"]})
        got = {q["subject"] for q in await server.db.questions.find({"id": {"$in": t["question_ids"]}}).to_list(100)}
        assert got == {"Physics", "Chemistry", "Biology"} and len(t["question_ids"]) == 15
        # chapter-only DPP
        d = (await c.post("/api/dpp/generate", json={"subjects": ["Physics", "Chemistry"], "chapters": ["Equilibrium"],
                                                     "count": 10, "regenerate": True})).json()
        t = await server.db.tests.find_one({"id": d["test_id"]})
        chs = {q["chapter"] for q in await server.db.questions.find({"id": {"$in": t["question_ids"]}}).to_list(100)}
        assert chs == {"Equilibrium"} and "Equilibrium" in t["title"]
    asyncio.run(run())


def test_student_chapter_lists_flashcards_and_courses(env):
    server, as_ = env

    async def run():
        await server.db.questions.insert_many(
            [_q(i, chapter="Laws of Motion") for i in range(1, 6)] +
            [_q(10 + i, chapter="D") for i in range(40)] +                       # import debris
            [_q(60 + i, chapter="Point") for i in range(30)] +
            [_q(100 + i, subject="Mathematics", chapter="Logarithms", student_class="11") for i in range(30)])
        st = [r["chapter"] for r in (await as_(STUDENT).get("/api/practice/chapters")).json()]
        assert "Laws of Motion" in st and "Logarithms" in st and "D" not in st and "Point" not in st
        adm = [r["chapter"] for r in (await as_(ADMIN).get("/api/practice/chapters")).json()]
        assert "D" in adm   # admins still see everything
        # flashcards exist for any chapter (built from its questions, no answer leak beyond the card back)
        cards = (await as_(STUDENT).get("/api/flashcards", params={"subject": "Physics", "chapter": "Laws of Motion"})).json()
        assert len(cards) == 5 and cards[0]["back"].startswith("Answer: B) Beta")
        chs = (await as_(STUDENT).get("/api/flashcards/chapters")).json()
        assert any(c["chapter"] == "Laws of Motion" for c in chs)
        pl = (await as_(STUDENT).get("/api/playlist/chapters")).json()
        assert any(c["chapter"] == "Logarithms" for c in pl)
        p = (await as_(STUDENT).get("/api/playlist/Physics/Laws of Motion")).json()
        assert p["steps"][0]["questions"] and "correct" not in p["steps"][0]["questions"][0]
        # JEE batches are in the catalog (also added to an existing catalog)
        await server.db.courses.insert_one({"slug": "target-ascend-2027", "title": "old", "target": "NEET 2027"})
        targets = {c["target"] for c in (await as_(STUDENT).get("/api/courses")).json()}
        assert {"JEE 2027", "JEE 2028", "NEET 2027"} <= targets
    asyncio.run(run())


def test_login_role_tab_is_only_a_hint(env):
    server, as_ = env

    async def run():
        await server.db.users.insert_one(dict(STUDENT, password=server.hash_pw("Secret@123")))
        c = as_(ADMIN)
        # wrong tab → signs in to the real (student) account, never as admin
        r = await c.post("/api/auth/login", json={"email": "S@x.com", "password": "Secret@123", "role": "admin"})
        assert r.status_code == 200 and r.json()["user"]["role"] == "student"
        r = await c.post("/api/auth/login", json={"email": "s@x.com", "password": "nope", "role": "student"})
        assert r.status_code == 401
    asyncio.run(run())
