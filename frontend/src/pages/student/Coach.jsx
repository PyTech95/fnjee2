import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { coachApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Flame, TrendingUp, PlayCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const BAND = {
  critical: { color: "text-rose-600", bg: "bg-rose-500/10", ring: "ring-rose-500/30", label: "Critical" },
  weak: { color: "text-amber-600", bg: "bg-amber-500/10", ring: "ring-amber-500/30", label: "Weak" },
  improving: { color: "text-emerald-600", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30", label: "Improving" },
};

export default function Coach() {
  const nav = useNavigate();
  const [plan, setPlan] = useState(null);
  const [drilling, setDrilling] = useState(null);

  useEffect(() => { coachApi.plan().then(setPlan).catch(() => {}); }, []);

  const startDrill = async (c) => {
    setDrilling(c.chapter);
    try {
      const res = await coachApi.drill({ subject: c.subject, chapter: c.chapter, count: 10 });
      toast.success(`Drill ready: ${res.count} questions`);
      nav(`/student/cbt/${res.test_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No questions for this chapter yet.");
    } finally { setDrilling(null); }
  };

  const weak = plan?.weak_chapters || [];

  return (
    <div data-testid="coach-page" className="space-y-6 max-w-4xl">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
          <Target className="h-3.5 w-3.5" /> AI Weakness Coach
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Today's fix-these-first plan</h1>
        <p className="text-muted-foreground mt-1">{plan?.message || "Analysing your attempts…"}</p>
      </div>

      {plan && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Stat icon={TrendingUp} label="Overall accuracy" value={plan.overall_accuracy != null ? `${plan.overall_accuracy}%` : "—"} />
          <Stat icon={Target} label="Chapters analysed" value={plan.chapters_analysed ?? 0} />
          <Stat icon={Flame} label="Focus chapters" value={weak.length} />
        </div>
      )}

      {weak.length === 0 ? (
        <Card className="en-card p-10 text-center" data-testid="coach-empty">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
          <div className="font-display font-semibold text-lg">Not enough data yet</div>
          <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">Attempt a couple of tests and your personalised weak-chapter plan (with one-tap drills) will appear here.</p>
          <Button className="rounded-full mt-4" onClick={() => nav("/student/tests")}>Go to My Tests</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {weak.map((c, i) => {
            const b = BAND[c.band] || BAND.weak;
            return (
              <Card key={c.chapter} data-testid={`coach-chapter-${i}`} className={`en-card p-5 ring-1 ${b.ring}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`h-11 w-11 rounded-xl grid place-items-center font-display font-bold ${b.bg} ${b.color}`}>{i + 1}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-display font-semibold">{c.chapter}</div>
                        <Badge variant="secondary" className="rounded-full">{c.subject}</Badge>
                        <Badge className={`rounded-full ${b.bg} ${b.color} border-0`}>{b.label}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{c.action}</div>
                      <div className="text-xs text-muted-foreground mt-1">{c.correct}✓ / {c.wrong}✗ · seen {c.seen}×</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`font-display font-bold text-2xl ${b.color}`}>{c.accuracy}%</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">accuracy</div>
                    </div>
                    <Button data-testid={`coach-drill-${i}`} className="rounded-full" disabled={drilling === c.chapter} onClick={() => startDrill(c)}>
                      {drilling === c.chapter ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1.5" />}
                      Start drill
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="en-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="font-display font-bold text-xl">{value}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}
