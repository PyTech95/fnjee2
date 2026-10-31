import { useEffect, useState, useMemo, useRef } from "react";
import { shareContent } from "@/lib/native";
import { useParams, Link } from "react-router-dom";
import { attemptsApi, testsApi, percentileApi, duelsApi, wrongRetestApi, coachApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Circle, Share2, Trophy, Target, Timer, Zap, Volume2, VolumeX, Users, RefreshCw, Swords, Download, Sparkles } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from "recharts";
import { celebrate } from "@/pages/student/LiveExam";
import { toast } from "sonner";
import MathText from "@/components/MathText";
import { QuestionContent, QuestionImage } from "@/components/QuestionContent";
import { printScorecard } from "@/lib/printScorecard";
import { useAuth } from "@/contexts/AuthContext";

export default function Result() {
  const { attemptId } = useParams();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [test, setTest] = useState(null);
  const [tpq, setTpq] = useState({});
  const [rank, setRank] = useState(null);
  const [coach, setCoach] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachLang, setCoachLang] = useState("en");
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const loadPlan = () => {
    setPlanLoading(true);
    coachApi.studyPlan(attemptId).then(setPlan).catch(() => {}).finally(() => setPlanLoading(false));
  };
  const [playingId, setPlayingId] = useState(null);
  const utterRef = useRef(null);

  const loadCoach = (lang = coachLang) => {
    setCoachLoading(true);
    coachApi.performance(attemptId, lang).then(setCoach).catch(() => {}).finally(() => setCoachLoading(false));
  };
  const switchLang = (lang) => { setCoachLang(lang); setCoach(null); loadCoach(lang); };

  useEffect(() => { if (attemptId) loadCoach("en"); /* eslint-disable-next-line */ }, [attemptId]);

  useEffect(() => {
    attemptsApi.get(attemptId).then(async (a) => {
      setAttempt(a);
      const t = await testsApi.get(a.test_id, true);
      setTest(t);
      try { const raw = sessionStorage.getItem(`tpq_${attemptId}`); if (raw) setTpq(JSON.parse(raw)); } catch {}
      try { const r = await percentileApi.get(a.test_id, a.score); setRank(r); } catch {}
    });
    return () => { try { window.speechSynthesis?.cancel(); } catch {} };
  }, [attemptId]);

  const playExplanation = (q, id) => {
    if (!("speechSynthesis" in window)) { toast.error("Voice not supported on this browser"); return; }
    window.speechSynthesis.cancel();
    if (playingId === id) { setPlayingId(null); return; }
    const text = q?.explanation || "No explanation provided for this question.";
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0; utter.pitch = 1.0; utter.lang = "en-IN";
    utter.onstart = () => setPlayingId(id);
    utter.onend = () => setPlayingId(null);
    utter.onerror = () => { setPlayingId(null); toast.error("Voice unavailable on this device"); };
    utterRef.current = utter;
    // set immediately so UI reacts even if onstart is delayed
    setPlayingId(id);
    window.speechSynthesis.speak(utter);
  };

  const percent = useMemo(() => attempt?.total_marks ? Math.round((attempt.score / attempt.total_marks) * 100) : 0, [attempt]);

  useEffect(() => {
    if (attempt && percent >= 50) celebrate();
  }, [attempt, percent]);

  if (!attempt || !test) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const qmap = Object.fromEntries((test.questions || []).map(q => [q.id, q]));
  const chartData = Object.entries(attempt.subject_stats || {}).map(([s, st]) => ({
    subject: s, correct: st.correct, wrong: st.wrong,
  }));
  const attempted = (attempt.correct || 0) + (attempt.wrong || 0);
  const accuracy = attempted ? Math.round((attempt.correct / attempted) * 100) : 0;
  const totalTime = Object.values(tpq).reduce((s, x) => s + x, 0);
  const avgSec = attempted ? Math.round(totalTime / attempted) : 0;
  // simple percentile guess: bell around 60% mean
  const percentile = Math.max(1, Math.min(99, Math.round(50 + (percent - 60) * 1.2)));
  const grade = percent >= 85 ? "Elite" : percent >= 70 ? "Strong" : percent >= 50 ? "Good" : percent >= 30 ? "Room to grow" : "Restart needed";
  const gradeColor = percent >= 70 ? "text-emerald-600" : percent >= 50 ? "text-primary" : percent >= 30 ? "text-amber-600" : "text-destructive";

  const share = async () => {
    const text = `I scored ${attempt.score}/${attempt.total_marks} (${percent}%) on ${test.title} @ FNJEE.com — predicted percentile ${percentile}. Try it: `;
    const url = window.location.origin;
    const wa = `https://wa.me/?text=${encodeURIComponent(text + url)}`;
    if (!(await shareContent({ title: "FNJEE.com score", text, url }))) window.open(wa, "_blank");
  };

  const challengeFriend = async () => {
    try {
      const d = await duelsApi.create({ test_id: test.id, attempt_id: attempt.id });
      const link = `${window.location.origin}/duel/${d.code}`;
      const text = `⚔️ I scored ${attempt.score}/${attempt.total_marks} on ${test.title}. Think you can beat me? FNJEE.com duel:`;
      const wa = `https://wa.me/?text=${encodeURIComponent(text + " " + link)}`;
      try { await navigator.clipboard.writeText(link); } catch {}
      if (!(await shareContent({ title: "FNJEE.com duel", text, url: link }))) window.open(wa, "_blank");
      toast.success(`Duel link copied · code ${d.code}`);
    } catch { toast.error("Could not create duel"); }
  };

  const retestWrong = async () => {
    try {
      const t = await wrongRetestApi.create(attempt.id);
      toast.success("Wrong-only drill ready — go!");
      window.location.href = `/student/exam/${t.id}`;
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not build drill"); }
  };

  return (
    <div data-testid="result-page" className="space-y-8">
      {/* HERO CARD */}
      <Card className="en-card p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="absolute -right-24 top-32 h-64 w-64 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="relative grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" /> Result · {grade}
            </div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">{test.title}</h1>
            <div className="mt-6 flex items-end gap-3">
              <div className={`font-display font-black text-6xl sm:text-7xl tabular-nums ${gradeColor}`}>{attempt.score}</div>
              <div className="text-2xl text-muted-foreground pb-2">/ {attempt.total_marks}</div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{percent}% overall · predicted percentile <b className="text-foreground">{percentile}</b></div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to={`/student/exam/${test.id}`}><Button data-testid="retake-btn" className="rounded-full">Retake test</Button></Link>
              {(attempt.detailed || []).some(d => d.result === "wrong") && (
                <Button data-testid="retest-wrong-btn" variant="outline" className="rounded-full" onClick={retestWrong}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Retest wrong only ({attempt.wrong})
                </Button>
              )}
              <Button data-testid="challenge-btn" variant="outline" className="rounded-full" onClick={challengeFriend}><Swords className="h-4 w-4 mr-2" /> Challenge friend</Button>
              <Link to={`/student/leaderboard?test=${test.id}`}><Button data-testid="class-leaderboard-btn" variant="outline" className="rounded-full"><Trophy className="h-4 w-4 mr-2" /> Class leaderboard</Button></Link>
              <Button data-testid="share-result" variant="ghost" className="rounded-full" onClick={share}><Share2 className="h-4 w-4 mr-2" /> Share</Button>
              <Button data-testid="download-pdf" variant="outline" className="rounded-full" onClick={() => printScorecard({ test, attempt, qmap, student: user?.name })}><Download className="h-4 w-4 mr-2" /> Download PDF</Button>
              <Link to="/student/tests"><Button variant="ghost" className="rounded-full">Back to tests</Button></Link>
            </div>
          </div>
          {/* score ring */}
          <div className="grid place-items-center">
            <ScoreRing pct={percent} />
          </div>
        </div>
      </Card>

      {/* RANK RACE */}
      {rank && rank.total > 0 && (
        <Card data-testid="rank-race" className="en-card p-6">
          <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-secondary" /><h3 className="font-display font-semibold text-lg">Live rank race</h3></div>
          <p className="text-sm">You beat <b className="text-primary text-xl font-display">{rank.percentile}%</b> of aspirants who attempted this test ({rank.beat} of {rank.total} peers).</p>
          <div className="mt-3 h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000" style={{ width: `${rank.percentile}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
            <span>Bottom</span><span>Top</span>
          </div>
        </Card>
      )}

      {/* AI PERFORMANCE COACH */}
      <Card data-testid="ai-coach-card" className="en-card p-6 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden />
        <div className="relative flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-500" /><h3 className="font-display font-semibold text-lg">AI Performance Coach</h3></div>
          <div className="flex items-center rounded-full border border-border p-0.5 text-xs">
            <button data-testid="coach-lang-en" onClick={() => switchLang("en")} className={`px-3 py-1 rounded-full transition-colors ${coachLang === "en" ? "bg-indigo-500 text-white" : "text-muted-foreground"}`}>EN</button>
            <button data-testid="coach-lang-hi" onClick={() => switchLang("hi")} className={`px-3 py-1 rounded-full transition-colors ${coachLang === "hi" ? "bg-indigo-500 text-white" : "text-muted-foreground"}`}>हिंदी</button>
          </div>
        </div>
        {coachLoading && <div className="relative text-sm text-muted-foreground animate-pulse">Analysing your attempt and writing your diagnosis…</div>}
        {!coachLoading && !coach && (
          <div className="relative text-sm text-muted-foreground">Coach couldn't run just now. <button data-testid="coach-retry" className="text-primary underline" onClick={() => loadCoach()}>Retry</button></div>
        )}
        {coach && (
          <div className="relative space-y-4" data-testid="coach-content">
            <p className="text-sm leading-relaxed">{coach.overview}</p>
            {coach.conceptual_gaps?.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Conceptual gaps</div>
                <ul className="space-y-1 text-sm">{coach.conceptual_gaps.map((g, i) => <li key={i}><b>{g.topic}:</b> {g.note}</li>)}</ul>
              </div>
            )}
            {coach.silly_mistakes?.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Silly mistakes</div>
                <ul className="list-disc pl-5 text-sm space-y-1">{coach.silly_mistakes.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {coach.time_management && (
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Time management</div>
                <p className="text-sm">{coach.time_management}</p>
              </div>
            )}
            {coach.action_plan?.length > 0 && (
              <div className="p-4 rounded-xl bg-indigo-500/10">
                <div className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">Do next</div>
                <ul className="space-y-1.5 text-sm">{coach.action_plan.map((a, i) => <li key={i} className="flex gap-2"><span className="text-indigo-500 font-bold">→</span>{a}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 7-DAY STUDY PLAN */}
      <Card data-testid="study-plan-card" className="en-card p-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold text-lg">Your 7-Day Study Plan</h3></div>
          {!plan && <Button data-testid="generate-plan-btn" size="sm" className="rounded-full" onClick={loadPlan} disabled={planLoading}>{planLoading ? "Building…" : "Generate plan"}</Button>}
        </div>
        {planLoading && <div className="text-sm text-muted-foreground animate-pulse">Designing a plan around your weak topics…</div>}
        {plan && (
          <div className="space-y-4" data-testid="plan-content">
            {plan.summary && <p className="text-sm text-muted-foreground">{plan.summary}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
              {(plan.days || []).map((d, i) => (
                <div key={i} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">D{d.day}</span>
                    <span className="text-sm font-semibold">{d.focus}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {(d.tasks || []).map((tk, j) => (
                      <li key={j} className="text-sm flex gap-2">
                        <Badge variant="secondary" className="rounded-full text-[10px] shrink-0 h-5">{tk.type}</Badge>
                        <span><b>{tk.title}</b>{tk.detail ? ` — ${tk.detail}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* STAT STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat icon={CheckCircle2} label="Correct" value={attempt.correct} tint="text-emerald-600" bg="bg-emerald-500/10" />
        <MiniStat icon={XCircle} label="Wrong" value={attempt.wrong} tint="text-destructive" bg="bg-destructive/10" />
        <MiniStat icon={Target} label="Accuracy" value={`${accuracy}%`} tint="text-primary" bg="bg-primary/10" />
        <MiniStat icon={Timer} label="Avg / question" value={`${avgSec}s`} tint="text-accent" bg="bg-accent/15" />
      </div>

      {/* SUBJECT + SPEED VS ACCURACY */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="en-card p-6 lg:col-span-2">
          <h3 className="font-display font-semibold text-lg mb-4">Subject breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer initialDimension={{ width: 1, height: 1 }} minWidth={0}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="correct" stackId="a" fill="hsl(142 71% 45%)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="wrong" stackId="a" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="en-card p-6">
          <div className="flex items-center gap-2 mb-4"><Zap className="h-4 w-4 text-accent" /><h3 className="font-display font-semibold text-lg">Speed vs accuracy</h3></div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You averaged <b className="text-foreground">{avgSec}s</b> per attempted question at <b className="text-foreground">{accuracy}%</b> accuracy.
          </p>
          <div className="mt-4 p-3 rounded-xl bg-muted/50 text-sm">
            {accuracy >= 75 && avgSec <= 90 ? "🚀 Sharp and fast — keep this rhythm on exam day." :
             accuracy >= 75 ? "🎯 Accurate but slow — practice sectional timing next." :
             avgSec <= 75 ? "⚡ Fast but leaking marks — slow down 10 s on tough questions." :
             "🧭 Focus on accuracy first, speed follows naturally."}
          </div>
        </Card>
      </div>

      {/* DIFFICULTY BREAKDOWN */}
      {(() => {
        const order = ["easy", "medium", "hard"];
        const agg = {};
        (attempt.detailed || []).forEach(d => {
          const diff = d.difficulty || qmap[d.question_id]?.difficulty;
          if (!diff) return;
          const a = agg[diff] || (agg[diff] = { total: 0, correct: 0, wrong: 0, time: 0, timed: 0 });
          a.total += 1;
          if (d.result === "correct") a.correct += 1;
          else if (d.result === "wrong") a.wrong += 1;
          const t = tpq[d.question_id] ?? d.time_taken;
          if (t != null) { a.time += t; a.timed += 1; }
        });
        const rows = order.filter(k => agg[k]);
        if (!rows.length) return null;
        const tint = { easy: "text-emerald-600", medium: "text-amber-600", hard: "text-destructive" };
        // weakest level = lowest accuracy (ties resolve to the harder level)
        let weakest = null, worstAcc = 101;
        ["hard", "medium", "easy"].forEach(k => {
          const a = agg[k]; if (!a) return;
          const att = a.correct + a.wrong; const acc = att ? (a.correct / att * 100) : 100;
          if (acc < worstAcc) { worstAcc = acc; weakest = k; }
        });
        const dominantSubject = Object.entries(attempt.subject_stats || {})
          .sort((a, b) => (b[1].total || 0) - (a[1].total || 0))[0]?.[0] || "Biology";
        const drillHref = `/student/practice?subject=${encodeURIComponent(dominantSubject)}&difficulty=${weakest || "hard"}`;
        return (
          <Card className="en-card p-6" data-testid="difficulty-breakdown">
            <h3 className="font-display font-semibold text-lg mb-1">Accuracy &amp; time by difficulty</h3>
            <p className="text-sm text-muted-foreground mb-4">See where you're losing marks, then drill that level in Practice.</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {rows.map(k => {
                const a = agg[k];
                const attempted = a.correct + a.wrong;
                const acc = attempted ? Math.round((a.correct / attempted) * 100) : 0;
                const avg = a.timed ? Math.round(a.time / a.timed) : null;
                return (
                  <div key={k} className="p-4 rounded-xl border border-border" data-testid={`diff-card-${k}`}>
                    <div className={`text-xs font-bold uppercase tracking-widest capitalize ${tint[k]}`}>{k}</div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-display font-bold">{acc}%</span>
                      <span className="text-xs text-muted-foreground">accuracy</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${acc}%` }} />
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      <span><b className="text-emerald-600">{a.correct}</b> correct</span>
                      <span><b className="text-destructive">{a.wrong}</b> wrong</span>
                      <span>of <b className="text-foreground">{a.total}</b></span>
                      {avg != null && <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{avg}s avg</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <Link to={drillHref}><Button variant="outline" size="sm" className="rounded-full" data-testid="drill-weak">Drill your weakest: {dominantSubject} · <span className="capitalize">{weakest || "hard"}</span> →</Button></Link>
            </div>
          </Card>
        );
      })()}

      {/* TIME PER QUESTION */}
      {(() => {
        const rows = (attempt.detailed || []).map((d, i) => ({
          name: `Q${i + 1}`,
          time: tpq[d.question_id] ?? d.time_taken ?? 0,
          result: d.result,
        })).filter(r => r.time > 0);
        if (rows.length < 2) return null;
        const top = [...rows].sort((a, b) => b.time - a.time).slice(0, 10);
        const color = (r) => r.result === "correct" ? "hsl(142 71% 45%)" : r.result === "wrong" ? "hsl(0 72% 51%)" : "hsl(215 16% 65%)";
        const avg = Math.round(rows.reduce((s, r) => s + r.time, 0) / rows.length);
        return (
          <Card className="en-card p-6" data-testid="time-per-question">
            <h3 className="font-display font-semibold text-lg mb-1">Where your time went</h3>
            <p className="text-sm text-muted-foreground mb-4">Your 10 slowest questions (avg {avg}s/question). Green = correct, red = wrong — trim time on the reds.</p>
            <ResponsiveContainer initialDimension={{ width: 1, height: 1 }} minWidth={0} width="100%" height={Math.max(200, top.length * 34)}>
              <BarChart data={top} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} unit="s" />
                <YAxis type="category" dataKey="name" width={44} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}s`, "Time"]} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="time" radius={[0, 8, 8, 0]}>
                  {top.map((r, i) => <Cell key={i} fill={color(r)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        );
      })()}

      {/* QUESTION REVIEW */}
      <Card className="en-card p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Question review</h3>
        <div className="space-y-3">
          {(attempt.detailed || []).map((d, i) => {
            const q = qmap[d.question_id];
            const Icon = d.result === "correct" ? CheckCircle2 : d.result === "wrong" ? XCircle : Circle;
            const tint = d.result === "correct" ? "text-emerald-600" : d.result === "wrong" ? "text-destructive" : "text-muted-foreground";
            const spent = tpq[d.question_id] ?? d.time_taken ?? null;
            const isPlaying = playingId === d.question_id;
            const showVoice = d.result === "wrong" && q?.explanation;
            const diff = d.difficulty || q?.difficulty;
            const diffTint = diff === "hard" ? "text-destructive" : diff === "easy" ? "text-emerald-600" : "text-amber-600";
            return (
              <div key={i} className="p-4 rounded-xl border border-border" data-testid={`review-q-${i}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${tint}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="secondary" className="rounded-full">Q{i+1}</Badge>
                      {q && <Badge variant="outline" className="rounded-full">{q.subject}</Badge>}
                      {diff && <Badge variant="outline" className={`rounded-full text-xs capitalize ${diffTint}`}>{diff}</Badge>}
                      <Badge variant="outline" className={`rounded-full ${tint}`}>{d.result}</Badge>
                      <Badge variant="outline" className="rounded-full">{d.marks_awarded > 0 ? "+" : ""}{d.marks_awarded}</Badge>
                      {spent != null && <Badge variant="outline" className="rounded-full text-xs"><Timer className="h-3 w-3 mr-1" />{spent}s</Badge>}
                      {d.confidence && <Badge variant="outline" className={`rounded-full text-xs ${d.confidence === "sure" ? "text-emerald-600" : "text-amber-600"}`}>{d.confidence === "sure" ? "🎯 Sure" : "🎲 Guess"}</Badge>}
                      {showVoice && (
                        <button data-testid={`play-voice-${i}`} onClick={() => playExplanation(q, d.question_id)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium flex items-center gap-1 ${isPlaying ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                          {isPlaying ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                          {isPlaying ? "Stop" : "Hear it (30s)"}
                        </button>
                      )}
                    </div>
                    {q && <QuestionContent question={q} testId={`result-question-${q.id}`} className="text-sm" />}
                    {(() => {
                      const LET = ["A","B","C","D","E","F"];
                      const label = (arr) => (arr || []).map(l => {
                        const idx = LET.indexOf(String(l).toUpperCase());
                        const txt = q?.options?.[idx];
                        return txt ? `${String(l).toUpperCase()}. ${txt}` : String(l).toUpperCase();
                      }).join(" | ") || "—";
                      return (
                        <div className="text-xs mt-2 space-y-1">
                          <div className={d.result === "correct" ? "text-emerald-700" : "text-muted-foreground"}>
                            Your answer: <b>{label(d.user_answer)}</b>
                          </div>
                          <div className="text-emerald-700">Correct answer: <b>{label(d.correct)}</b></div>
                        </div>
                      );
                    })()}
                    {q?.explanation && <div className="text-xs mt-2 p-2 rounded-lg bg-muted/60">💡 <MathText>{q.explanation}</MathText></div>}
                    {q?.explanation_image_url && <QuestionImage src={q.explanation_image_url} alt="Source solution illustration" testId={`result-solution-${q.id}`} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tint, bg }) {
  return (
    <Card className="en-card p-5">
      <div className="flex items-center gap-3">
        <div className={`h-11 w-11 rounded-xl grid place-items-center ${bg} ${tint}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest">{label}</div>
          <div className={`font-display font-bold text-2xl ${tint}`}>{value}</div>
        </div>
      </div>
    </Card>
  );
}

function ScoreRing({ pct }) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }} data-testid="score-ring">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} strokeWidth={stroke} stroke="hsl(var(--muted))" fill="none" />
        <circle cx={size/2} cy={size/2} r={r} strokeWidth={stroke} stroke="hsl(var(--primary))" fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display font-bold text-4xl">{pct}%</div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Score</div>
        </div>
      </div>
    </div>
  );
}
