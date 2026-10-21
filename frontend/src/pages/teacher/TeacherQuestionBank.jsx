import { useMemo, useState } from "react";
import { testsApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, FilePlus2, X, ArrowUp, ArrowDown } from "lucide-react";
import NumberedPager from "@/components/bank/NumberedPager";
import BankFilters from "@/components/bank/BankFilters";
import { EMPTY_FILTERS, useQuestionPage, useTaxonomy, classLabel } from "@/lib/bank";
import { toast } from "sonner";
import MathText from "@/components/MathText";
import { QuestionContent } from "@/components/QuestionContent";
import { printPaper } from "@/lib/printPaper";

const DIFF_COLOR = { easy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", medium: "bg-amber-500/10 text-amber-600 border-amber-500/20", hard: "bg-red-500/10 text-red-600 border-red-500/20" };

export default function TeacherQuestionBank() {
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const { tax } = useTaxonomy();
  const pg = useQuestionPage(filters, 30);
  const { rows, loading } = pg;
  const [selected, setSelected] = useState([]); // array of question objects (ordered)
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);

  const selectedIds = useMemo(() => new Set(selected.map((q) => q.id)), [selected]);

  const toggle = (q) => {
    setSelected((prev) => prev.some((x) => x.id === q.id) ? prev.filter((x) => x.id !== q.id) : [...prev, q]);
  };
  const move = (idx, dir) => {
    setSelected((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const createPaper = async () => {
    if (!title.trim()) return toast.error("Give the paper a title");
    if (selected.length === 0) return toast.error("Select at least one question");
    setSaving(true);
    try {
      await testsApi.create({
        title: title.trim(), exam_type: "teacher_paper",
        description: `Teacher paper · ${selected.length} questions`,
        subjects: [...new Set(selected.map((q) => q.subject))],
        duration_minutes: Number(duration) || 60,
        question_ids: selected.map((q) => q.id),
        negative_marking: true, shuffle_questions: false, show_solutions_after: true,
      });
      toast.success("Paper created — find it under My Papers");
      setSelected([]); setTitle("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create paper");
    } finally { setSaving(false); }
  };

  return (
    <div data-testid="teacher-question-bank" className="space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Build a paper</div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Question Bank</h1>
        <p className="text-muted-foreground mt-1">Pick questions one-by-one, arrange them, then generate a paper.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* left: bank */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="en-card p-4">
            <BankFilters filters={filters} setFilters={setFilters} tax={tax} show={["difficulty", "type"]} testId="tq-filters" />
          </Card>
          <NumberedPager testId="tq-pager" page={pg.page} pages={pg.pages} total={pg.total} pageSize={pg.pageSize}
            onPage={(p) => { pg.setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} onPageSize={pg.setPageSize} loading={loading} />

          <div className="space-y-3">
            {loading && <div className="text-center text-muted-foreground py-8">Loading…</div>}
            {!loading && rows.length === 0 && <div className="text-center text-muted-foreground py-8">No questions match your access/filters.</div>}
            {rows.map((q) => (
              <Card key={q.id} data-testid={`tq-row-${q.id}`}
                className={`en-card p-4 cursor-pointer transition-colors ${selectedIds.has(q.id) ? "ring-2 ring-primary" : ""}`}
                onClick={() => toggle(q)}>
                <div className="flex items-start gap-3">
                  <Checkbox data-testid={`tq-check-${q.id}`} checked={selectedIds.has(q.id)} onCheckedChange={() => toggle(q)} onClick={(e) => e.stopPropagation()} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <details data-testid={`teacher-preview-${q.id}`} onClick={(e) => e.stopPropagation()}>
                      <summary data-testid={`teacher-preview-toggle-${q.id}`} className="font-medium cursor-pointer">{q.text.split('\n')[0]}</summary>
                      <QuestionContent question={q} testId={`teacher-question-${q.id}`} className="mt-3" />
                    </details>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="secondary" className="rounded-full">{q.subject}</Badge>
                      {q.student_class && <Badge variant="outline" className="rounded-full">{classLabel(q.student_class)}</Badge>}
                      {q.chapter && <Badge variant="outline" className="rounded-full">{q.chapter}</Badge>}
                      {q.topic && <Badge variant="outline" className="rounded-full">{q.topic}</Badge>}
                      <Badge className={`rounded-full border ${DIFF_COLOR[q.difficulty] || ""}`} variant="outline">{q.difficulty}</Badge>
                      <Badge variant="outline" className="rounded-full">{q.marks} marks</Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {pg.total > pg.pageSize && (
            <NumberedPager testId="tq-pager-bottom" page={pg.page} pages={pg.pages} total={pg.total} pageSize={pg.pageSize}
              onPage={(p) => { pg.setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} loading={loading} />
          )}
        </div>

        {/* right: selection cart */}
        <div className="space-y-4">
          <Card className="en-card p-5 sticky top-24">
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2"><FilePlus2 className="h-4 w-4 text-primary" /> Paper ({selected.length})</div>
              {selected.length > 0 && <Button size="sm" variant="ghost" onClick={() => setSelected([])} data-testid="clear-selection">Clear</Button>}
            </div>
            <div className="space-y-2 mt-3">
              <Input data-testid="paper-title" placeholder="Paper title (e.g. JEE Physics Mock #3)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Duration</span>
                <Input data-testid="paper-duration" type="number" className="w-24" value={duration} onChange={(e) => setDuration(e.target.value)} />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </div>

            <div className="mt-4 space-y-2 max-h-[40vh] overflow-y-auto en-scroll pr-1">
              {selected.length === 0 && <div className="text-sm text-muted-foreground">Click questions on the left to add them here.</div>}
              {selected.map((q, i) => (
                <div key={q.id} data-testid={`sel-${q.id}`} className="flex items-start gap-2 rounded-lg bg-muted/50 p-2">
                  <span className="text-xs font-bold text-primary w-5 shrink-0">{i + 1}.</span>
                  <div className="text-xs line-clamp-2 flex-1"><MathText>{q.text}</MathText></div>
                  <div className="flex flex-col">
                    <button data-testid={`up-${q.id}`} onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground"><ArrowUp className="h-3 w-3" /></button>
                    <button data-testid={`down-${q.id}`} onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground"><ArrowDown className="h-3 w-3" /></button>
                  </div>
                  <button data-testid={`rm-${q.id}`} onClick={() => toggle(q)} className="text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button data-testid="create-paper-btn" className="rounded-full" disabled={saving} onClick={createPaper}>
                {saving ? "Creating…" : "Generate paper"}
              </Button>
              <Button data-testid="print-paper-btn" variant="outline" className="rounded-full" disabled={selected.length === 0}
                onClick={() => printPaper({ title: title || "Question Paper", duration, questions: selected })}>
                <Printer className="h-4 w-4 mr-2" /> Print / PDF preview
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
