"""Question bank mapping: Subject → Class → Chapter → Topic tree, label clean-up, filters,
bulk edit by filter, and the AI auto-tagger (AI call mocked).

In-process against mongomock-motor — no live server needed:
    cd backend && python -m pytest -n 0 -p no:cacheprovider tests/test_question_taxonomy.py
"""
import asyncio
import json
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

import taxonomy  # noqa: E402


def _q(i, **kw):
    base = {"id": f"q{i}", "type": "mcq_single", "subject": "Chemistry", "chapter": "", "topic": "",
            "student_class": "", "difficulty": "medium", "marks": 4, "negative_marks": 1,
            "text": f"Question {i}?", "options": ["a", "b", "c", "d"], "correct": ["A"],
            "status": "approved", "created_at": f"2026-10-01T00:00:{i:02d}"}
    base.update(kw)
    return base


@pytest.fixture()
def app_client():
    import server
    server.db = mongomock_motor.AsyncMongoMockClient()["fnjee_tax"]
    admin = {"id": "admin-1", "role": "admin", "email": "a@x.com", "name": "Admin"}

    async def _admin():
        return admin
    server.app.dependency_overrides[server.get_current_user] = _admin
    transport = httpx.ASGITransport(app=server.app)
    client = httpx.AsyncClient(transport=transport, base_url="http://test")
    yield server, client
    server.app.dependency_overrides.clear()


# ---------------- pure rules ----------------

@pytest.mark.parametrize("raw,expected", [
    ("XI", "11"), ("11th", "11"), ("Class-11", "11"), ("class 12", "12"), ("XII", "12"),
    ("+2", "12"), ("drop", "Dropper"), ("", ""), ("12", "12"),
])
def test_normalize_class(raw, expected):
    assert taxonomy.normalize_class(raw) == expected


def test_normalize_tags_rules():
    t = taxonomy.normalize_tags({"subject": "chem", "student_class": "XI", "chapter": "Mole concept "})
    assert t == {"subject": "Chemistry", "student_class": "11",
                 "chapter": "Some Basic Concepts of Chemistry", "topic": "Mole Concept"}
    # class filled from a chapter that exists only in class 12
    assert taxonomy.normalize_tags({"subject": "Chemistry", "chapter": "solutions"})["student_class"] == "12"
    # wrongly defaulted subject repaired from an unambiguous chapter
    assert taxonomy.normalize_tags({"subject": "Physics", "chapter": "Equilibrium"})["subject"] == "Chemistry"
    # ambiguous chapter (both subjects have Thermodynamics) keeps the given subject
    assert taxonomy.normalize_tags({"subject": "Physics", "chapter": "Thermodynamics"})["subject"] == "Physics"
    # typo + chapter-number prefix, abbreviation does not become a topic
    assert taxonomy.normalize_tags({"subject": "Physics", "chapter": "Ch 4 - Laws of Moton"})["chapter"] == "Laws of Motion"
    nlm = taxonomy.normalize_tags({"subject": "Physics", "chapter": "NLM"})
    assert nlm["chapter"] == "Laws of Motion" and nlm["topic"] == ""
    # unknown chapter kept as typed (cleaned)
    assert taxonomy.normalize_tags({"subject": "Physics", "chapter": "  Kinematics  "})["chapter"] == "Kinematics"


# ---------------- API ----------------

def test_taxonomy_tree_filters_and_normalize(app_client):
    server, client = app_client

    async def run():
        await server.db.questions.insert_many([
            _q(1, chapter="Some Basic Concepts of Chemistry", topic="Mole Concept", student_class="11"),
            _q(2, chapter="mole concept", student_class="XI"),
            _q(3, chapter="Solutions", status="review", correct=[]),
            _q(4, subject="Physics", chapter="Laws of Motion", topic="Friction", student_class="11"),
            _q(5, subject="Physics"),                           # nothing tagged
            _q(6, subject="chem", chapter="Equilibrium"),
        ])
        r = await client.get("/api/questions/taxonomy")
        assert r.status_code == 200, r.text
        tax = r.json()
        assert tax["total"] == 6 and tax["untagged"] == 4
        assert tax["status"]["review"] == 1

        # untagged + "not set" filters
        r = await client.get("/api/questions/page", params={"untagged": True})
        assert r.json()["total"] == 4
        r = await client.get("/api/questions/page", params={"subject": "Physics", "chapter": "__none__"})
        assert [x["id"] for x in r.json()["items"]] == ["q5"]

        # dry run changes nothing
        r = await client.post("/api/questions/normalize-taxonomy", json={"dry_run": True})
        assert r.json()["changed"] >= 3
        assert (await server.db.questions.find_one({"id": "q2"}))["student_class"] == "XI"

        r = await client.post("/api/questions/normalize-taxonomy", json={})
        res = r.json()
        assert res["changed"] >= 3 and not res["dry_run"]
        q2 = await server.db.questions.find_one({"id": "q2"}, {"_id": 0})
        assert (q2["student_class"], q2["chapter"], q2["topic"]) == ("11", "Some Basic Concepts of Chemistry", "Mole Concept")
        q3 = await server.db.questions.find_one({"id": "q3"}, {"_id": 0})
        assert q3["student_class"] == "12"
        q6 = await server.db.questions.find_one({"id": "q6"}, {"_id": 0})
        assert (q6["subject"], q6["student_class"]) == ("Chemistry", "11")

        # tree now groups q1+q2 under one chapter
        tax = (await client.get("/api/questions/taxonomy")).json()
        chem = next(s for s in tax["subjects"] if s["name"] == "Chemistry")
        c11 = next(c for c in chem["classes"] if c["name"] == "11")
        sbc = next(ch for ch in c11["chapters"] if ch["name"] == "Some Basic Concepts of Chemistry")
        assert sbc["count"] == 2 and sbc["approved"] == 2
        # NCERT order: Some Basic Concepts before Equilibrium
        names = [ch["name"] for ch in c11["chapters"]]
        assert names.index("Some Basic Concepts of Chemistry") < names.index("Equilibrium")

        # class / topic filters on the page endpoint
        r = await client.get("/api/questions/page", params={"subject": "Chemistry", "student_class": "11",
                                                            "chapter": "Some Basic Concepts of Chemistry"})
        assert r.json()["total"] == 2

        # bulk update by filter ("select all matching")
        r = await client.post("/api/questions/bulk-update", json={
            "filter": {"subject": "Physics", "chapter": "__none__"}, "patch": {"student_class": "class 11"}})
        assert r.status_code == 200 and r.json()["requested"] == 1
        assert (await server.db.questions.find_one({"id": "q5"}))["student_class"] == "11"

        # random pick by class + topic
        r = await client.post("/api/tests/random", json={"subjects": ["Physics"], "classes": ["11"],
                                                         "topics": ["Friction"], "count": 5})
        assert r.status_code == 200 and r.json()["question_ids"] == ["q4"]
    asyncio.run(run())


def test_commit_normalises_labels(app_client):
    server, client = app_client

    async def run():
        r = await client.post("/api/import/commit", json={"questions": [
            {"subject": "", "chapter": "Chemical Equilibrium", "student_class": "",
             "text": "Kc for the reaction is?", "options": ["1", "2", "3", "4"], "correct": ["B"]},
        ]})
        assert r.json()["inserted"] == 1
        d = await server.db.questions.find_one({}, {"_id": 0})
        # subject defaulted to Physics, then repaired from the chapter
        assert (d["subject"], d["student_class"], d["chapter"], d["topic"]) == \
               ("Chemistry", "11", "Equilibrium", "Chemical Equilibrium")
    asyncio.run(run())


def test_auto_tag_job_with_mocked_ai(app_client, monkeypatch):
    server, client = app_client
    import auto_tagger

    async def fake_ai(system, text, file_paths=None, max_tokens=8192):
        items = json.loads(text)
        out = []
        for it in items:
            if "friction" in it["text"].lower():
                out.append({"index": it["index"], "subject": "Physics", "class": "11",
                            "chapter": "Laws of Motion", "topic": "Friction", "confident": True})
            else:
                out.append({"index": it["index"], "subject": "Chemistry", "class": "11",
                            "chapter": "Some Basic Concepts of Chemistry", "topic": "Mole Concept",
                            "confident": True})
        return json.dumps(out)
    monkeypatch.setattr(auto_tagger, "ai_complete", fake_ai)
    monkeypatch.setattr(server, "ai_full", lambda: {"key": "test-key"})

    async def run():
        await server.db.questions.insert_many([
            _q(1, subject="Chemistry", text="How many moles in 18 g water?"),
            _q(2, subject="Chemistry", text="Find the friction force on the block."),   # wrong subject
            _q(3, subject="Physics", chapter="Laws of Motion", topic="Friction", student_class="11"),
        ])
        r = await client.post("/api/questions/auto-tag/start", json={})
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["count"] == 2
        for _ in range(200):
            j = (await client.get(f"/api/import/jobs/{job['job_id']}")).json()
            if j["status"] in ("done", "error"):
                break
            await asyncio.sleep(0.02)
        assert j["status"] == "done", j
        assert j["result"]["tagged"] == 2
        q1 = await server.db.questions.find_one({"id": "q1"}, {"_id": 0})
        assert (q1["student_class"], q1["chapter"], q1["topic"]) == ("11", "Some Basic Concepts of Chemistry", "Mole Concept")
        q2 = await server.db.questions.find_one({"id": "q2"}, {"_id": 0})
        assert (q2["subject"], q2["chapter"], q2["topic"]) == ("Physics", "Laws of Motion", "Friction")
        # nothing left to tag
        r = await client.post("/api/questions/auto-tag/start", json={})
        assert r.json()["count"] == 0
    asyncio.run(run())


def test_paging_is_stable_and_variants_merge(app_client):
    server, client = app_client

    async def run():
        # bulk imports give many questions the same created_at: pages must not overlap or skip
        await server.db.questions.insert_many([
            _q(i, subject="Physics", chapter="Kinematics" if i % 3 else "kinematics",
               topic="relative velocity" if i % 2 else "Relative Velocity", created_at="2026-10-01T00:00:00")
            for i in range(1, 121)])
        seen = []
        for p in (1, 2, 3):
            r = await client.get("/api/questions/page", params={"page": p, "page_size": 50})
            items = r.json()["items"]
            assert len(items) == (50 if p < 3 else 20)
            seen += [x["id"] for x in items]
        assert len(set(seen)) == 120

        await client.post("/api/questions/normalize-taxonomy", json={})
        assert set(await server.db.questions.distinct("chapter")) == {"Kinematics"}
        assert set(await server.db.questions.distinct("topic")) == {"Relative Velocity"}
    asyncio.run(run())
