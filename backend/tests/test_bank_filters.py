"""More question-bank filters, sorting, facets, export-by-filter and quick approve.

    cd backend && python -m pytest -n 0 -p no:cacheprovider tests/test_bank_filters.py
"""
import asyncio
import io
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


def _q(i, **kw):
    base = {"id": f"q{i}", "type": "mcq_single", "subject": "Physics", "chapter": "Laws of Motion",
            "topic": "Friction", "student_class": "11", "difficulty": "medium", "marks": 4, "negative_marks": 1,
            "text": f"Question {i}?", "options": ["a", "b", "c", "d"], "correct": ["A"], "explanation": "because",
            "status": "approved", "exam": "JEE Main", "year": "2024", "source": "DPP 01", "language": "English",
            "tags": [], "created_at": (datetime.now(timezone.utc) - timedelta(days=40)).isoformat()}
    base.update(kw)
    return base


@pytest.fixture()
def app_client():
    import server
    server.db = mongomock_motor.AsyncMongoMockClient()["fnjee_filters"]
    admin = {"id": "admin-1", "role": "admin", "email": "a@x.com", "name": "Admin"}

    async def _admin():
        return admin
    server.app.dependency_overrides[server.get_current_user] = _admin
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test")
    yield server, client
    server.app.dependency_overrides.clear()


def test_filters_sort_facets_export_and_approve(app_client):
    server, client = app_client
    now = datetime.now(timezone.utc).isoformat()

    async def run():
        await server.db.questions.insert_many([
            _q(1),
            _q(2, correct=[], status="review", text="Find the tension in the string", difficulty="hard"),
            _q(3, explanation="", image_url="/api/media/x.png", difficulty="easy", created_at=now),
            _q(4, exam="NEET", year="2023", source="", tags=["pyq", "important"], options=["Newton", "b", "c", "d"]),
            _q(5, text="Question 1?", language="Hindi"),                         # duplicate text of q1
            _q(6, answer_origin="ai_generated", status="review", answer_review_required=True, tags=["ai-unsure"]),
        ])

        async def ids(**params):
            r = await client.get("/api/questions/page", params=params)
            assert r.status_code == 200, r.text
            return sorted(x["id"] for x in r.json()["items"])

        assert await ids(answer="missing") == ["q2"]
        assert await ids(solution="missing") == ["q3"]
        assert await ids(image="with") == ["q3"]
        assert await ids(added="today") == ["q3"]
        assert await ids(exam="NEET") == ["q4"]
        assert await ids(year="2023") == ["q4"]
        assert await ids(source="__none__") == ["q4"]
        assert await ids(tag="pyq") == ["q4"]
        assert await ids(language="Hindi") == ["q5"]
        assert await ids(search="newton") == ["q4"]             # matches an option
        assert await ids(search="zzz") == []
        assert await ids(duplicates=True) == ["q1", "q5"]
        assert await ids(issue="ai-unsure") == ["q6"]
        assert await ids(issue="ai-answered") == ["q6"]
        assert await ids(issue="answer-review") == ["q6"]
        assert await ids(issue="no-answer") == ["q2"]

        r = await client.get("/api/questions/page", params={"sort": "difficulty_asc", "page_size": 10})
        order = [x["difficulty"] for x in r.json()["items"]]
        assert order[0] == "easy" and order[-1] == "hard"

        f = (await client.get("/api/questions/facets")).json()
        assert {"name": "NEET", "count": 1} in f["exams"]
        assert any(t["name"] == "pyq" for t in f["tags"])
        assert f["checks"]["no_answer"] == 1 and f["checks"]["duplicates"] == 2
        assert f["checks"]["added_today"] == 1 and f["checks"]["with_image"] == 1

        r = await client.get("/api/questions/export", params={"exam": "NEET"})
        assert r.status_code == 200
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(r.content))
        rows = [row for ws in wb.worksheets for row in ws.iter_rows(values_only=True)
                if row and any(isinstance(c, str) and "Question 4" in c for c in row)]
        assert len(rows) == 1

        # quick approve clears the "AI answer needs review" flag
        r = await client.patch("/api/questions/q6", json={"status": "approved"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "approved" and d["answer_review_required"] is False

        # edit tags through PATCH are cleaned like imports
        r = await client.patch("/api/questions/q1", json={"chapter": "nlm", "student_class": "XI"})
        assert (r.json()["chapter"], r.json()["student_class"]) == ("Laws of Motion", "11")
    asyncio.run(run())


def test_delete_my_account(app_client):
    server, client = app_client
    student = {"id": "stu-1", "role": "student", "email": "s@x.com", "name": "S"}

    async def _student():
        return student

    async def run():
        await server.db.users.insert_many([
            {**student, "password": server.hash_pw("secret12")},
            {"id": "par-1", "role": "parent", "email": "p@x.com", "child_ids": ["stu-1"], "password": "x"},
        ])
        await server.db.attempts.insert_one({"id": "a1", "user_id": "stu-1", "test_id": "t1"})
        await server.db.notifications.insert_one({"id": "n1", "user_id": "stu-1"})
        await server.db.tests.insert_one({"id": "t1", "assigned_to": ["stu-1", "other"]})
        server.app.dependency_overrides[server.get_current_user] = _student
        r = await client.request("DELETE", "/api/auth/me", json={"password": "wrong", "confirm": "DELETE"})
        assert r.status_code == 401
        r = await client.request("DELETE", "/api/auth/me", json={"password": "secret12", "confirm": "no"})
        assert r.status_code == 400
        r = await client.request("DELETE", "/api/auth/me", json={"password": "secret12", "confirm": "delete"})
        assert r.status_code == 200, r.text
        assert await server.db.users.find_one({"id": "stu-1"}) is None
        assert await server.db.attempts.count_documents({"user_id": "stu-1"}) == 0
        assert await server.db.notifications.count_documents({"user_id": "stu-1"}) == 0
        assert (await server.db.users.find_one({"id": "par-1"}))["child_ids"] == []
        assert (await server.db.tests.find_one({"id": "t1"}))["assigned_to"] == ["other"]
    asyncio.run(run())


def test_practice_chapters_and_parent_assign_by_chapter(app_client):
    server, client = app_client
    parent = {"id": "par-1", "role": "parent", "email": "p@x.com", "name": "P", "child_ids": ["stu-1"]}

    async def _parent():
        return parent

    async def run():
        await server.db.users.insert_one({**parent, "password": "x"})
        await server.db.questions.insert_many([
            _q(1), _q(2, topic="Tension"), _q(3, chapter="Gravitation", topic=""),
            _q(4, subject="Chemistry", chapter="Equilibrium", topic="pH"), _q(5, status="review"),
        ])
        r = await client.get("/api/practice/chapters")
        rows = r.json()
        lom = next(x for x in rows if x["chapter"] == "Laws of Motion")
        assert lom["count"] == 2 and lom["student_class"] == "11"          # review question excluded
        assert {t["name"] for t in lom["topics"]} == {"Friction", "Tension"}
        server.app.dependency_overrides[server.get_current_user] = _parent
        r = await client.post("/api/tests/parent-assign", json={
            "title": "LoM", "subjects": ["Physics"], "difficulty": "any", "chapters": ["Laws of Motion"],
            "topics": ["Friction"], "num_questions": 5, "duration_minutes": 20, "child_id": "stu-1"})
        assert r.status_code == 200, r.text
        assert r.json()["question_ids"] == ["q1"]
    asyncio.run(run())


def test_signup_cannot_create_admin_and_admin_can(app_client):
    server, client = app_client

    async def run():
        server.app.dependency_overrides.clear()
        r = await client.post("/api/auth/signup", json={"name": "X", "email": "x@x.com", "password": "secret123", "role": "admin"})
        assert r.status_code == 403
        r = await client.post("/api/auth/signup", json={"name": "T", "email": "t@x.com", "password": "secret123", "role": "teacher"})
        assert r.status_code == 403
        r = await client.post("/api/auth/signup", json={"name": "S", "email": "s2@x.com", "password": "short", "role": "student"})
        assert r.status_code == 400
        r = await client.post("/api/auth/signup", json={"name": " Stu ", "email": "s3@x.com", "password": "secret123", "role": "student"})
        assert r.status_code == 200 and r.json()["user"]["role"] == "student" and r.json()["user"]["name"] == "Stu"
        assert await server.db.users.count_documents({"role": "admin"}) == 0

        admin = {"id": "admin-1", "role": "admin", "email": "a@x.com", "name": "Admin"}

        async def _admin():
            return admin
        server.app.dependency_overrides[server.get_current_user] = _admin
        r = await client.post("/api/admin/users", json={"name": "Teacher One", "email": "T1@x.com", "password": "secret123", "role": "teacher"})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "teacher" and "password" not in r.json()
        d = await server.db.users.find_one({"email": "t1@x.com"})
        assert d and server.check_pw("secret123", d["password"])
    asyncio.run(run())
