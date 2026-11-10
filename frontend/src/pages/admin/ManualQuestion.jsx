import { useState } from "react";
import { questionsApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Image as ImageIcon, Crop } from "lucide-react";
import { useImageCrop, fileToDataUrl } from "@/components/admin/ImageCropDialog";
import { useNavigate } from "react-router-dom";

const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function ManualQuestion() {
  const [q, setQ] = useState({
    type: "mcq_single", subject: "Physics", chapter: "", topic: "",
    difficulty: "medium", marks: 4, negative_marks: 1,
    text: "", options: ["", "", "", ""], correct: [],
    explanation: "", hint: "", language: "English", status: "approved",
  });
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const [cropImage, cropDialog] = useImageCrop();

  const upd = (k, v) => setQ((x) => ({ ...x, [k]: v }));
  const updOpt = (i, v) => setQ((x) => ({ ...x, options: x.options.map((o, idx) => (idx === i ? v : o)) }));
  // upload → crop → attach (the crop box opens right after choosing the picture)
  const onImage = async (f) => {
    if (!f) return;
    const out = await cropImage(f);
    if (!out) return;
    if (out.size > 4 * 1024 * 1024) return toast.error("Image too large (max 4MB) — crop it smaller");
    try { upd("image_url", await fileToDataUrl(out)); } catch { toast.error("Could not read image"); }
  };
  const recrop = async () => {
    const out = await cropImage(q.image_url);
    if (out) upd("image_url", await fileToDataUrl(out));
  };
  const toggleCorrect = (letter) => {
    if (q.type === "mcq_single" || q.type === "true_false") upd("correct", [letter]);
    else upd("correct", q.correct.includes(letter) ? q.correct.filter(l => l !== letter) : [...q.correct, letter]);
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await questionsApi.create(q);
      toast.success("Question added");
      nav("/admin/questions");
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const isObjective = ["mcq_single", "mcq_multi", "true_false", "assertion_reason"].includes(q.type);

  return (
    <div data-testid="manual-question-page" className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Add</div>
        <h1 className="font-display font-bold text-3xl tracking-tight mt-1">New question</h1>
      </div>
      {cropDialog}
      <Card className="en-card p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={q.type} onValueChange={(v) => upd("type", v)}>
                <SelectTrigger data-testid="q-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq_single">MCQ (single)</SelectItem>
                  <SelectItem value="mcq_multi">MCQ (multi)</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="integer">Integer</SelectItem>
                  <SelectItem value="assertion_reason">Assertion-Reason</SelectItem>
                  <SelectItem value="subjective">Subjective</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={q.subject} onValueChange={(v) => upd("subject", v)}>
                <SelectTrigger data-testid="q-subject"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Physics">Physics</SelectItem>
                  <SelectItem value="Chemistry">Chemistry</SelectItem>
                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                  <SelectItem value="Biology">Biology</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={q.difficulty} onValueChange={(v) => upd("difficulty", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={q.status} onValueChange={(v) => upd("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Chapter</Label><Input value={q.chapter} onChange={(e) => upd("chapter", e.target.value)} /></div>
            <div><Label>Topic</Label><Input value={q.topic} onChange={(e) => upd("topic", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Marks</Label><Input type="number" step="0.5" value={q.marks} onChange={(e) => upd("marks", parseFloat(e.target.value))} /></div>
              <div><Label>-ve</Label><Input type="number" step="0.5" value={q.negative_marks} onChange={(e) => upd("negative_marks", parseFloat(e.target.value))} /></div>
            </div>
          </div>

          <div>
            <Label>Question text</Label>
            <Textarea data-testid="q-text" required rows={3} value={q.text} onChange={(e) => upd("text", e.target.value)} />
          </div>

          <div>
            <Label>Question image <span className="text-muted-foreground font-normal">(optional — diagram/figure shown with the question)</span></Label>
            <div className="mt-1 flex items-center gap-3 flex-wrap">
              <label htmlFor="q-image-input" className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer px-4 py-2 rounded-full border border-border hover:border-primary transition-colors" data-testid="q-image-label">
                <ImageIcon className="h-4 w-4" /> {q.image_url ? "Replace image" : "Upload image"}
                <input id="q-image-input" data-testid="q-image-input" type="file" accept="image/*" className="hidden"
                  onChange={(e) => { onImage(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {q.image_url && (
                <Button type="button" variant="outline" size="sm" className="rounded-full" data-testid="q-image-crop" onClick={recrop}>
                  <Crop className="h-4 w-4 mr-1" /> Crop
                </Button>
              )}
              {q.image_url && (
                <Button type="button" variant="outline" size="sm" className="rounded-full" data-testid="q-image-remove" onClick={() => upd("image_url", null)}>Remove</Button>
              )}
            </div>
            {q.image_url && (
              <img data-testid="q-image-preview" src={q.image_url} alt="Question diagram preview" className="mt-3 max-h-56 rounded-xl border border-border object-contain" />
            )}
          </div>

          {isObjective && q.type !== "assertion_reason" && (
            <div className="space-y-2">
              <Label>Options {q.type === "mcq_multi" && "(tick all correct)"}</Label>
              {(q.type === "true_false" ? ["True", "False"] : q.options).map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleCorrect(OPTION_LETTERS[i])}
                    data-testid={`opt-correct-${i}`}
                    className={`h-9 w-9 rounded-lg border font-display font-bold text-sm ${q.correct.includes(OPTION_LETTERS[i]) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                    {OPTION_LETTERS[i]}
                  </button>
                  {q.type === "true_false"
                    ? <Input value={val} disabled />
                    : <Input value={val} onChange={(e) => updOpt(i, e.target.value)} />}
                </div>
              ))}
            </div>
          )}

          {q.type === "integer" && (
            <div>
              <Label>Correct numeric answer</Label>
              <Input data-testid="q-correct-integer" value={q.correct[0] || ""} onChange={(e) => upd("correct", [e.target.value])} />
            </div>
          )}

          <div>
            <Label>Explanation</Label>
            <Textarea rows={2} value={q.explanation} onChange={(e) => upd("explanation", e.target.value)} />
          </div>

          <div>
            <Label>First-level hint <span className="text-muted-foreground font-normal">(gentle nudge shown when a student spends a Hint Token — keep it a clue, not the answer)</span></Label>
            <Textarea data-testid="q-hint" rows={2} value={q.hint} onChange={(e) => upd("hint", e.target.value)} placeholder="e.g. Think about which conservation law applies here." />
          </div>

          <Button data-testid="save-question-btn" disabled={busy} className="rounded-full">{busy ? "Saving…" : "Save question"}</Button>
        </form>
      </Card>
    </div>
  );
}
