"""Fixes from the independent review of the 9 Nov meeting work: CBT submissions give coins / streak /
revision like the classic exam, coins only once per test, retakes don't skew ranks, teacher drafts,
tests that open later stay locked, private profiles, safe account deletion, chapter lists, courses.

    cd backend && python -m pytest -n 0 -p no:cacheprovider tests/test_review_fixes.py
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
STUDENT = {"id": "s-1", "role": "student", "email": "s@x.com", "name": "Student One", "email_results_enabled": False}
STUDENT2 = {"id": "s-2", "role": "student", "email": "s2@x.com", "name": "Student Two", "email_results_enabled": False}
PARENT = {"id": "p-1", "role": "parent", "email": "p@x.com", "name": "Parent", "child_ids": ["s-1"]}


def _q(i, **kw):
    base = {"id": f"q{i}", "type": "mcq_single", "subject": "Physics", "chapter": "Laws of Motion", "topic": "Friction",
            "student_class": "11", "difficulty": "medium", "marks": 4, "negative_marks": 1, "text": f"Question {i}?",
            "options": ["Alpha", "Beta", "Gamma", "Delta"], "correct": ["B"], "explanation": "Because.",
            "status": "approved", "created_at": datetime.now(timezone.utc).isoformat()}
    base.update(kw)
    return base


@pytest.fixture()
def env():
    import server
    import cbt
    from fastapi import FastAPI
    server.db = mongomock_motor.AsyncMongoMockClient()["fnjee_review"]
    me = {"user": ADMIN}

    async def _me():
        return me["user"]
    server.app.dependency_overrides[server.get_current_user] = _me
    # the CBT router binds its db when registered — mount a copy on the test database
    cbt_app = FastAPI()
    cbt.register_cbt(cbt_app, server.db, server.get_current_user, server.require_role,
                     on_submit=server.after_submit, gate=server._student_gate)
    cbt_app.dependency_overrides[server.get_current_user] = _me
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test")
    cbt_client = httpx.AsyncClient(transport=httpx.ASGITransport(app=cbt_app), base_url="http://test")

    def as_(u, cbt_api=False):
        me["user"] = u
        return cbt_client if cbt_api else client
    yield server, as_
    server.app.dependency_overrides.clear()


async def _legacy_submit(c, test_id, retake=False, answer="B"):
    a = (await c.post("/api/attempts/start", json={"test_id": test_id, "use_retake_pass": retake})).json()
    r = await c.post("/api/attempts/submit", json={"attempt_id": a["id"],
                                                   "answers": [{"question_id": "q1", "answer": [answer]}]})
    assert r.status_code == 200, r.text
    return r.json()


def test_cbt_submit_gives_coins_streak_and_revision_once(env):
    server, as_ = env

    async def run():
        await server.db.users.insert_one(dict(STUDENT, reward_coins=0, streak_days=0))
        await server.db.questions.insert_many([_q(1), _q(2)])
        await server.db.tests.insert_one({"id": "t1", "title": "Mock", "duration_minutes": 30, "question_ids": ["q1", "q2"],
                                          "assigned_to": [], "created_by_role": "admin", "total_marks": 8})
        c = as_(STUDENT, cbt_api=True)
        a = (await c.post("/api/cbt/attempts/start", json={"test_id": "t1"})).json()
        await c.post(f"/api/cbt/attempts/{a['id']}/response", json={"question_id": "q1", "answer": ["opt_1"]})
        await c.post(f"/api/cbt/attempts/{a['id']}/response", json={"question_id": "q2", "answer": ["opt_0"]})
        r = await c.post(f"/api/cbt/attempts/{a['id']}/submit", json={})
        assert r.status_code == 200, r.text
        u = await server.db.users.find_one({"id": "s-1"})
        assert u["reward_coins"] == 3 and u["streak_days"] == 1          # +4 −1, first study day
        assert await server.db.reviews.find_one({"user_id": "s-1", "question_id": "q2"})   # wrong one → revision
        # submitting again (double click) never makes a second result
        r2 = await c.post(f"/api/cbt/attempts/{a['id']}/submit", json={})
        assert r2.json()["result_id"] == r.json()["result_id"]
        assert await server.db.attempts.count_documents({"user_id": "s-1"}) == 1
        # a retake gives no more coins
        b = (await c.post("/api/cbt/attempts/start", json={"test_id": "t1", "retake": True})).json()
        await c.post(f"/api/cbt/attempts/{b['id']}/response", json={"question_id": "q1", "answer": ["opt_1"]})
        await c.post(f"/api/cbt/attempts/{b['id']}/submit", json={})
        u = await server.db.users.find_one({"id": "s-1"})
        assert u["reward_coins"] == 3
    asyncio.run(run())


def test_legacy_retake_no_coins_and_ranks_count_first_attempts(env):
    server, as_ = env

    async def run():
        await server.db.users.insert_many([dict(STUDENT, reward_coins=0), dict(STUDENT2, reward_coins=0)])
        await server.db.questions.insert_one(_q(1))
        await server.db.tests.insert_one({"id": "t1", "title": "Mock", "duration_minutes": 30, "question_ids": ["q1"],
                                          "assigned_to": [], "created_by_role": "admin", "total_marks": 4})
        c = as_(STUDENT)
        await _legacy_submit(c, "t1", answer="A")          # 0 marks (no negative marking flag on this test)
        await _legacy_submit(c, "t1", retake=True)          # 4 marks on the retake
        assert (await server.db.users.find_one({"id": "s-1"}))["reward_coins"] == 0
        c = as_(STUDENT2)
        await _legacy_submit(c, "t1")                        # 4 marks
        assert (await server.db.users.find_one({"id": "s-2"}))["reward_coins"] == 4
        # student 2's percentile: compared with student 1's FIRST attempt only, not with itself
        p = (await c.get("/api/analytics/test-percentile/t1", params={"score": 4})).json()
        assert p == {"percentile": 100, "beat": 1, "total": 1}
        qa = (await as_(ADMIN).get("/api/tests/t1/question-analysis")).json()
        # one attempt per student: s-1's first try (wrong) + s-2 (correct); s-1's correct retake isn't counted
        assert qa["students"] == 2 and qa["questions"][0]["attempted"] == 2 and qa["questions"][0]["correct"] == 1
        use = (await as_(ADMIN).get("/api/questions/q1/usage")).json()
        assert use["attempted_by"] == 2
    asyncio.run(run())


def test_teacher_drafts_old_papers_and_locked_tests(env):
    server, as_ = env

    async def run():
        await server.db.users.insert_many([dict(STUDENT), dict(STUDENT2), dict(TEACHER)])
        await server.db.questions.insert_many([_q(1), _q(2)])
        # a teacher paper made before drafts existed stays open to students
        await server.db.tests.insert_one({"id": "old", "title": "Old paper", "question_ids": ["q1"], "assigned_to": [],
                                          "created_by": "t-1", "created_by_role": "teacher", "duration_minutes": 10})
        ids = [x["id"] for x in (await as_(STUDENT).get("/api/tests")).json()]
        assert "old" in ids
        # a new paper is a draft: hidden, and can't be opened by id
        t = (await as_(TEACHER).post("/api/tests", json={"title": "New", "question_ids": ["q1", "q2"]})).json()
        assert t["draft"] is True
        assert t["id"] not in [x["id"] for x in (await as_(STUDENT).get("/api/tests")).json()]
        r = await as_(STUDENT).get(f"/api/tests/{t['id']}", params={"include_questions": True})
        assert r.status_code == 403
        r = await as_(STUDENT, cbt_api=True).get(f"/api/cbt/exam/{t['id']}")
        assert r.status_code == 403
        r = await as_(STUDENT).post("/api/attempts/start", json={"test_id": t["id"]})
        assert r.status_code == 400
        # assigned from tomorrow → listed, but questions stay locked until then
        when = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        await as_(TEACHER).post("/api/tests/assign", json={"test_id": t["id"], "student_ids": ["s-1"], "starts_at": when})
        assert t["id"] in [x["id"] for x in (await as_(STUDENT).get("/api/tests")).json()]
        assert (await as_(STUDENT).get(f"/api/tests/{t['id']}", params={"include_questions": True})).status_code == 403
        assert (await as_(STUDENT, cbt_api=True).get(f"/api/cbt/exam/{t['id']}")).status_code == 403
        assert (await as_(STUDENT, cbt_api=True).post("/api/cbt/attempts/start", json={"test_id": t["id"]})).status_code == 400
        # opens now → allowed
        await as_(TEACHER).post("/api/tests/assign", json={"test_id": t["id"], "student_ids": ["s-1"], "starts_at": ""})
        assert (await as_(STUDENT, cbt_api=True).get(f"/api/cbt/exam/{t['id']}")).status_code == 200
        # un-assigning everyone puts it back to draft (not open to all)
        await as_(TEACHER).post("/api/tests/assign", json={"test_id": t["id"], "student_ids": []})
        assert t["id"] not in [x["id"] for x in (await as_(STUDENT2).get("/api/tests")).json()]
    asyncio.run(run())


def test_profiles_are_private_and_deleting_a_student_keeps_tests_private(env):
    server, as_ = env

    async def run():
        await server.db.users.insert_many([dict(STUDENT, password=server.hash_pw("Secret@123")), dict(STUDENT2), dict(PARENT)])
        assert (await as_(STUDENT2).get("/api/users/s-1")).status_code == 403
        assert (await as_(STUDENT).get("/api/users/s-1")).status_code == 200
        assert (await as_(PARENT).get("/api/users/s-1")).status_code == 200
        assert (await as_(TEACHER).get("/api/users/s-1")).status_code == 200
        # a drill and a parent's test made only for student 1
        await server.db.tests.insert_many([
            {"id": "drill", "title": "Drill", "question_ids": [], "assigned_to": ["s-1"], "created_by": "s-1", "created_by_role": "student"},
            {"id": "ptest", "title": "From parent", "question_ids": [], "assigned_to": ["s-1"], "created_by": "p-1", "created_by_role": "parent"},
            {"id": "shared", "title": "Class test", "question_ids": [], "assigned_to": ["s-1", "s-2"], "created_by": "admin-1", "created_by_role": "admin"}])
        r = await as_(STUDENT).request("DELETE", "/api/auth/me", json={"password": "Secret@123", "confirm": "DELETE"})
        assert r.status_code == 200, r.text
        ids = [x["id"] for x in (await as_(STUDENT2).get("/api/tests")).json()]
        assert "drill" not in ids and "ptest" not in ids and "shared" in ids
        assert (await server.db.tests.find_one({"id": "ptest"}))["draft"] is True
    asyncio.run(run())


def test_chapter_list_playlist_and_courses(env):
    server, as_ = env

    async def run():
        await server.db.questions.insert_many(
            [_q(i, chapter="Laws of Motion") for i in range(1, 6)] +
            [_q(10 + i, subject="", chapter="Laws of Motion") for i in range(30)] +
            [_q(50 + i, subject="Chemistry", chapter="Acids/Bases and Salts") for i in range(30)])
        rows = (await as_(STUDENT).get("/api/practice/chapters")).json()
        assert all(r["subject"] for r in rows)
        p = await as_(STUDENT).get("/api/playlist/Chemistry/Acids%2FBases%20and%20Salts")
        assert p.status_code == 200 and p.json()["chapter"] == "Acids/Bases and Salts"
        assert p.json()["steps"][0]["questions"]
        # the course catalog is filled once, without duplicates
        server._courses_checked = None
        await asyncio.gather(*[as_(STUDENT).get("/api/courses") for _ in range(3)])
        slugs = [c["slug"] for c in (await as_(STUDENT).get("/api/courses")).json()]
        assert len(slugs) == len(set(slugs)) and len(slugs) == len(server.COURSE_SEEDS)
    asyncio.run(run())
