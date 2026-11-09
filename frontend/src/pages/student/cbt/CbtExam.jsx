import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { cbtApi } from "@/lib/cbtApi";
import { useAuth } from "@/contexts/AuthContext";
import MathText from "@/components/MathText";
import { CbtQuestionView } from "@/components/exam/CbtQuestionView";
import { PaletteCell, PaletteLegend } from "@/components/exam/CbtPalette";
import { isFinalNumericValue } from "@/lib/numericValidation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Clock, FileText, Info, ListChecks, User2, Loader2, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const draftKey = (aid) => `cbt_draft_${aid}`;
const visitedKey = (aid) => `cbt_visited_${aid}`;

// Exam banner follows the paper's content (a Biology drill must not say "JEE Advanced").
export function examFamily(exam) {
  const title = String(exam?.exam?.title || "");
  const subs = (exam?.subjects || []).map((s) => String(s.name || s.id || "").toLowerCase());
  const t = title.toLowerCase();
  if (/\bneet\b/.test(t) || subs.some((s) => s.startsWith("bio") || s === "botany" || s === "zoology"))
    return { badge: "NEET", hi: "राष्ट्रीय पात्रता सह प्रवेश परीक्षा (स्नातक)", en: "National Eligibility cum Entrance Test (UG)" };
  if (/jee\s*adv/.test(t))
    return { badge: "JEE", hi: "संयुक्त प्रवेश परीक्षा (उच्च)", en: "Joint Entrance Examination (Advanced)" };
  if (/\bjee\b/.test(t) || subs.some((s) => s.startsWith("math")))
    return { badge: "JEE", hi: "संयुक्त प्रवेश परीक्षा (मुख्य)", en: "Joint Entrance Examination (Main)" };
  if (/olympiad/.test(t)) return { badge: "OLY", hi: "ओलंपियाड", en: "Olympiad Practice Test" };
  return { badge: "CBT", hi: "कंप्यूटर आधारित परीक्षा", en: "Computer Based Test" };
}

function fmtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function CbtExam() {
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const retake = searchParams.get("retake") === "1";
  const nav = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState("loading"); // loading | instructions | exam | error
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [lang, setLang] = useState("en");
  const [agree, setAgree] = useState(false);
  const [starting, setStarting] = useState(false);

  const [saved, setSaved] = useState({});     // qid -> server-confirmed state
  const [draft, setDraft] = useState({});      // qid -> { answer:[], marked:bool }  (UI only)
  const [visited, setVisited] = useState({}); // qid -> true
  const [currentQid, setCurrentQid] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | failed

  const [showInstructions, setShowInstructions] = useState(false);
  const [showPaper, setShowPaper] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [summary, setSummary] = useState(null);

  const seqRef = useRef({});          // qid -> last seq sent
  const inflightRef = useRef({});     // qid -> latest inflight seq
  const submittedRef = useRef(false);
  const endsRef = useRef(0);

  /* ---------------- load exam + attempt ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ex, at] = await Promise.all([cbtApi.getExam(testId), cbtApi.start(testId, retake)]);
        if (cancelled) return;
        setExam(ex);
        setAttempt(at);
        if (at.status === "submitted" && at.result_id) {
          nav(`/student/results/${at.result_id}`, { replace: true });
          return;
        }
        const st = await cbtApi.state(at.id);
        if (cancelled) return;
        setSaved(st.responses || {});
        setLang(st.attempt?.language === "hi" ? "hi" : "en");
        endsRef.current = new Date(st.attempt.ends_at).getTime();
        setRemaining(Math.max(0, st.remaining_seconds || 0));
        // restore local draft + visited
        try {
          const d = JSON.parse(localStorage.getItem(draftKey(at.id)) || "{}");
          setDraft(d || {});
        } catch { /* ignore */ }
        try {
          const vIds = JSON.parse(localStorage.getItem(visitedKey(at.id)) || "[]");
          const vObj = {};
          (vIds || []).forEach((q) => (vObj[q] = true));
          Object.keys(st.responses || {}).forEach((q) => (vObj[q] = true));
          setVisited(vObj);
        } catch { /* ignore */ }
        setCurrentQid((ex.order || [])[0] || null);
        setPhase("instructions");
      } catch (e) {
        if (!cancelled) {
          toast.error("Could not load the exam.");
          setPhase("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [testId, nav, retake]);

  /* ---------------- persist draft + visited locally ---------------- */
  useEffect(() => {
    if (!attempt) return;
    try { localStorage.setItem(draftKey(attempt.id), JSON.stringify(draft)); } catch { /* ignore */ }
  }, [draft, attempt]);
  useEffect(() => {
    if (!attempt) return;
    try { localStorage.setItem(visitedKey(attempt.id), JSON.stringify(Object.keys(visited))); } catch { /* ignore */ }
  }, [visited, attempt]);

  /* ---------------- server-authoritative timer ---------------- */
  useEffect(() => {
    if (phase !== "exam") return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        cbtApi.expire(attempt.id)
          .then((r) => nav(`/student/results/${r.result_id}`, { replace: true }))
          .catch(() => nav(`/student/tests`, { replace: true }));
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [phase, attempt, nav]);

  const questions = exam?.questions || {};
  const order = exam?.order || [];
  const q = currentQid ? questions[currentQid] : null;

  /* ---------------- init draft from saved when opening a question ---------------- */
  useEffect(() => {
    if (!currentQid) return;
    setVisited((prev) => (prev[currentQid] ? prev : { ...prev, [currentQid]: true }));
    setDraft((prev) => {
      if (prev[currentQid]) return prev; // keep existing draft (do not reset)
      const s = saved[currentQid];
      return { ...prev, [currentQid]: { answer: s?.saved_answer || [], marked: s?.marked_for_review || false } };
    });
    // eslint-disable-next-line
  }, [currentQid]);

  /* ---------------- status derivation ---------------- */
  const statusFor = useCallback((qid) => {
    const s = saved[qid];
    if (s?.is_answered && s?.marked_for_review) return "answered-marked";
    if (s?.is_answered) return "answered";
    if (s?.marked_for_review) return "marked";
    if (s?.visited || visited[qid]) return "not-answered";
    return "not-visited";
  }, [saved, visited]);

  const counts = useMemo(() => {
    const c = { "answered": 0, "not-answered": 0, "not-visited": 0, "marked": 0, "answered-marked": 0 };
    order.forEach((qid) => { c[statusFor(qid)] += 1; });
    return c;
  }, [order, statusFor]);

  /* ---------------- subject / section structure ---------------- */
  const subjects = exam?.subjects || [];
  const currentSubject = q ? subjects.find((s) => s.id === q.subject) : subjects[0];
  const subjectQids = useMemo(
    () => order.filter((qid) => questions[qid]?.subject === currentSubject?.id),
    [order, questions, currentSubject]
  );
  const currentSection = useMemo(
    () => currentSubject?.sections?.find((s) => s.id === q?.section_id) || null,
    [currentSubject, q]
  );
  const allSections = useMemo(
    () => subjects.flatMap((s) => (s.sections || []).map((sec) => ({ ...sec, subjectName: s.name }))),
    [subjects]
  );

  const gotoFirstOfSubject = (subjId) => {
    const first = order.find((qid) => questions[qid]?.subject === subjId);
    if (first) setCurrentQid(first);
  };
  const gotoFirstOfSection = (sectionId) => {
    const first = order.find((qid) => questions[qid]?.section_id === sectionId);
    if (first) setCurrentQid(first);
  };

  /* ---------------- draft setters (no save) ---------------- */
  const setDraftAnswer = (arr) => setDraft((p) => ({ ...p, [currentQid]: { ...(p[currentQid] || { marked: false }), answer: arr } }));
  const clearResponse = () => setDraft((p) => ({ ...p, [currentQid]: { ...(p[currentQid] || {}), answer: [] } }));

  /* ---------------- commit (save & next / mark & next) ---------------- */
  const commit = async ({ marked, advance = true }) => {
    if (!q) return;
    const qid = currentQid;
    let answer = draft[qid]?.answer || [];
    // numerical: only save a final, valid number
    if (q.type === "numerical") {
      const val = answer[0] || "";
      answer = isFinalNumericValue(val) ? [String(val)] : [];
    }
    const seq = (seqRef.current[qid] || 0) + 1;
    seqRef.current[qid] = seq;
    inflightRef.current[qid] = seq;
    setSaveState("saving");
    try {
      const res = await cbtApi.saveResponse(attempt.id, {
        question_id: qid, answer, marked_for_review: marked, visited: true, action: "save", seq,
      });
      // ignore stale responses (a newer request is in flight)
      if (inflightRef.current[qid] && seq < inflightRef.current[qid]) return;
      if (!res.stale) {
        setSaved((prev) => ({
          ...prev,
          [qid]: { saved_answer: answer, marked_for_review: marked, visited: true, is_answered: res.is_answered, version: res.version, seq },
        }));
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
      if (advance) {
        const idx = order.indexOf(qid);
        if (idx < order.length - 1) setCurrentQid(order[idx + 1]);
      }
    } catch (e) {
      setSaveState("failed");
      const msg = e?.response?.data?.detail || "Save failed — your response was not saved.";
      toast.error(msg);
    }
  };

  /* ---------------- submit flow ---------------- */
  const openSummary = async () => {
    try {
      const s = await cbtApi.summary(attempt.id);
      setSummary(s);
      setShowSummary(true);
    } catch { toast.error("Could not load summary."); }
  };
  const doSubmit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    try {
      const r = await cbtApi.submit(attempt.id);
      try { localStorage.removeItem(draftKey(attempt.id)); localStorage.removeItem(visitedKey(attempt.id)); } catch { /* ignore */ }
      nav(`/student/results/${r.result_id}`, { replace: true });
    } catch {
      submittedRef.current = false;
      toast.error("Submission failed. Please try again.");
    }
  };

  const changeLanguage = async (next) => {
    setLang(next);
    try { await cbtApi.setLanguage(attempt.id, next); } catch { /* non-blocking */ }
  };

  /* ================= RENDER ================= */
  if (phase === "loading") return <div data-testid="cbt-loading" className="min-h-screen grid place-items-center text-slate-500">Loading examination…</div>;
  if (phase === "error") return (
    <div data-testid="cbt-error" className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <p className="text-slate-700 font-semibold">This exam could not be loaded.</p>
        <Button className="mt-4" data-testid="cbt-back-tests" onClick={() => nav("/student/tests")}>Back to tests</Button>
      </div>
    </div>
  );

  if (phase === "instructions") {
    return (
      <PreExam
        exam={exam} user={user} lang={lang} setLang={setLang}
        agree={agree} setAgree={setAgree} starting={starting}
        subjects={subjects}
        onStart={async () => {
          if (!agree || starting) return;
          setStarting(true);
          try {
            await changeLanguage(lang);
            setPhase("exam");
          } finally { setStarting(false); }
        }}
      />
    );
  }

  // ------- EXAM -------
  if (!q) return <div className="min-h-screen grid place-items-center text-slate-500">No questions in this exam.</div>;
  const draftAns = draft[currentQid]?.answer || [];
  const timeCritical = remaining > 0 && remaining < 300;
  const fam = examFamily(exam);

  return (
    <div data-testid="cbt-exam-page" className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* ---------- TRICOLOR EXAM BANNER ---------- */}
      <div className="bg-white">
        <div className="flex items-center gap-3 px-3 sm:px-5 py-2">
          <div className="h-11 w-11 rounded bg-gradient-to-br from-[#ff9933] via-white to-[#138808] grid place-items-center shrink-0 border border-slate-200">
            <span className="font-display font-extrabold text-[#0b3d6b] text-xs leading-none">{fam.badge}</span>
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[10px] sm:text-[11px] text-slate-500 truncate">{fam.hi} · {fam.en}</div>
            <div className="font-display font-bold text-[#0b3d6b] text-sm sm:text-base truncate">FNJEE Computer Based Test</div>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <img data-testid="cbt-banner-avatar" src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || "Student"}`}
              alt="candidate" className="h-10 w-10 rounded border border-slate-200 bg-slate-100 object-cover" />
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-[9px] uppercase tracking-widest text-slate-400">Candidate</div>
              <div className="font-semibold text-sm text-[#0b3d6b]">{user?.name || "Student"}</div>
            </div>
          </div>
        </div>
        <div className="h-1.5 w-full bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" />
      </div>

      {/* ---------- DARK NAV BAR ---------- */}
      <header className="bg-[#1f2a37] text-white">
        <div className="px-3 sm:px-4 h-11 flex items-center gap-3">
          <span className="font-semibold text-sm text-[#f4c430] truncate" data-testid="cbt-exam-title">{exam.exam.title}</span>
          <div className="flex-1" />
          <button data-testid="cbt-open-instructions" onClick={() => setShowInstructions(true)}
            className="inline-flex items-center gap-1.5 text-sm hover:text-[#5bc0de] transition-colors">
            <Info className="h-4 w-4" /> <span className="hidden sm:inline">Instructions</span>
          </button>
          <button data-testid="cbt-open-paper" onClick={() => setShowPaper(true)}
            className="inline-flex items-center gap-1.5 text-sm text-[#7ee0a1] hover:text-[#a7f3c4] transition-colors">
            <ListChecks className="h-4 w-4" /> <span className="hidden sm:inline">Question Paper</span>
          </button>
        </div>
      </header>

      {/* ---------- TITLE TAG + TIMER ---------- */}
      <div className="bg-[#eaf6fb] border-b border-[#bfe3ef] px-3 sm:px-4 py-2 flex items-center gap-3">
        <span className="inline-flex items-center gap-2 bg-[#2f90b5] text-white text-sm font-medium rounded px-3 py-1.5 shadow-sm">
          <FileText className="h-4 w-4" /> {exam.exam.title}
        </span>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center rounded overflow-hidden border border-[#2f90b5] text-xs">
            <button data-testid="cbt-lang-en" onClick={() => changeLanguage("en")} className={`px-2.5 py-1 ${lang === "en" ? "bg-[#2f90b5] text-white font-semibold" : "bg-white text-[#2f90b5]"}`}>English</button>
            <button data-testid="cbt-lang-hi" onClick={() => changeLanguage("hi")} className={`px-2.5 py-1 ${lang === "hi" ? "bg-[#2f90b5] text-white font-semibold" : "bg-white text-[#2f90b5]"}`}>हिंदी</button>
          </div>
          <div data-testid="cbt-timer" className={`flex items-center gap-2 rounded px-3 py-1.5 font-mono font-bold tabular-nums text-sm ${timeCritical ? "bg-red-600 text-white animate-pulse" : "bg-white text-[#0b3d6b] border border-[#bfe3ef]"}`}>
            <Clock className="h-4 w-4" /> Time Left : {fmtTime(remaining)}
          </div>
        </div>
      </div>

      {/* ---------- SECTION TABS ---------- */}
      <div className="bg-white border-b border-slate-200 px-2 sm:px-3 pt-2">
        <div className="text-[11px] font-semibold text-slate-500 px-1 mb-1">Sections</div>
        <div className="flex items-end gap-1 overflow-x-auto pb-px" data-testid="cbt-section-tabs">
          {allSections.map((sec) => {
            const active = q?.section_id === sec.id;
            return (
              <button key={sec.id} data-testid={`cbt-sectiontab-${sec.id}`} onClick={() => gotoFirstOfSection(sec.id)}
                className={`relative whitespace-nowrap px-4 py-2 text-sm rounded-t-lg border border-b-0 inline-flex items-center gap-1.5 transition-colors ${
                  active ? "bg-[#2f90b5] text-white border-[#2f90b5] font-semibold" : "bg-[#d4ecf5] text-[#0b3d6b] border-[#bfe3ef] hover:bg-[#c3e4f0]"
                }`}>
                {sec.name}
                <Info className={`h-3.5 w-3.5 ${active ? "text-white/80" : "text-[#2f90b5]"}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- BODY ---------- */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* MAIN LEFT */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="bg-[#f2f7fa] border-b border-slate-200 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-700">Question Type: <b className="text-slate-900" data-testid="cbt-qtype">{q.type === "scm" ? "MCQ" : q.type === "msq" ? "MSQ (Multiple Correct)" : "Numerical"}</b></span>
            <span className="ml-auto inline-flex items-center gap-4 text-xs sm:text-sm">
              <span className="text-slate-700">Marks for correct answer: <b className="text-green-700">+{q.marks}</b></span>
              <span className="text-slate-700">Negative Marks: <b className="text-red-600">{q.negative_marks}</b></span>
            </span>
          </div>
          <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3">
            <span className="font-display font-bold text-[#0b3d6b]" data-testid="cbt-qnum">Question No. {q.question_number}</span>
            <motion.span animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}
              className="h-6 w-6 rounded-full bg-[#2f90b5] text-white grid place-items-center">
              <ChevronDown className="h-4 w-4" />
            </motion.span>
            <span className="ml-auto text-xs text-slate-500">{q.section_name}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-3xl">
              {currentSection?.instructions && (
                <motion.details
                  key={`instr-${currentSection.id}`}
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                  open
                  data-testid="cbt-section-instructions"
                  className="mb-5 rounded-lg border border-blue-200 bg-blue-50/70 overflow-hidden">
                  <summary className="cursor-pointer select-none px-4 py-2.5 bg-blue-100/70 text-[#0b2e59] font-semibold text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" /> {currentSection.name} — Section Instructions
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </summary>
                  <pre className="px-4 py-3 text-xs sm:text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap font-sans">{currentSection.instructions}</pre>
                </motion.details>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQid}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  <CbtQuestionView
                    question={q}
                    lang={lang}
                    value={draftAns}
                    onChange={setDraftAnswer}
                    readOnly={false}
                    showMeta={false}
                    testIdPrefix="cbt"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* BOTTOM NAV (always visible) */}
          <div className="bg-white border-t-2 border-slate-200 px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 sticky bottom-0">
            <Button data-testid="cbt-mark-next" variant="outline" className="rounded border-[#2f90b5] text-[#0b3d6b] hover:bg-[#eaf6fb] font-medium"
              onClick={() => commit({ marked: true })}>
              Mark for Review &amp; Next
            </Button>
            <Button data-testid="cbt-clear" variant="outline" className="rounded border-slate-300 text-slate-700 hover:bg-slate-50" onClick={clearResponse}>
              Clear Response
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <SaveIndicator state={saveState} />
              <Button data-testid="cbt-save-next" className="rounded bg-[#17a2b8] hover:bg-[#138496] text-white font-semibold px-6"
                onClick={() => commit({ marked: false })}>
                Save &amp; Next
              </Button>
              <Button data-testid="cbt-submit" className="rounded bg-[#0b3d6b] hover:bg-[#09325a] text-white font-semibold px-6" onClick={openSummary}>
                Submit
              </Button>
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="lg:w-80 shrink-0 bg-white border-l border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex flex-col items-center gap-2 bg-[#f7fafc]">
            <img data-testid="cbt-candidate-avatar" src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || "Student"}`}
              alt="candidate" className="h-20 w-20 rounded-md border border-slate-300 bg-white object-cover" />
            <div className="text-center leading-tight">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 flex items-center justify-center gap-1"><User2 className="h-3 w-3" /> Candidate</div>
              <div className="font-semibold text-sm text-[#0b3d6b]" data-testid="cbt-candidate-name">{user?.name || "Student"}</div>
            </div>
          </div>

          <div className="p-3 border-b border-slate-200">
            <PaletteLegend counts={counts} />
          </div>

          <div className="bg-[#2f90b5] text-white px-3 py-2 font-semibold text-sm" data-testid="cbt-palette-section-header">
            {currentSection?.name || currentSubject?.name}
          </div>
          <div className="px-3 py-2 text-sm font-medium text-slate-600 border-b border-slate-200">Choose a Question</div>
          <div className="p-3 flex-1 overflow-y-auto bg-[#eef6fa]">
            <div className="grid grid-cols-5 gap-2.5" data-testid="cbt-palette">
              {(currentSection?.question_ids || subjectQids).map((qid) => (
                <PaletteCell
                  key={qid}
                  number={questions[qid].question_number}
                  status={statusFor(qid)}
                  active={qid === currentQid}
                  onClick={() => setCurrentQid(qid)}
                  testid={`cbt-palette-${questions[qid].question_number}`}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ---------- Instructions modal ---------- */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Instructions</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">Examination instructions and question palette legend</DialogDescription>
          <InstructionsBody exam={exam} lang={lang} />
        </DialogContent>
      </Dialog>

      {/* ---------- Question Paper modal (view-only) ---------- */}
      <Dialog open={showPaper} onOpenChange={setShowPaper}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Question Paper</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">View-only question paper grouped by subject and section</DialogDescription>
          <div data-testid="cbt-paper-body" className="space-y-6">
            {subjects.map((s) => (
              <div key={s.id}>
                <h3 className="font-bold text-[#0b2e59] border-b border-slate-200 pb-1 mb-2">{s.name}</h3>
                {s.sections.map((sec) => (
                  <div key={sec.id} className="mb-4">
                    <div className="text-sm font-semibold text-slate-500 mb-2">{sec.name}</div>
                    <ol className="space-y-4">
                      {sec.question_ids.map((qid) => {
                        const qq = questions[qid];
                        return (
                          <li key={qid} className="text-sm">
                            <div className="flex gap-2">
                              <span className="font-semibold text-slate-700">Q{qq.question_number}.</span>
                              <div className="flex-1">
                                <MathText>{lang === "hi" ? qq.hi.text : qq.en.text}</MathText>
                                {qq.options?.length > 0 && (
                                  <ol className="mt-1 ml-1 space-y-0.5 text-slate-600">
                                    {qq.options.map((o, i) => (
                                      <li key={o.id}>{LETTERS[i]}. <MathText>{lang === "hi" ? o.hi : o.en}</MathText></li>
                                    ))}
                                  </ol>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Submit summary ---------- */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Submission Summary</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">Summary of answered, not answered, not visited and marked questions</DialogDescription>
          {summary && (
            <div data-testid="cbt-summary" className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <Stat label="Total" value={summary.totals.total} />
                <Stat label="Answered" value={summary.totals.answered} cls="text-green-700" />
                <Stat label="Not Answered" value={summary.totals.not_answered} cls="text-orange-600" />
                <Stat label="Not Visited" value={summary.totals.not_visited} cls="text-slate-500" />
                <Stat label="Marked" value={summary.totals.marked} cls="text-purple-700" />
                <Stat label="Ans. & Marked" value={summary.totals.answered_marked} cls="text-purple-700" />
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="text-xs font-semibold text-slate-500 mb-2">By subject</div>
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-500 text-xs"><th className="text-left">Subject</th><th>Ans</th><th>Not</th><th>Marked</th></tr></thead>
                  <tbody>
                    {Object.entries(summary.by_subject).map(([name, s]) => (
                      <tr key={name} className="border-t border-slate-100">
                        <td className="py-1 text-left">{name}</td>
                        <td className="text-center text-green-700">{s.answered}</td>
                        <td className="text-center text-orange-600">{s.not_answered}</td>
                        <td className="text-center text-purple-700">{s.marked + s.answered_marked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button data-testid="cbt-return-exam" variant="outline" onClick={() => setShowSummary(false)}>Return to Exam</Button>
            <Button data-testid="cbt-confirm-open" className="bg-[#0b2e59] hover:bg-[#09254a]" onClick={() => { setShowSummary(false); setShowConfirm(true); }}>Submit Exam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Final confirm ---------- */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Are you sure you want to submit the examination?</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">Final confirmation before submitting the examination</DialogDescription>
          <p className="text-sm text-slate-600">Once submitted, you cannot change your responses.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>No, go back</Button>
            <Button data-testid="cbt-confirm-submit" className="bg-green-600 hover:bg-green-700" onClick={doSubmit}>Yes, Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================= sub-components ================= */
function SaveIndicator({ state }) {
  if (state === "saving") return <span data-testid="cbt-save-state" className="text-xs text-slate-500 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>;
  if (state === "saved") return <span data-testid="cbt-save-state" className="text-xs text-green-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</span>;
  if (state === "failed") return <span data-testid="cbt-save-state" className="text-xs text-red-600 inline-flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Save Failed</span>;
  return null;
}

function Stat({ label, value, cls = "text-slate-800" }) {
  return (
    <div className="rounded border border-slate-200 p-2">
      <div className={`text-xl font-bold ${cls}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function InstructionsBody({ exam, lang }) {
  const custom = lang === "hi" ? exam.exam.instructions_hi : exam.exam.instructions_en;
  return (
    <div className="text-sm text-slate-700 space-y-3" data-testid="cbt-instructions-body">
      <p>The clock has been set at the server and the countdown timer will display the remaining time. When the timer reaches zero, the examination will end by itself.</p>
      <div>
        <p className="font-semibold text-slate-800 mb-1">The Question Palette shows the status of each question using these symbols:</p>
        <PaletteLegend />
      </div>
      <ul className="list-disc ml-5 space-y-1">
        <li><b>Save &amp; Next</b> saves your answer and moves to the next question.</li>
        <li><b>Mark for Review &amp; Next</b> flags a question for later review (and saves any selected answer).</li>
        <li><b>Clear Response</b> removes your current selection for the question.</li>
        <li>A response is only recorded after the server confirms the save.</li>
        <li>You may switch the question language at any time without losing answers.</li>
      </ul>
      {custom && (
        <div className="border-t border-slate-200 pt-3">
          <p className="font-semibold text-slate-800 mb-1">Paper-specific instructions</p>
          <div className="whitespace-pre-wrap">{custom}</div>
        </div>
      )}
    </div>
  );
}

function PreExam({ exam, user, lang, setLang, agree, setAgree, starting, onStart, subjects }) {
  const [step, setStep] = useState(0);
  const totalQ = exam.total_questions;
  const fam = examFamily(exam);
  const candidate = (
    <div className="flex flex-col items-center gap-2 w-40 shrink-0">
      <img src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || "Student"}`}
        alt="candidate" className="h-28 w-28 rounded-md border-2 border-slate-200 bg-slate-100 object-cover" />
      <div className="font-display font-bold text-[#0b2e59] text-center leading-tight" data-testid="cbt-pre-name">{user?.name}</div>
      <div className="text-xs text-slate-500 text-center break-all">{user?.email}</div>
    </div>
  );

  const Header = (
    <div className="w-full">
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3 bg-gradient-to-r from-[#0b2e59] to-[#17457e] text-white">
        <div className="h-12 w-12 rounded-md bg-white/15 grid place-items-center font-display font-extrabold tracking-tight shrink-0">{fam.badge}</div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-blue-200">{fam.en}</div>
          <div className="font-display font-bold text-base sm:text-xl leading-tight truncate">{exam.exam.title}</div>
        </div>
      </div>
      <div className="h-1.5 w-full bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" />
    </div>
  );

  const Stepper = (
    <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50">
      {["General Instructions", "Symbols & Palette", "Declaration"].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold transition-colors ${step >= i ? "bg-[#0b2e59] text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</div>
          <span className={`text-xs sm:text-sm ${step >= i ? "text-slate-800 font-medium" : "text-slate-400"}`}>{s}</span>
          {i < 2 && <ChevronRight className="h-4 w-4 text-slate-300 mx-1" />}
        </div>
      ))}
    </div>
  );

  const anim = {
    initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 },
    transition: { duration: 0.3, ease: "easeOut" },
  };

  return (
    <div data-testid="cbt-pre-exam" className="min-h-screen bg-slate-100 text-slate-900">
      {Header}
      <div className="max-w-5xl mx-auto p-3 sm:p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          {Stepper}
          <div className="p-4 sm:p-6">
            <AnimatePresence mode="wait">
              {/* ---------------- STEP 1 — General Instructions ---------------- */}
              {step === 0 && (
                <motion.div key="s0" {...anim} className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display font-bold text-xl text-[#0b2e59] mb-3">General Instructions</h2>
                    <ol className="list-decimal ml-5 space-y-2.5 text-sm text-slate-700 leading-relaxed" data-testid="cbt-general-instructions">
                      <li>Total duration of the examination is <b>{exam.exam.duration_minutes} minutes</b>.</li>
                      <li>The clock is set at the server. The countdown timer at the top-right shows the remaining time. When the timer reaches zero, the exam ends by itself — you are not required to submit manually.</li>
                      <li>The <b>Question Palette</b> on the right shows the status of every question using colour-coded symbols (explained on the next screen).</li>
                      <li>You can navigate between questions by clicking the question number in the palette, or using <b>Save &amp; Next</b>.</li>
                      <li>Only answers that you have <b>SAVED</b> will be recorded and considered for evaluation.</li>
                      <li>The paper has <b>{totalQ} questions</b> across <b>{subjects.length} subjects</b>, each split into multiple sections.</li>
                    </ol>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {subjects.map((s) => (
                        <span key={s.id} className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs">
                          {s.name} <span className="text-slate-400">({s.sections.reduce((a, sec) => a + sec.question_ids.length, 0)})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {candidate}
                </motion.div>
              )}

              {/* ---------------- STEP 2 — Symbols / Palette ---------------- */}
              {step === 1 && (
                <motion.div key="s1" {...anim}>
                  <h2 className="font-display font-bold text-xl text-[#0b2e59] mb-4">Symbols used in the Question Palette</h2>
                  <div className="grid sm:grid-cols-2 gap-6" data-testid="cbt-symbols">
                    <div className="space-y-3">
                      {[
                        { st: "not-visited", label: "You have NOT visited the question yet." },
                        { st: "not-answered", label: "You have NOT answered the question." },
                        { st: "answered", label: "You have answered the question." },
                        { st: "marked", label: "You have NOT answered, but marked it for review." },
                        { st: "answered-marked", label: "Answered AND marked for review (will be considered for evaluation)." },
                      ].map((it) => (
                        <div key={it.st} className="flex items-center gap-3 text-sm text-slate-700">
                          <PaletteCell number={it.st === "answered" ? 3 : it.st === "not-answered" ? 2 : it.st === "marked" ? 4 : it.st === "answered-marked" ? 5 : 1} status={it.st} active={false} onClick={() => {}} testid={`symbol-${it.st}`} />
                          <span>{it.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-600 mb-2">Marking (varies per section)</div>
                      <ul className="list-disc ml-5 text-sm text-slate-600 space-y-1.5">
                        <li><b>Save &amp; Next</b> — saves your answer and moves on.</li>
                        <li><b>Mark for Review &amp; Next</b> — flags it (answer still saved).</li>
                        <li><b>Clear Response</b> — removes your current selection.</li>
                        <li>Each section shows its own marking scheme at the top.</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ---------------- STEP 3 — Declaration ---------------- */}
              {step === 2 && (
                <motion.div key="s2" {...anim}>
                  <h2 className="font-display font-bold text-xl text-[#0b2e59] mb-3">Other Important Instructions &amp; Declaration</h2>
                  {exam.exam.instructions_en && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap mb-4" data-testid="cbt-paper-instructions">
                      {lang === "hi" ? (exam.exam.instructions_hi || exam.exam.instructions_en) : exam.exam.instructions_en}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm mb-4">
                    <span className="text-slate-500">Choose your default language:</span>
                    <div className="flex items-center rounded-lg overflow-hidden border border-slate-300">
                      <button data-testid="cbt-pre-lang-en" onClick={() => setLang("en")} className={`px-4 py-1.5 text-sm ${lang === "en" ? "bg-[#0b2e59] text-white" : "bg-white"}`}>English</button>
                      <button data-testid="cbt-pre-lang-hi" onClick={() => setLang("hi")} className={`px-4 py-1.5 text-sm ${lang === "hi" ? "bg-[#0b2e59] text-white" : "bg-white"}`}>हिंदी</button>
                    </div>
                  </div>
                  <label className="flex items-start gap-3 text-sm cursor-pointer rounded-lg border border-slate-200 bg-amber-50/50 p-4">
                    <Checkbox data-testid="cbt-agree" checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
                    <span>I have read and understood all the instructions. I declare that I am not in possession of any prohibited material. I agree that the examination timer is controlled by the server, and that in case of not adhering to the instructions I may be debarred from this test.</span>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ---------------- Footer nav ---------------- */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <Button data-testid="cbt-pre-prev" variant="outline" className="rounded-lg" disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            {step < 2 ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Button data-testid="cbt-pre-next" className="rounded-lg bg-[#0b2e59] hover:bg-[#09254a]" onClick={() => setStep((s) => Math.min(2, s + 1))}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: agree ? 1.03 : 1 }} whileTap={{ scale: agree ? 0.97 : 1 }}>
                <Button data-testid="cbt-start-exam" disabled={!agree || starting} onClick={onStart}
                  className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6">
                  {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…</> : "I am ready to begin"}
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
