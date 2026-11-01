import { useEffect, useMemo, useState } from "react";
import { questionsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import MathText from "@/components/MathText";
import { QuestionImage } from "@/components/QuestionContent";
import { SUBJECTS, classLabel } from "@/lib/bank";

const TYPES = [["mcq_single", "MCQ (single)"], ["mcq_multi", "MCQ (multi)"], ["integer", "Integer / numerical"],
  ["true_false", "True/False"], ["assertion_reason", "Assertion-Reason"], ["match", "Match"], ["subjective", "Subjective"]];
const OPTION_TYPES = new Set(["mcq_single", "mcq_multi", "true_false", "assertion_reason", "match", "image"]);
const FIELDS = ["text", "options", "correct", "explanation", "hint", "type", "subject", "student_class", "chapter",
  "topic", "difficulty", "marks", "negative_marks", "status", "exam", "year", "source", "tags", "language", "image_url"];
const L = (i) => String.fromCharCode(65 + i);

function fromQuestion(q) {
  return {
    text: q.text || "", options: [...(q.options || [])], correct: [...(q.correct || [])],
    explanation: q.explanation || "", hint: q.hint || "", type: q.type || "mcq_single", subject: q.subject || "",
    student_class: q.student_class || "", chapter: q.chapter || "", topic: q.topic || "",
    difficulty: q.difficulty || "medium", marks: q.marks ?? 4, negative_marks: q.negative_marks ?? 1,
    status: q.status || "approved", exam: q.exam || "", year: q.year || "", source: q.source || "",
    tags: (q.tags || []).join(", "), language: q.language || "English", image_url: q.image_url || null,
  };
}

/** Edit one question in place (text, options, answer, solution, tags, status …) with a live preview. */
export default function QuestionEditDialog({ question, open, onOpenChange, onSaved, syllabus }) {
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (question && open) setF(fromQuestion(question)); }, [question, open]);

  const chapters = useMemo(() => {
    if (!f || !syllabus) return [];
    const by = syllabus[f.subject] || {};
    return [...new Set(Object.entries(by).filter(([c]) => !f.student_class || c === f.student_class).flatMap(([, l]) => l))];
  }, [f, syllabus]);

  if (!f) return null;
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const hasOptions = OPTION_TYPES.has(f.type);
  const multi = f.type === "mcq_multi";
  const toggleCorrect = (letter) => set({
    correct: multi
      ? (f.correct.includes(letter) ? f.correct.filter((c) => c !== letter) : [...f.correct, letter].sort())
      : [letter],
  });
  const setOption = (i, v) => set({ options: f.options.map((o, j) => (j === i ? v : o)) });
  const removeOption = (i) => {
    const letter = L(i);
    const remap = (c) => (c.length === 1 && c >= "A" && c <= "Z" ? (c === letter ? null : c > letter ? L(c.charCodeAt(0) - 66) : c) : c);
    set({ options: f.options.filter((_, j) => j !== i), correct: f.correct.map(remap).filter(Boolean) });
  };

  const save = async () => {
    if (!f.text.trim()) return toast.error("Question text is required");
    if (!f.subject) return toast.error("Choose a subject");
    const next = {
      ...f, marks: Number(f.marks) || 0, negative_marks: Number(f.negative_marks) || 0,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      options: hasOptions ? (() => { const o = f.options.map((x) => x.trim()); while (o.length && !o[o.length - 1]) o.pop(); return o; })() : [],
      correct: hasOptions ? f.correct : f.type === "subjective" ? [] : f.correct.map((c) => String(c).trim()).filter(Boolean),
    };
    const prev = fromQuestion(question);
    prev.tags = question.tags || [];
    const patch = {};
    FIELDS.forEach((k) => { if (JSON.stringify(next[k]) !== JSON.stringify(prev[k])) patch[k] = next[k]; });
    if (!Object.keys(patch).length) { onOpenChange(false); return; }
    setSaving(true);
    try {
      const saved = await questionsApi.patch(question.id, patch);
      toast.success("Question saved");
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="question-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
          <DialogDescription>Formulas in LaTeX between $ signs, e.g. $v = u + at$. The preview on the right updates as you type.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1"><Label>Subject</Label>
                <Select value={f.subject} onValueChange={(v) => set({ subject: v })}>
                  <SelectTrigger data-testid="qe-subject"><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>{[...new Set([...SUBJECTS, f.subject].filter(Boolean))].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Class</Label>
                <Select value={f.student_class || "none"} onValueChange={(v) => set({ student_class: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="qe-class"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {[...new Set(["11", "12", "Dropper", f.student_class].filter(Boolean))].map((c) => <SelectItem key={c} value={c}>{classLabel(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2"><Label>Chapter</Label>
                <Input data-testid="qe-chapter" list="qe-chapters" value={f.chapter} onChange={(e) => set({ chapter: e.target.value })} placeholder="e.g. Laws of Motion" />
                <datalist id="qe-chapters">{chapters.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="space-y-1 col-span-2"><Label>Topic</Label>
                <Input data-testid="qe-topic" value={f.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="e.g. Friction" />
              </div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={f.type} onValueChange={(v) => set({ type: v, correct: v === "mcq_multi" || OPTION_TYPES.has(v) === OPTION_TYPES.has(f.type) ? f.correct : [] })}>
                  <SelectTrigger data-testid="qe-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Level</Label>
                <Select value={f.difficulty} onValueChange={(v) => set({ difficulty: v })}>
                  <SelectTrigger data-testid="qe-difficulty"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1"><Label>Question</Label>
              <Textarea data-testid="qe-text" rows={5} value={f.text} onChange={(e) => set({ text: e.target.value })} />
            </div>

            {f.image_url && (
              <div className="flex items-start gap-3 rounded-lg border p-2">
                <div className="max-w-[220px]"><QuestionImage src={f.image_url} alt="Question picture" testId="qe-image" /></div>
                <Button type="button" size="sm" variant="ghost" onClick={() => set({ image_url: null })}><ImageOff className="h-4 w-4 mr-1" /> Remove picture</Button>
              </div>
            )}

            {hasOptions ? (
              <div className="space-y-2">
                <Label>Options — tick the correct {multi ? "answers" : "answer"}</Label>
                {f.options.map((o, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Checkbox className="mt-2.5" checked={f.correct.includes(L(i))} onCheckedChange={() => toggleCorrect(L(i))} data-testid={`qe-correct-${L(i)}`} aria-label={`Option ${L(i)} is correct`} />
                    <span className="mt-2 w-5 text-sm font-semibold">{L(i)}.</span>
                    <Textarea rows={1} className="min-h-9" value={o} onChange={(e) => setOption(i, e.target.value)} data-testid={`qe-option-${L(i)}`} />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeOption(i)} aria-label="Remove option"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                {f.options.length < 6 && (
                  <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => set({ options: [...f.options, ""] })}><Plus className="h-4 w-4 mr-1" /> Add option</Button>
                )}
              </div>
            ) : f.type !== "subjective" && (
              <div className="space-y-1"><Label>Correct answer</Label>
                <Input data-testid="qe-answer" value={f.correct.join(", ")} onChange={(e) => set({ correct: e.target.value ? [e.target.value] : [] })} placeholder="e.g. 42 or 2.5" />
              </div>
            )}

            <div className="space-y-1"><Label>Solution</Label>
              <Textarea data-testid="qe-explanation" rows={4} value={f.explanation} onChange={(e) => set({ explanation: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1"><Label>Marks</Label><Input type="number" step="0.5" value={f.marks} onChange={(e) => set({ marks: e.target.value })} /></div>
              <div className="space-y-1"><Label>Negative</Label><Input type="number" step="0.25" value={f.negative_marks} onChange={(e) => set({ negative_marks: e.target.value })} /></div>
              <div className="space-y-1"><Label>Exam</Label><Input value={f.exam} onChange={(e) => set({ exam: e.target.value })} placeholder="JEE Main" /></div>
              <div className="space-y-1"><Label>Year</Label><Input value={f.year} onChange={(e) => set({ year: e.target.value })} placeholder="2024" /></div>
              <div className="space-y-1 col-span-2"><Label>Source</Label><Input value={f.source} onChange={(e) => set({ source: e.target.value })} placeholder="DPP 05" /></div>
              <div className="space-y-1 col-span-2"><Label>Tags (comma)</Label><Input value={f.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="pyq, important" /></div>
              <div className="space-y-1"><Label>Language</Label>
                <Select value={f.language} onValueChange={(v) => set({ language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[...new Set(["English", "Hindi", f.language])].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Status</Label>
                <Select value={f.status} onValueChange={(v) => set({ status: v })}>
                  <SelectTrigger data-testid="qe-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem><SelectItem value="review">Review</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem><SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* live preview */}
          <div className="rounded-xl border bg-muted/30 p-4 h-fit lg:sticky lg:top-0 space-y-3 text-sm" data-testid="qe-preview">
            <div className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Preview</div>
            <div className="font-medium whitespace-pre-wrap"><MathText>{f.text}</MathText></div>
            {hasOptions && f.options.map((o, i) => (
              <div key={i} className={`rounded-md px-2 py-1 ${f.correct.includes(L(i)) ? "bg-emerald-500/10 text-emerald-800" : ""}`}>
                <b>{L(i)}.</b> <MathText>{o}</MathText>
              </div>
            ))}
            {!hasOptions && f.type !== "subjective" && <div className="text-emerald-700">Answer: {f.correct.join(", ") || "—"}</div>}
            {f.explanation && <div className="border-t pt-2 text-muted-foreground"><MathText>{f.explanation}</MathText></div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="qe-save" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save question"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
