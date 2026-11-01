import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { practiceApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Sparkles, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import ChapterPicker from "@/components/bank/ChapterPicker";

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Mathematics"];

export default function Practice() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const spSub = sp.get("subject");
  const spDiff = sp.get("difficulty");
  const [subjects, setSubjects] = useState(spSub && SUBJECTS.includes(spSub) ? [spSub] : ["Physics"]);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState(["easy", "medium", "hard"].includes(spDiff) ? spDiff : "");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState({ chapters: [], topics: [] });

  const toggleSub = (s) => setSubjects((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  const generate = async () => {
    setBusy(true);
    try {
      const t = await practiceApi.generate({
        subjects, count: Number(count) || 10, chapters: pick.chapters, topics: pick.topics,
        difficulty: difficulty || undefined,
      });
      if (t.exhausted_pool) toast.info("You've seen most questions — some may repeat.");
      else toast.success(`Fresh paper ready: ${t.new_questions} new questions!`);
      nav(`/student/exam/${t.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not generate a paper");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="practice-page" className="space-y-8 max-w-3xl">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Self practice</div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Generate a practice paper</h1>
        <p className="text-muted-foreground mt-1">We build a fresh paper and skip questions you've already attempted.</p>
      </div>

      <Card className="en-card p-6 space-y-6">
        <div>
          <div className="text-sm font-medium mb-2">Subjects</div>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button key={s} data-testid={`prac-sub-${s}`} onClick={() => toggleSub(s)}
                className={`px-4 py-2 rounded-full text-sm border transition-colors ${subjects.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Chapters <span className="text-muted-foreground font-normal">(optional — leave empty for a mixed paper)</span></div>
          <ChapterPicker subjects={subjects} value={pick} onChange={setPick} testId="prac-chapters" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium mb-2">Number of questions</div>
            <Input data-testid="prac-count" type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Difficulty</div>
            <Select value={difficulty || "any"} onValueChange={(v) => setDifficulty(v === "any" ? "" : v)}>
              <SelectTrigger data-testid="prac-difficulty"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" /> No repeats: previously attempted questions are excluded automatically.
        </div>

        <Button data-testid="prac-generate" className="rounded-full w-full sm:w-auto" disabled={busy || subjects.length === 0} onClick={generate}>
          {busy ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Building…</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate & start</>}
        </Button>
      </Card>
    </div>
  );
}
