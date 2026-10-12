import { useState } from "react";
import { importApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, FileText, FileImage, CheckCircle2, AlertTriangle, Zap, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { QuestionContent, QuestionImage } from "@/components/QuestionContent";
import MathText from "@/components/MathText";

const FORMATS = [
  { icon: FileSpreadsheet, name: "Excel", exts: ".xlsx,.xls" },
  { icon: FileText, name: "Word", exts: ".docx" },
  { icon: FileImage, name: "PDF", exts: ".pdf" },
  { icon: FileImage, name: "Image / Scan", exts: ".jpg,.png,.webp" },
  { icon: FileText, name: "PowerPoint", exts: ".pptx" },
  { icon: FileText, name: "Text / CSV / HTML", exts: ".txt,.csv,.html,.rtf" },
  { icon: FileText, name: "PageMaker", exts: ".pmd,.p65,.pm6,.pm7" },
];

export default function ImportWizard() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [uploadMode, setUploadMode] = useState("upload"); // upload | upload_ai
  const [generating, setGenerating] = useState(false);
  const [subjectDefault, setSubjectDefault] = useState("Physics");
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [rows, setRows] = useState([]);
  // Optional batch categorisation — applied to every imported question.
  // Blank / "auto" means "keep what the AI detected". If set, it overrides.
  const [cat, setCat] = useState({
    type: "auto", difficulty: "auto", status: "approved",
    chapter: "", topic: "", section: "", exam: "", student_class: "", year: "",
    tags: "", marks: "", negative_marks: "",
  });
  const updCat = (k, v) => setCat((x) => ({ ...x, [k]: v }));
  const nav = useNavigate();

  // Poll a background import job until it finishes. Keeps the HTTP requests short
  // so the platform's 60s gateway timeout never fires on long AI extractions.
  const pollImportJob = async (jobId) => {
    const started = Date.now();
    const TIMEOUT_MS = 60 * 60 * 1000; // 60 min ceiling — big files can take a long time
    while (Date.now() - started < TIMEOUT_MS) {
      await new Promise((res) => setTimeout(res, 2500));
      let job;
      try {
        job = await importApi.jobStatus(jobId);
      } catch (e) {
        if (e?.response?.status === 404) continue; // not visible yet
        throw e;
      }
      if (job.status === "done") return job.result;
      if (job.status === "error") throw new Error(job.error || "Extraction failed");
    }
    throw new Error("Extraction timed out — try a smaller file or split the document.");
  };

  const isMissingAnswer = (q) =>
    q.type === "subjective" ? !String(q.explanation || "").trim() : !(q.correct || []).length;

  const generateAnswers = async (questionRows) => {
    const missing = questionRows.filter(isMissingAnswer).length;
    if (!missing) {
      toast.info("All extracted questions already have answers");
      return;
    }
    setGenerating(true);
    try {
      // Only send question text/options. Keep full original rows (including diagrams)
      // in the browser and merge each generated answer back by its index.
      const payload = questionRows.map((q) => ({
        type: q.type, subject: q.subject, text: q.text,
        options: q.options || [], correct: q.correct || [],
        explanation: q.explanation || "", has_image: Boolean(q.image_url),
      }));
      const { job_id } = await importApi.answerStart(payload);
      const result = await pollImportJob(job_id);
      const answers = new Map((result.answers || []).map((a) => [a.index, a]));
      setRows((prev) => prev.map((q, i) => {
        const answer = answers.get(i);
        if (!answer || !isMissingAnswer(q)) return q;
        const { index, ...patch } = answer;
        return { ...q, ...patch };
      }));
      toast.success(`Generated ${result.generated_count || 0} answers for review`);
      if (result.warnings?.length) toast.warning(`${result.warnings.length} question(s) need manual review`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "AI answer generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const runParse = async () => {
    if (!file) return toast.error("Choose a question paper first");
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Visual extraction preserves PDF questions, options, diagrams and printed keys.
      // Word/Excel use existing text/tabular parsing with AI fallback.
      if (/\.pdf$/i.test(file.name)) fd.append("prefer_ai", "true");
      fd.append("subject_default", subjectDefault);
      // Optional batch categorisation — only send fields the admin actually set.
      if (cat.type && cat.type !== "auto") fd.append("type_default", cat.type);
      if (cat.difficulty && cat.difficulty !== "auto") fd.append("difficulty_default", cat.difficulty);
      if (cat.status) fd.append("status_default", cat.status);
      if (cat.chapter.trim()) fd.append("chapter_default", cat.chapter.trim());
      if (cat.topic.trim()) fd.append("topic_default", cat.topic.trim());
      if (cat.section.trim()) fd.append("section_default", cat.section.trim());
      if (cat.exam.trim()) fd.append("exam_default", cat.exam.trim());
      if (cat.student_class.trim()) fd.append("class_default", cat.student_class.trim());
      if (cat.year.trim()) fd.append("year_default", cat.year.trim());
      if (cat.tags.trim()) fd.append("tags_default", cat.tags.trim());
      if (String(cat.marks).trim() !== "") fd.append("marks_default", cat.marks);
      if (String(cat.negative_marks).trim() !== "") fd.append("negative_default", cat.negative_marks);
      fd.append("use_ai", "true");
      fd.append("import_mode", "extract");
      // Start the job in the background and poll — avoids the 60s gateway timeout
      // on long AI extractions (big PDFs/DOCX). The AI does the whole job server-side.
      const { job_id } = await importApi.start(fd);
      const r = await pollImportJob(job_id);
      setParsed(r);
      const extracted = (r.questions || []).map((q) => ({ ...q, _include: true }));
      setRows(extracted);
      setStep(3);
      if (uploadMode === "upload_ai" && extracted.length) {
        await generateAnswers(extracted);
      }
      if (r.count > 0) {
        const badge = r.used_regex && !r.used_ai ? " (fast regex)" : r.used_ai ? " (AI-assisted)" : "";
        toast.success(`Detected ${r.count} question(s)${badge}`);
        if (r.answer_key_applied > 0) toast.success(`Answer key matched ${r.answer_key_applied} question(s)`);
      } else if (r.errors?.length) {
        toast.warning("No questions detected — see notes below");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Extraction failed");
    } finally { setParsing(false); }
  };

  const commit = async () => {
    const selected = rows.filter((r) => r._include).map(({ _include, duplicate, id_tmp, ...rest }) => ({
      ...rest,
      status: rest.answer_review_required || isMissingAnswer(rest) ? "review" :
        cat.status === "draft" || cat.status === "archived" || cat.status === "review" ? cat.status : "approved",
    }));
    if (!selected.length) return toast.error("Select at least one question");
    setCommitting(true);
    try {
      const r = await importApi.commit(selected);
      if (r.inserted > 0 && r.skipped > 0) {
        toast.success(`Saved ${r.inserted} · Skipped ${r.skipped} (empty or malformed)`);
      } else if (r.inserted > 0) {
        toast.success(`Saved ${r.inserted} question(s) to bank`);
      } else {
        toast.error(`Nothing saved. ${r.skipped_details?.[0]?.reason || "Please check the rows."}`);
        setCommitting(false); return;
      }
      nav("/admin/questions");
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Save failed");
    } finally { setCommitting(false); }
  };

  const updateRow = (i, patch) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addBlankRow = () => setRows((prev) => [...prev, {
    _include: true, type: "mcq_single", subject: subjectDefault, chapter: "", topic: "",
    difficulty: "medium", marks: 4, negative_marks: 1, text: "", options: ["", "", "", ""], correct: [],
    explanation: "", language: "English", status: "approved",
  }]);
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const setAllIncluded = (val) => setRows((prev) => prev.map((r) => ({ ...r, _include: val })));
  const fileToDataUrl = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(f);
  });
  const attachRowImage = async (i, f) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) return toast.error("Image too large (max 4MB)");
    try { updateRow(i, { image_url: await fileToDataUrl(f) }); toast.success("Image attached"); }
    catch { toast.error("Could not read image"); }
  };

  const includedCount = rows.filter((r) => r._include).length;

  return (
    <div data-testid="import-wizard-page" className="space-y-6 max-w-6xl mx-auto">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Import wizard</div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Bring your question paper in.</h1>
        <p data-testid="import-description" className="text-muted-foreground mt-1">Question papers & solutions · Tables, diagrams and formulas</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        {["Upload", "Detect & parse", "Review & save"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div data-testid={`step-${i + 1}`} className={`h-8 w-8 rounded-full grid place-items-center text-sm font-semibold ${step >= i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
            <span className={`text-xs sm:text-sm ${step >= i + 1 ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < 2 && <div className="hidden sm:block w-8 h-px bg-border ml-2" />}
          </div>
        ))}
      </div>

      {step <= 2 && (
        <Card className="en-card p-6 space-y-6">
          <div>
            <Label className="text-sm font-semibold">Supported formats</Label>
            <div className="flex flex-wrap gap-2 mt-3">
              {FORMATS.map((f) => (
                <div key={f.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm">
                  <f.icon className="h-4 w-4 text-primary" /> {f.name}
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3" data-testid="upload-modes">
            <button type="button" data-testid="mode-upload" onClick={() => setUploadMode("upload")}
              className={`text-left rounded-2xl border-2 p-4 ${uploadMode === "upload" ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Upload</div>
              <p className="mt-1 text-xs text-muted-foreground">Extract original questions and available answers</p>
            </button>
            <button type="button" data-testid="mode-upload-ai" onClick={() => setUploadMode("upload_ai")}
              className={`text-left rounded-2xl border-2 p-4 ${uploadMode === "upload_ai" ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="font-semibold flex items-center gap-2"><Zap className="h-4 w-4" /> Upload + AI Generate Answers</div>
              <p className="mt-1 text-xs text-muted-foreground">Generate missing answers with configured Gemini AI</p>
            </button>
          </div>

          <label htmlFor="file-input" className="block cursor-pointer border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-primary transition-colors duration-200">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="mt-3 font-medium">{file ? file.name : "Click to choose a question paper"}</div>
            <div className="text-xs text-muted-foreground mt-1">PDF · Word · Excel · PowerPoint · Images · Text · PageMaker</div>
            <input data-testid="file-input" id="file-input" type="file" className="hidden"
              accept=".xlsx,.xls,.docx,.pdf,.pptx,.pmd,.p65,.pm6,.pm7,.txt,.csv,.tsv,.rtf,.md,.html,.htm,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,.heic,.heif"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Default subject</Label>
              <Select value={subjectDefault} onValueChange={setSubjectDefault}>
                <SelectTrigger data-testid="default-subject"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Physics">Physics</SelectItem>
                  <SelectItem value="Chemistry">Chemistry</SelectItem>
                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                  <SelectItem value="Biology">Biology</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3" data-testid="import-categorise-block">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">Categorise imported questions <span className="text-muted-foreground font-normal">(optional) — anything you set here is applied to every question in this file. Leave blank to keep what's detected.</span></Label>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={cat.type} onValueChange={(v) => updCat("type", v)}>
                  <SelectTrigger data-testid="cat-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (detect)</SelectItem>
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
                <Label className="text-xs">Difficulty</Label>
                <Select value={cat.difficulty} onValueChange={(v) => updCat("difficulty", v)}>
                  <SelectTrigger data-testid="cat-difficulty"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (detect)</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={cat.status} onValueChange={(v) => updCat("status", v)}>
                  <SelectTrigger data-testid="cat-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Chapter</Label><Input data-testid="cat-chapter" value={cat.chapter} onChange={(e) => updCat("chapter", e.target.value)} placeholder="e.g. Hydrocarbons" /></div>
              <div><Label className="text-xs">Topic</Label><Input data-testid="cat-topic" value={cat.topic} onChange={(e) => updCat("topic", e.target.value)} placeholder="e.g. Alkanes" /></div>
              <div><Label className="text-xs">Section</Label><Input data-testid="cat-section" value={cat.section} onChange={(e) => updCat("section", e.target.value)} placeholder="e.g. Section A" /></div>
              <div><Label className="text-xs">Exam</Label><Input data-testid="cat-exam" value={cat.exam} onChange={(e) => updCat("exam", e.target.value)} placeholder="e.g. NEET / JEE" /></div>
              <div><Label className="text-xs">Class</Label><Input data-testid="cat-class" value={cat.student_class} onChange={(e) => updCat("student_class", e.target.value)} placeholder="e.g. 11" /></div>
              <div><Label className="text-xs">Year</Label><Input data-testid="cat-year" value={cat.year} onChange={(e) => updCat("year", e.target.value)} placeholder="e.g. 2025" /></div>
              <div><Label className="text-xs">Tags <span className="text-muted-foreground">(comma-sep)</span></Label><Input data-testid="cat-tags" value={cat.tags} onChange={(e) => updCat("tags", e.target.value)} placeholder="e.g. pyq, important" /></div>
              <div><Label className="text-xs">Marks</Label><Input data-testid="cat-marks" type="number" step="0.5" value={cat.marks} onChange={(e) => updCat("marks", e.target.value)} placeholder="keep" /></div>
              <div><Label className="text-xs">Negative</Label><Input data-testid="cat-negative" type="number" step="0.5" value={cat.negative_marks} onChange={(e) => updCat("negative_marks", e.target.value)} placeholder="keep" /></div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button data-testid="parse-btn" onClick={runParse} disabled={parsing} className="rounded-full px-8">
              <Zap className="h-4 w-4 mr-2" /> {parsing ? "Processing…" : uploadMode === "upload_ai" ? "Upload + Generate Answers" : "Upload & Extract Questions"}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && parsed && (
        <Card className="en-card p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-display font-semibold text-lg">Review & save</h3>
              <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                <span>{parsed.count} detected in <b>{parsed.filename}</b> · {includedCount} selected</span>
                {parsed.used_regex && <Badge variant="secondary" className="rounded-full">Fast regex</Badge>}
                {parsed.used_ai && <Badge variant="secondary" className="rounded-full">AI-assisted</Badge>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" data-testid="generate-missing-answers"
                  onClick={() => generateAnswers(rows)}
                  disabled={generating || committing || !rows.some(isMissingAnswer)}
                  className="rounded-full">
                  <Zap className="h-4 w-4 mr-2" />
                  {generating ? "Generating answers…" : "Generate Missing Answers with AI"}
                </Button>
                <Button variant="outline" className="rounded-full" onClick={() => setAllIncluded(true)} data-testid="select-all-rows">Select all</Button>
              <Button variant="outline" className="rounded-full" onClick={() => setAllIncluded(false)} data-testid="deselect-all-rows">Deselect all</Button>
              <Button variant="outline" className="rounded-full" onClick={addBlankRow} data-testid="add-blank-row">
                + Add question
              </Button>
              <Button data-testid="import-start-over" variant="outline" className="rounded-full" onClick={() => { setStep(1); setParsed(null); setRows([]); }}>Start over</Button>
              <Button data-testid="commit-import" className="rounded-full" onClick={commit} disabled={committing || generating || includedCount === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> {committing ? "Saving…" : `Submit & save ${includedCount} question(s)`}
              </Button>
            </div>
          </div>

          {parsed.errors?.length > 0 && (
            <div data-testid="parse-warnings" className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-sm space-y-1">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-1">{parsed.errors.slice(0, 4).map((e, i) => <div key={i}>{e}</div>)}</div>
              </div>
            </div>
          )}

          <div className="space-y-3 max-h-[65vh] overflow-y-auto en-scroll pr-1">
            {rows.map((r, i) => (
              <div key={i} data-testid={`review-row-${i}`}
                   className={`p-4 rounded-xl border ${r._include ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <div className="flex items-start gap-3">
                  <input data-testid={`row-check-${i}`} type="checkbox" checked={!!r._include}
                    onChange={(e) => updateRow(i, { _include: e.target.checked })}
                    className="mt-1.5 h-4 w-4 accent-primary" />
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-semibold text-sm">Question {r.source_number || i + 1}</span>
                      <Badge variant="secondary" className="rounded-full">{r.type}</Badge>
                      <Badge variant="outline" className="rounded-full">{r.subject}</Badge>
                      <Badge variant="outline" className="rounded-full">{r.difficulty}</Badge>
                      {r.answer_origin === "ai_generated" && <Badge variant="outline">Gemini answer · {r.answer_review_required ? "review" : "approved"}</Badge>}
                      {isMissingAnswer(r) && <Badge variant="outline">Answer missing</Badge>}
                      {r.duplicate && <Badge className="rounded-full bg-amber-500/10 text-amber-700 border-amber-500/30" variant="outline">Duplicate</Badge>}
                      <button onClick={() => removeRow(i)} className="ml-auto text-xs text-destructive hover:underline" data-testid={`remove-row-${i}`}>Remove</button>
                    </div>
                    <Textarea data-testid={`row-text-${i}`} value={r.text}
                      onChange={(e) => updateRow(i, { text: e.target.value })} className="text-sm" rows={2} />
                    <QuestionContent question={r} testId={`import-preview-${i}`} className="text-sm" />
                    <div className="flex items-center gap-2">
                      <label htmlFor={`row-image-${i}`} className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-full border border-border hover:border-primary transition-colors" data-testid={`row-image-label-${i}`}>
                        <ImageIcon className="h-3.5 w-3.5" /> {r.image_url ? "Replace image" : "Add image"}
                        <input id={`row-image-${i}`} data-testid={`row-image-${i}`} type="file" accept="image/*" className="hidden"
                          onChange={(e) => attachRowImage(i, e.target.files?.[0])} />
                      </label>
                      {r.image_url && <Button data-testid={`remove-image-${i}`} type="button" size="sm" variant="outline" onClick={() => updateRow(i, { image_url: null })}>Remove image</Button>}
                    </div>
                    {r.options?.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {r.options.map((opt, oi) => {
                          const letter = String.fromCharCode(65 + oi);
                          const isCorrect = (r.correct || []).some((c) => String(c).trim().toUpperCase() === letter);
                          return (
                            <div key={oi} className="flex items-center gap-2">
                              <button onClick={() => {
                                const correct = new Set(r.correct || []);
                                if (r.type !== "mcq_multi") {
                                  updateRow(i, { correct: isCorrect ? [] : [letter], answer_review_required: false, status: "review" });
                                } else {
                                  if (isCorrect) correct.delete(letter); else correct.add(letter);
                                  updateRow(i, { correct: [...correct], answer_review_required: false, status: "review" });
                                }
                              }} data-testid={`row-${i}-opt-${letter}-toggle`}
                                className={`h-7 w-7 rounded-full text-xs font-bold grid place-items-center border shrink-0 ${
                                  isCorrect ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                                }`}>{letter}</button>
                              <Input value={opt} data-testid={`row-${i}-opt-${letter}-input`}
                                onChange={(e) => { const opts = [...r.options]; opts[oi] = e.target.value; updateRow(i, { options: opts }); }} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {r.type === "integer" && (
                      <div>
                        <Label className="text-xs">Numerical answer</Label>
                        <Input value={(r.correct || [])[0] || ""}
                          onChange={(e) => updateRow(i, { correct: e.target.value ? [e.target.value] : [],
                            answer_review_required: false, status: "review" })} />
                      </div>
                    )}
                    {r.answer_review_required && !isMissingAnswer(r) && (
                      <Button variant="outline" size="sm" onClick={() => updateRow(i, {
                        answer_review_required: false, status: "approved",
                      })}>Approve checked AI answer</Button>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs items-center">
                      <div><b>Correct:</b> {(r.correct || []).join(", ") || "—"}</div>
                      <div><b>Marks:</b> {r.marks}</div>
                      <div><b>-ve:</b> {r.negative_marks}</div>
                      {r.chapter && <div><b>Chapter:</b> {r.chapter}</div>}
                    </div>
                    {(r.explanation || r.explanation_image_url) && <details data-testid={`import-solution-${i}`}>
                      <summary data-testid={`import-solution-toggle-${i}`} className="cursor-pointer text-sm font-medium">Solution preview</summary>
                      <Textarea className="mt-2" rows={3} value={r.explanation || ""}
                        onChange={(e) => updateRow(i, { explanation: e.target.value, status: "review" })} />
                      <div className="mt-3 text-sm"><MathText>{r.explanation}</MathText>
                        <QuestionImage src={r.explanation_image_url} alt="Source solution illustration" testId={`import-solution-image-${i}`} />
                      </div>
                    </details>}
                  </div>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No questions parsed.
                <Button variant="link" onClick={addBlankRow} className="ml-2">Add one manually →</Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
