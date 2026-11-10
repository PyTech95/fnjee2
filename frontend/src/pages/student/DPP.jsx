import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Flame, Zap, Calendar, ChevronRight, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ChapterPicker from "@/components/bank/ChapterPicker";

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Mathematics"];
// default subjects follow the student's exam (JEE → Maths, NEET → Biology)
const defaultSubjects = (exam = "") => {
  const e = String(exam).toUpperCase();
  if (e.includes("JEE") && e.includes("NEET")) return SUBJECTS;
  if (e.includes("JEE")) return ["Physics", "Chemistry", "Mathematics"];
  return ["Physics", "Chemistry", "Biology"];
};

export default function DPP() {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const { user } = useAuth();
  const [subjects, setSubjects] = useState(() => defaultSubjects(user?.exam_target));
  const [pick, setPick] = useState({ chapters: [], topics: [] });
  const [count, setCount] = useState(20);
  const [difficulty, setDifficulty] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { reload(); }, []);
  const reload = () => {
    api.get("/dpp/today").then((r) => setToday(r.data));
    api.get("/dpp/history").then((r) => setHistory(r.data));
  };

  const generate = async (regenerate = false) => {
    if (subjects.length === 0) { toast.error("Pick at least one subject"); return; }
    setBusy(true);
    try {
      const r = await api.post("/dpp/generate", { subjects, count, difficulty: difficulty || undefined, regenerate, chapters: pick.chapters, topics: pick.topics });
      setToday({ ...r.data, exists: true });
      toast.success(`Fresh DPP with ${r.data?.count || count} questions ready.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not generate DPP");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="student-dpp-page" className="space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Daily practice</div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Today's DPP · Daily Practice Problems</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Fresh chapter-targeted set every day. Do it before dinner. Build the streak. That's the whole trick.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card data-testid="dpp-configurator" className="en-card p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl bg-accent/15 text-accent grid place-items-center"><Zap className="h-5 w-5" /></div>
            <div>
              <div className="font-display font-semibold text-lg">Build today's set</div>
              <div className="text-sm text-muted-foreground">Tap subjects to include them, optionally pick chapters, then choose the length.</div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <Label className="text-sm font-semibold">Subjects</Label>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SUBJECTS.map((s) => {
                  const on = subjects.includes(s);
                  return (
                    <button
                      key={s}
                      data-testid={`dpp-subject-${s.toLowerCase()}`}
                      onClick={() => setSubjects(on ? subjects.filter((x) => x !== s) : [...subjects, s])}
                      aria-pressed={on}
                      className={`px-2 sm:px-3 py-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors duration-200 ${
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Chapters <span className="font-normal text-muted-foreground">(optional — leave empty for all chapters)</span></Label>
              <div className="mt-3"><ChapterPicker subjects={subjects} value={pick} onChange={setPick} testId="dpp-chapters" /></div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Questions</Label>
                <div className="font-display font-bold text-2xl text-primary">{count}</div>
              </div>
              <Slider data-testid="dpp-count-slider" min={5} max={60} step={5} value={[count]} onValueChange={(v) => setCount(v[0])} className="mt-3" />
              <div className="text-xs text-muted-foreground mt-2">~{Math.max(15, count)} min · negative marking off</div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Difficulty (optional)</Label>
              <div className="mt-3 flex flex-wrap gap-2">
                {[{v: "", l: "Mixed"}, {v: "easy", l: "Easy"}, {v: "medium", l: "Medium"}, {v: "hard", l: "Hard"}].map((d) => (
                  <button
                    key={d.v}
                    data-testid={`dpp-diff-${d.v || "mixed"}`}
                    onClick={() => setDifficulty(d.v)}
                    className={`px-4 py-2 rounded-full text-sm border transition-colors duration-200 ${
                      difficulty === d.v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    {d.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button data-testid="dpp-generate-btn" onClick={() => generate(!!today?.exists)} disabled={busy} className="rounded-full">
                {busy ? "Building…" : today?.exists ? "Regenerate today's set" : "Generate today's DPP"}
              </Button>
              {today?.exists && (
                <Link to={`/student/cbt/${today.test_id}`}>
                  <Button data-testid="dpp-start-btn" variant="outline" className="rounded-full">Start now <ChevronRight className="h-4 w-4 ml-1" /></Button>
                </Link>
              )}
            </div>
          </div>
        </Card>

        <Card className="en-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-orange-500/15 text-orange-500 grid place-items-center"><Flame className="h-5 w-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Recent DPP</div>
              <div className="font-display font-bold text-2xl">{history.length}<span className="text-sm text-muted-foreground font-normal"> / 14 days</span></div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 14 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (13 - i));
              const iso = d.toISOString().slice(0, 10);
              const done = history.some((h) => h.date === iso);
              return (
                <div key={i} title={iso}
                  className={`aspect-square rounded-md text-[10px] grid place-items-center font-mono ${
                    done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>{d.getDate()}</div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-4">
            <Calendar className="h-3.5 w-3.5 inline mr-1" /> Last 2 weeks · a filled square = DPP completed
          </div>
        </Card>
      </div>

      {today?.exists && (
        <Card className="en-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Today's queue</div>
              <div className="font-display font-semibold text-lg mt-1">DPP · {today.date}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {today.subjects?.map((s) => <Badge key={s} variant="secondary" className="mr-1 rounded-full">{s}</Badge>)}
                · {today.count} questions
              </div>
            </div>
            <Link to={`/student/cbt/${today.test_id}`}>
              <Button data-testid="dpp-open-exam" className="rounded-full">Open CBT</Button>
            </Link>
          </div>
        </Card>
      )}

      <Card className="en-card p-6">
        <div className="font-display font-semibold text-lg mb-3">DPP history</div>
        <div className="space-y-2 text-sm">
          {history.map((h) => (
            <Link key={h.id} to={`/student/cbt/${h.test_id}`}
              className="flex justify-between items-center p-3 rounded-lg border border-border hover:border-primary/40 transition-colors duration-200"
              data-testid={`dpp-history-${h.date}`}>
              <div>
                <div className="font-medium">{h.date}</div>
                <div className="text-xs text-muted-foreground">{h.count} Qs · {h.subjects?.join(", ")}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          {history.length === 0 && <div className="text-sm text-muted-foreground">No DPPs yet. Generate today's set above.</div>}
        </div>
      </Card>
    </div>
  );
}
