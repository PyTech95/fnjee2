import { useEffect, useState } from "react";
import { testsApi, attemptsApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Clock, BookOpen, CheckCircle2, CalendarClock } from "lucide-react";

const opensLater = (t) => t.starts_at && new Date(t.starts_at).getTime() > Date.now();
const fmtWhen = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function StudentTests() {
  const [tests, setTests] = useState([]);
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    testsApi.list().then(setTests);
    attemptsApi.list().then(setAttempts);
  }, []);

  const submitted = attempts.filter(a => a.status === "submitted");
  const byTest = {};
  submitted.forEach(a => { (byTest[a.test_id] = byTest[a.test_id] || []).push(a); });
  Object.values(byTest).forEach(l => l.sort((x, y) => (x.submitted_at || "").localeCompare(y.submitted_at || "")));

  return (
    <div data-testid="student-tests-page" className="space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Tests</div>
        <h1 className="font-display font-bold text-3xl tracking-tight mt-1">My tests</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {tests.map(t => {
          const list = byTest[t.id] || [];
          const past = list.length > 0;
          const original = list[0];
          const best = list.reduce((m, a) => (a.score > (m?.score ?? -1) ? a : m), list[0]);
          const improved = list.length > 1 && best.score > original.score;
          return (
            <Card key={t.id} className="en-card p-5" data-testid={`test-card-${t.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="rounded-full">{t.exam_type.replace("_", " ")}</Badge>
                    {t.created_by_role === "parent" && <Badge className="rounded-full bg-accent/15 text-accent border-accent/30" variant="outline">Parent-assigned</Badge>}
                  </div>
                  <div className="font-display font-semibold text-lg">{t.title}</div>
                  <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{t.description}</div>
                  <TestContent content={t.content} testId={t.id} />
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-3">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t.duration_minutes} min</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {t.question_ids?.length} qs</span>
                    <span>Total: {t.total_marks} marks</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                {past ? (
                  <>
                    <div className="text-sm">
                      <div className="text-muted-foreground">Original</div>
                      <div className="font-semibold">{original.score} / {original.total_marks}</div>
                      {list.length > 1 && (
                        <div className="mt-1 text-xs" data-testid={`best-score-${t.id}`}>
                          <span className="text-muted-foreground">Best of {list.length}: </span>
                          <span className={improved ? "font-semibold text-emerald-600" : "font-semibold"}>{best.score} / {best.total_marks}</span>
                          {improved && <span className="text-emerald-600 ml-1">▲ +{best.score - original.score}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/student/results/${best.id}`}><Button data-testid={`view-result-${t.id}`} variant="outline" className="rounded-full"><CheckCircle2 className="h-4 w-4 mr-2" />Result</Button></Link>
                      <Link to={`/student/cbt/${t.id}?retake=1`}><Button data-testid={`retake-${t.id}`} className="rounded-full">Retake</Button></Link>
                    </div>
                  </>
                ) : opensLater(t) ? (
                  <div className="ml-auto flex items-center gap-2 text-sm" data-testid={`opens-${t.id}`}>
                    <span className="text-muted-foreground flex items-center gap-1"><CalendarClock className="h-4 w-4" /> Opens {fmtWhen(t.starts_at)}</span>
                    <Button disabled className="rounded-full">Start Test</Button>
                  </div>
                ) : (
                  <div className="ml-auto flex gap-2">
                    <Link to={`/student/cbt/${t.id}`}><Button data-testid={`cbt-test-${t.id}`} className="rounded-full">Start Test</Button></Link>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
        {tests.length === 0 && <div className="text-muted-foreground">No tests assigned yet.</div>}
      </div>
    </div>
  );
}

// Subject + chapter chips so a student knows what a drill / retest / DPP covers.
const SUBJECT_TONE = {
  Physics: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  Chemistry: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Biology: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Mathematics: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};
function TestContent({ content, testId }) {
  if (!content || (!content.subjects?.length && !content.chapters?.length)) return null;
  const chapters = content.chapters || [];
  const more = Math.max(0, (content.chapter_count || chapters.length) - 2);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`test-content-${testId}`}>
      {(content.subjects || []).map((s) => (
        <span key={s} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SUBJECT_TONE[s] || "bg-muted text-foreground"}`}>{s}</span>
      ))}
      {chapters.slice(0, 2).map((c) => (
        <span key={c} className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground max-w-[220px] truncate" title={c}>{c}</span>
      ))}
      {more > 0 && <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">+{more} chapters</span>}
    </div>
  );
}
