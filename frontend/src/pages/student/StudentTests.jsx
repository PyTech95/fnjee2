import { useEffect, useState } from "react";
import { testsApi, attemptsApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Clock, BookOpen, CheckCircle2 } from "lucide-react";

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
                      <Link to={`/student/exam/${t.id}?retake=1`}><Button data-testid={`retake-${t.id}`} className="rounded-full">Retake · 1 pass</Button></Link>
                    </div>
                  </>
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
