import { useEffect, useState, useCallback } from "react";
import { reviewApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, CheckCircle2, XCircle, Brain, Loader2, Trophy } from "lucide-react";
import MathText from "@/components/MathText";
import { QuestionContent, QuestionImage } from "@/components/QuestionContent";
import { toast } from "sonner";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function Revision() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(0);

  const loadStats = useCallback(() => reviewApi.stats().then(setStats).catch(() => {}), []);
  useEffect(() => { loadStats(); }, [loadStats]);

  const begin = async () => {
    try {
      const res = await reviewApi.due(20);
      if (!res.questions.length) { toast.info("Nothing due right now — great job!"); return; }
      setQueue(res.questions); setIdx(0); setSel(null); setResult(null); setStarted(true); setDone(0);
    } catch { toast.error("Could not load your reviews"); }
  };

  const q = queue[idx];

  const submit = async () => {
    if (sel == null) return;
    setBusy(true);
    try {
      const res = await reviewApi.grade({ question_id: q.id, selected: [LETTERS[sel]] });
      setResult(res);
      setDone((d) => d + 1);
    } catch { toast.error("Could not grade"); } finally { setBusy(false); }
  };

  const next = () => {
    if (idx + 1 >= queue.length) { setStarted(false); loadStats(); toast.success("Review session complete!"); return; }
    setIdx((i) => i + 1); setSel(null); setResult(null);
  };

  return (
    <div data-testid="revision-page" className="space-y-6 max-w-3xl">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Spaced Repetition
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Smart revision</h1>
        <p className="text-muted-foreground mt-1">Every question you got wrong comes back at the perfect moment — so nothing slips before exam day.</p>
      </div>

      {!started && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Due now" value={stats?.due ?? "—"} tint="text-primary" bg="bg-primary/10" icon={RotateCcw} />
            <Stat label="Learning" value={stats?.learning ?? "—"} tint="text-amber-600" bg="bg-amber-500/10" icon={Brain} />
            <Stat label="Mastered" value={stats?.mastered ?? "—"} tint="text-emerald-600" bg="bg-emerald-500/10" icon={Trophy} />
            <Stat label="Total tracked" value={stats?.total ?? "—"} tint="text-foreground" bg="bg-muted" icon={CheckCircle2} />
          </div>
          <Card className="en-card p-8 text-center">
            {(stats?.due ?? 0) > 0 ? (
              <>
                <div className="font-display font-semibold text-lg">{stats.due} question{stats.due === 1 ? "" : "s"} ready to review</div>
                <p className="text-muted-foreground text-sm mt-1">A quick session now locks these in for longer.</p>
                <Button data-testid="revision-start" className="rounded-full mt-4" onClick={begin}>Start review session</Button>
              </>
            ) : (
              <>
                <Trophy className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <div className="font-display font-semibold text-lg">All caught up!</div>
                <p className="text-muted-foreground text-sm mt-1">Attempt tests to build your review deck — wrong answers are added automatically.</p>
              </>
            )}
          </Card>
        </>
      )}

      {started && q && (
        <Card className="en-card p-6" data-testid="revision-card">
          <div className="flex items-center justify-between text-sm mb-4">
            <Badge variant="secondary" className="rounded-full max-w-full truncate">{q.subject}{q.chapter ? ` · ${q.chapter}` : ""}{q.topic ? ` · ${q.topic}` : ""}</Badge>
            <span className="text-muted-foreground tabular-nums">{idx + 1} / {queue.length}</span>
          </div>
          <QuestionContent question={q} testId="revision-question" className="text-base font-medium leading-relaxed" />
          <div className="mt-4 space-y-2">
            {(q.options || []).map((opt, i) => {
              const isSel = sel === i;
              const isCorrect = result && result.correct_answer?.map((x) => x.toUpperCase()).includes(LETTERS[i]);
              const showWrong = result && isSel && !result.correct;
              return (
                <button key={i} data-testid={`revision-opt-${i}`} disabled={!!result}
                  onClick={() => setSel(i)}
                  className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                    result ? (isCorrect ? "border-emerald-500 bg-emerald-500/10" : showWrong ? "border-rose-500 bg-rose-500/10" : "border-border opacity-70")
                    : isSel ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                  <span className={`h-6 w-6 rounded-full grid place-items-center text-xs font-bold shrink-0 ${isSel && !result ? "bg-primary text-primary-foreground" : "border border-border"}`}>{LETTERS[i]}</span>
                  <span className="flex-1"><MathText>{String(opt)}</MathText></span>
                  {result && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {showWrong && <XCircle className="h-4 w-4 text-rose-600" />}
                </button>
              );
            })}
          </div>

          {result && (
            <div className={`mt-4 p-3 rounded-xl text-sm ${result.correct ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`} data-testid="revision-feedback">
              <div className="font-semibold mb-1">{result.correct ? "Correct — pushed further out 🎉" : "Not quite — you'll see this again tomorrow"}</div>
              {result.explanation && <div className="text-foreground/70"><MathText>{result.explanation}</MathText></div>}
              <QuestionImage src={result.explanation_image_url} alt="Solution illustration" testId="revision-solution-image" />
            </div>
          )}

          <div className="mt-5 flex justify-end">
            {!result ? (
              <Button data-testid="revision-submit" className="rounded-full" disabled={sel == null || busy} onClick={submit}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Check answer
              </Button>
            ) : (
              <Button data-testid="revision-next" className="rounded-full" onClick={next}>
                {idx + 1 >= queue.length ? "Finish" : "Next question"}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tint, bg, icon: Icon }) {
  return (
    <Card className="en-card p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${bg} ${tint}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className={`font-display font-bold text-xl ${tint}`}>{value}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}
