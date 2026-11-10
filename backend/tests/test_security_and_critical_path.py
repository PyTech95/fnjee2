"""Security (answer-key leak) + role-enforcement + critical-path E2E tests."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@examnest.io", "password": "Admin@123", "role": "admin"}
STUDENT = {"email": "student1@examnest.io", "password": "Student@123", "role": "student"}
STUDENT2 = {"email": "student2@examnest.io", "password": "Student@123", "role": "student"}
PARENT = {"email": "parent1@examnest.io", "password": "Parent@123", "role": "parent"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed {creds['email']}: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def student_token():
    return _login(STUDENT)


@pytest.fixture(scope="module")
def student2_token():
    return _login(STUDENT2)


@pytest.fixture(scope="module")
def parent_token():
    return _login(PARENT)


# ---------- AUTH ----------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_student_login(self, student_token):
        assert isinstance(student_token, str) and len(student_token) > 20

    def test_parent_login(self, parent_token):
        assert isinstance(parent_token, str) and len(parent_token) > 20

    def test_wrong_role_tab_never_escalates(self):
        # the role tab is only a hint: student credentials on the Admin tab sign in as the *student*, never admin
        r = requests.post(f"{API}/auth/login",
                          json={"email": STUDENT["email"], "password": STUDENT["password"], "role": "admin"},
                          timeout=30)
        assert r.status_code == 200, r.text[:200]
        assert r.json()["user"]["role"] == "student"

    def test_wrong_password_rejected(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": STUDENT["email"], "password": "wrong", "role": "student"},
                          timeout=30)
        assert r.status_code == 401


# ---------- SECURITY: answer-key leak ----------
class TestAnswerKeyLeakFix1:
    """GET /api/questions is admin-only."""

    def test_student_blocked(self, student_token):
        r = requests.get(f"{API}/questions", headers=_h(student_token), timeout=30)
        assert r.status_code == 403, f"Expected 403 for student on /questions, got {r.status_code}"

    def test_parent_blocked(self, parent_token):
        r = requests.get(f"{API}/questions", headers=_h(parent_token), timeout=30)
        assert r.status_code == 403

    def test_admin_allowed(self, admin_token):
        r = requests.get(f"{API}/questions", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Admin should still see 'correct' field on questions
        if data:
            assert "correct" in data[0], "Admin listing must include 'correct' field"


class TestAnswerKeyLeakFix2:
    """GET /api/tests/{id}?include_questions=true must strip 'correct' + 'explanation' for
    students who have not submitted; admin must still see 'correct'."""

    @pytest.fixture(scope="class")
    def fresh_test_id(self, admin_token):
        # Create a fresh question + test so we're guaranteed no student has a submitted attempt
        qp = {"type": "mcq_single", "subject": "Physics", "chapter": "TEST", "topic": "TEST",
              "difficulty": "easy", "marks": 4, "negative_marks": 1,
              "text": "TEST_leak_probe What is 1+1?", "options": ["1", "2", "3"],
              "correct": ["2"], "explanation": "TEST_secret_explanation",
              "status": "approved"}
        rq = requests.post(f"{API}/questions", headers=_h(admin_token), json=qp, timeout=30)
        assert rq.status_code == 200, rq.text[:200]
        qid = rq.json()["id"]
        tp = {"title": "TEST_leak_probe_test", "subjects": ["Physics"],
              "duration_minutes": 30, "question_ids": [qid], "show_solutions_after": True}
        rt = requests.post(f"{API}/tests", headers=_h(admin_token), json=tp, timeout=30)
        assert rt.status_code == 200, rt.text[:200]
        tid = rt.json()["id"]
        yield tid
        # cleanup
        requests.delete(f"{API}/tests/{tid}", headers=_h(admin_token), timeout=30)
        requests.delete(f"{API}/questions/{qid}", headers=_h(admin_token), timeout=30)

    def test_admin_sees_correct(self, admin_token, fresh_test_id):
        r = requests.get(f"{API}/tests/{fresh_test_id}?include_questions=true",
                         headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        qs = r.json().get("questions", [])
        assert qs, "Admin got no questions"
        assert all("correct" in q for q in qs), "Admin must receive 'correct' field"

    def test_student_pre_submit_no_correct_no_explanation(self, student2_token, fresh_test_id):
        r = requests.get(f"{API}/tests/{fresh_test_id}?include_questions=true",
                         headers=_h(student2_token), timeout=30)
        assert r.status_code == 200
        qs = r.json().get("questions", [])
        assert qs, "Student got no questions"
        for q in qs:
            assert "correct" not in q, f"LEAK: 'correct' present pre-submit: {q.get('id')}"
            assert "explanation" not in q, f"LEAK: 'explanation' present pre-submit: {q.get('id')}"


# ---------- CRITICAL PATH E2E (student) ----------
class TestStudentCriticalPath:

    def test_student_full_flow(self, student_token, admin_token):
        # list tests as student
        r = requests.get(f"{API}/tests", headers=_h(student_token), timeout=30)
        assert r.status_code == 200
        tests = [t for t in r.json() if t.get("question_ids")]
        assert tests, "Student sees no tests with questions"
        test = tests[0]
        tid = test["id"]

        # start attempt
        r = requests.post(f"{API}/attempts/start", headers=_h(student_token),
                          json={"test_id": tid}, timeout=30)
        assert r.status_code == 200, f"start failed {r.status_code} {r.text[:200]}"
        attempt = r.json()
        aid = attempt["id"]
        assert "ends_at" in attempt and "started_at" in attempt

        # fetch questions via test include_questions (student sees no 'correct')
        r = requests.get(f"{API}/tests/{tid}?include_questions=true",
                         headers=_h(student_token), timeout=30)
        assert r.status_code == 200
        qs = r.json()["questions"]
        for q in qs:
            assert "correct" not in q

        # pick some answers: first option for each mcq
        answers = []
        for q in qs[:5]:
            if q.get("options"):
                answers.append({"question_id": q["id"], "answer": [q["options"][0]]})

        # submit
        r = requests.post(f"{API}/attempts/submit", headers=_h(student_token),
                          json={"attempt_id": aid, "answers": answers}, timeout=60)
        assert r.status_code == 200, f"submit failed {r.status_code} {r.text[:300]}"
        result = r.json()
        assert result["status"] == "submitted"
        assert "score" in result and "correct" in result and "wrong" in result and "unattempted" in result
        assert "detailed" in result and isinstance(result["detailed"], list)
        # server-computed time-limit fields
        assert "time_taken_seconds" in result, "time_taken_seconds missing"
        assert result["time_taken_seconds"] is not None
        assert "late_submission" in result, "late_submission missing"
        assert isinstance(result["late_submission"], bool)

        # fetch attempt again
        r = requests.get(f"{API}/attempts/{aid}", headers=_h(student_token), timeout=30)
        assert r.status_code == 200
        got = r.json()
        assert got["id"] == aid
        assert got["score"] == result["score"]
        assert got["status"] == "submitted"

        # Post-submission review: explanation may now appear, but 'correct' must still be hidden
        r = requests.get(f"{API}/tests/{tid}?include_questions=true",
                         headers=_h(student_token), timeout=30)
        assert r.status_code == 200
        qs2 = r.json()["questions"]
        for q in qs2:
            assert "correct" not in q, "LEAK: 'correct' visible post-submit to student"
        # At least one question in seed should have a non-empty explanation and it should be revealed
        # (only assert reveal happens; not that every question has one)
        # We only warn if none reveal:
        revealed = any("explanation" in q for q in qs2)
        assert revealed, "explanation should be revealed after submit (show_solutions_after=True)"


# ---------- RBAC enforcement ----------
class TestRBAC:
    def test_student_cannot_create_question(self, student_token):
        payload = {"type": "mcq_single", "subject": "Physics", "text": "TEST_forbidden",
                   "options": ["a", "b"], "correct": ["a"]}
        r = requests.post(f"{API}/questions", headers=_h(student_token), json=payload, timeout=30)
        assert r.status_code == 403

    def test_student_cannot_delete_test(self, student_token, admin_token):
        r = requests.get(f"{API}/tests", headers=_h(admin_token), timeout=30)
        tid = r.json()[0]["id"]
        r = requests.delete(f"{API}/tests/{tid}", headers=_h(student_token), timeout=30)
        assert r.status_code == 403

    def test_student_attempts_scoped_to_self(self, student_token, student2_token):
        # student1's list must only show own attempts
        r = requests.get(f"{API}/attempts", headers=_h(student_token), timeout=30)
        assert r.status_code == 200
        a1 = r.json()
        # get student1's id
        me1 = requests.get(f"{API}/auth/me", headers=_h(student_token), timeout=30).json()
        for a in a1:
            assert a["user_id"] == me1["id"], "Student sees other users' attempts!"

        # even passing user_id override should be ignored for students
        r = requests.get(f"{API}/attempts?user_id=someone_else", headers=_h(student_token), timeout=30)
        assert r.status_code == 200
        for a in r.json():
            assert a["user_id"] == me1["id"]


# ---------- ADMIN CRITICAL PATH ----------
class TestAdminCriticalPath:
    _created = {"qid": None, "tid": None}

    def test_admin_create_question_and_test(self, admin_token):
        qpayload = {"type": "mcq_single", "subject": "Physics", "chapter": "Test",
                    "topic": "TEST", "difficulty": "easy", "marks": 4, "negative_marks": 1,
                    "text": "TEST_qa 2+2=?", "options": ["3", "4", "5", "6"],
                    "correct": ["4"], "explanation": "basic", "status": "approved"}
        r = requests.post(f"{API}/questions", headers=_h(admin_token), json=qpayload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        q = r.json()
        assert q["text"] == qpayload["text"]
        assert q["correct"] == ["4"]
        self._created["qid"] = q["id"]

        tpayload = {"title": "TEST_admin_flow", "exam_type": "full_mock",
                    "subjects": ["Physics"], "duration_minutes": 30,
                    "question_ids": [q["id"]]}
        r = requests.post(f"{API}/tests", headers=_h(admin_token), json=tpayload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        t = r.json()
        assert t["title"] == "TEST_admin_flow"
        assert q["id"] in t["question_ids"]
        self._created["tid"] = t["id"]

        # confirm listed
        r = requests.get(f"{API}/tests", headers=_h(admin_token), timeout=30)
        ids = [x["id"] for x in r.json()]
        assert t["id"] in ids

    def test_zz_cleanup(self, admin_token):
        # cleanup created test & question (runs after alphabetical order)
        tid = self._created.get("tid")
        qid = self._created.get("qid")
        if tid:
            requests.delete(f"{API}/tests/{tid}", headers=_h(admin_token), timeout=30)
        if qid:
            requests.delete(f"{API}/questions/{qid}", headers=_h(admin_token), timeout=30)
