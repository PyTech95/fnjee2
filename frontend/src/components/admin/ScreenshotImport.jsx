import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, importApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, ClipboardPaste, Sparkles, XCircle, CheckCircle2, AlertTriangle, Crop } from "lucide-react";
import ImageCropDialog from "@/components/admin/ImageCropDialog";

/**
 * Screenshot → question. Paste (Ctrl+V), drop or pick screenshots of a question and of its
 * answer/solution; the AI configured in Admin → AI Settings turns them into an editable question
 * that appears in the review list below (onGenerated).
 */
const Zone = ({ id, title, hint, shots, active, onActivate, onAdd, onRemove, onCrop }) => {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div
      data-testid={`shot-zone-${id}`}
      tabIndex={0}
      onClick={onActivate}
      onFocus={onActivate}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onActivate(); onAdd(e.dataTransfer.files); }}
      className={`rounded-2xl border-2 border-dashed p-4 min-h-[180px] outline-none transition-colors cursor-pointer
        ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"} ${over ? "bg-primary/10" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
        <Button type="button" size="sm" variant="outline" className="rounded-full shrink-0"
          onClick={(e) => { e.stopPropagation(); onActivate(); inputRef.current?.click(); }}>
          <Camera className="h-3.5 w-3.5 mr-1.5" /> Choose
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" data-testid={`shot-input-${id}`}
          onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
      </div>
      {shots.length === 0 ? (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <ClipboardPaste className="h-6 w-6 mx-auto mb-1" />
          {active ? <>Press <b>Ctrl + V</b> to paste a screenshot here</> : "Click here, then press Ctrl + V"}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {shots.map((s, i) => (
            <div key={s.url} className="relative">
              <img src={s.url} alt={`${title} ${i + 1}`} className="h-28 max-w-[220px] object-contain rounded border bg-white" />
              <button type="button" aria-label="Crop screenshot" data-testid={`shot-crop-${id}-${i}`}
                onClick={(e) => { e.stopPropagation(); onCrop(i); }}
                className="absolute bottom-1 right-1 bg-background/90 rounded-full p-1 border shadow-sm">
                <Crop className="h-4 w-4 text-primary" />
              </button>
              <button type="button" aria-label="Remove screenshot" data-testid={`shot-remove-${id}-${i}`}
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                className="absolute -top-2 -right-2 bg-background rounded-full">
                <XCircle className="h-5 w-5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ScreenshotImport({ onGenerated, pollImportJob }) {
  const [qShots, setQShots] = useState([]);
  const [aShots, setAShots] = useState([]);
  const [active, setActive] = useState("q");
  const [fields, setFields] = useState({ subject: "auto", chapter: "", student_class: "", exam: "" });
  const [attach, setAttach] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [ai, setAi] = useState(null); // null = loading; {ready, label}

  useEffect(() => {
    api.get("/admin/settings/ai")
      .then((r) => setAi({ ready: Boolean(r.data?.masked_key), label: `${r.data?.provider || "AI"} · ${r.data?.effective_model || r.data?.model || ""}` }))
      .catch(() => setAi({ ready: false, label: "" }));
  }, []);

  // crop: {zone, index (null = new shot), file, url}
  const [crop, setCrop] = useState(null);
  const addFiles = useCallback((list, zone) => {
    const imgs = Array.from(list || []).filter((f) => f && f.type?.startsWith("image/"));
    if (!imgs.length) return;
    if (imgs.length === 1) {           // one screenshot: let the user cut out just the question first
      setCrop({ zone, index: null, file: imgs[0], url: URL.createObjectURL(imgs[0]) });
      return;
    }
    const items = imgs.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    (zone === "a" ? setAShots : setQShots)((prev) => [...prev, ...items].slice(0, 6));
  }, []);
  const openCrop = (zone, index) => {
    const s = (zone === "a" ? aShots : qShots)[index];
    if (s) setCrop({ zone, index, file: s.file, url: s.url });
  };
  const cropDone = (file) => {
    const c = crop;
    setCrop(null);
    if (!c || !file) return;
    const item = { file, url: file === c.file ? c.url : URL.createObjectURL(file) };
    const set = c.zone === "a" ? setAShots : setQShots;
    set((prev) => {
      if (c.index === null) return [...prev, item].slice(0, 6);
      const n = [...prev];
      n[c.index] = item;
      return n;
    });
  };

  // Ctrl+V anywhere on the page drops the screenshot into the active box
  useEffect(() => {
    const onPaste = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const files = Array.from(e.clipboardData?.items || [])
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile()).filter(Boolean);
      if (!files.length) return;
      if (tag === "textarea" || tag === "input") e.preventDefault();
      addFiles(files, active);
      toast.success(active === "a" ? "Answer screenshot added" : "Question screenshot added");
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [active, addFiles]);

  const clearShots = () => {
    [...qShots, ...aShots].forEach((s) => URL.revokeObjectURL(s.url));
    setQShots([]); setAShots([]); setActive("q");
  };

  const generate = async () => {
    if (!qShots.length) return toast.error("Paste the question screenshot first");
    setBusy(true);
    setProgress({ pct: 3, msg: "Uploading screenshots…" });
    try {
      const fd = new FormData();
      qShots.forEach((s, i) => fd.append("question_images", s.file, s.file.name || `question-${i + 1}.png`));
      aShots.forEach((s, i) => fd.append("answer_images", s.file, s.file.name || `answer-${i + 1}.png`));
      if (fields.subject && fields.subject !== "auto") fd.append("subject_default", fields.subject);
      if (fields.chapter.trim()) fd.append("chapter_default", fields.chapter.trim());
      if (fields.student_class.trim()) fd.append("class_default", fields.student_class.trim());
      if (fields.exam.trim()) fd.append("exam_default", fields.exam.trim());
      fd.append("attach_screenshot", attach ? "true" : "false");
      const { job_id } = await importApi.screenshotStart(fd);
      const r = await pollImportJob(job_id, (p) => setProgress(p));
      const qs = r.questions || [];
      if (qs.length) {
        onGenerated(qs, r.errors || []);
        toast.success(`${qs.length} question(s) generated — check below and save`);
        clearShots();
      } else {
        toast.error(r.errors?.[0] || "No question found in the screenshot");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Could not generate the question");
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  return (
    <Card data-testid="screenshot-import" className="en-card p-6 space-y-5">
      <ImageCropDialog open={!!crop} file={crop?.file} url={crop?.url}
        onCancel={() => setCrop(null)} onDone={cropDone} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-lg">Screenshot se question</h3>
          <p className="text-sm text-muted-foreground">
            Question ka screenshot aur answer/solution ka screenshot paste karein → sirf ek question <b>crop</b> karein → <b>Generate</b> → question neeche dikhega, check karke save karein.
          </p>
        </div>
        <div data-testid="ai-status" className={`text-xs rounded-full px-3 py-1.5 border flex items-center gap-1.5
          ${ai?.ready ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/5" : "border-amber-500/40 text-amber-700 bg-amber-500/5"}`}>
          {ai === null ? "Checking AI…" : ai.ready
            ? <><CheckCircle2 className="h-3.5 w-3.5" /> AI ready · {ai.label}</>
            : <><AlertTriangle className="h-3.5 w-3.5" /> AI key not set — <Link to="/admin/settings" className="underline font-medium">open AI Settings</Link></>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Zone id="q" title="1. Question screenshot" hint="Question with its options (one or more images)"
          shots={qShots} active={active === "q"} onActivate={() => setActive("q")}
          onAdd={(f) => addFiles(f, "q")} onRemove={(i) => setQShots((p) => p.filter((_, j) => j !== i))} onCrop={(i) => openCrop("q", i)} />
        <Zone id="a" title="2. Answer / solution screenshot" hint="Optional — answer key or worked solution"
          shots={aShots} active={active === "a"} onActivate={() => setActive("a")}
          onAdd={(f) => addFiles(f, "a")} onRemove={(i) => setAShots((p) => p.filter((_, j) => j !== i))} onCrop={(i) => openCrop("a", i)} />
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Subject</Label>
          <Select value={fields.subject} onValueChange={(v) => setFields((f) => ({ ...f, subject: v }))}>
            <SelectTrigger data-testid="shot-subject"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (detect)</SelectItem>
              <SelectItem value="Physics">Physics</SelectItem>
              <SelectItem value="Chemistry">Chemistry</SelectItem>
              <SelectItem value="Mathematics">Mathematics</SelectItem>
              <SelectItem value="Biology">Biology</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Chapter</Label><Input data-testid="shot-chapter" value={fields.chapter} placeholder="auto" onChange={(e) => setFields((f) => ({ ...f, chapter: e.target.value }))} /></div>
        <div><Label className="text-xs">Class</Label><Input data-testid="shot-class" value={fields.student_class} placeholder="e.g. 11" onChange={(e) => setFields((f) => ({ ...f, student_class: e.target.value }))} /></div>
        <div><Label className="text-xs">Exam</Label><Input data-testid="shot-exam" value={fields.exam} placeholder="e.g. NEET / JEE Main" onChange={(e) => setFields((f) => ({ ...f, exam: e.target.value }))} /></div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" data-testid="shot-attach" className="h-4 w-4 accent-primary" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
        Question screenshot ko picture ki tarah bhi question ke saath lagayein (diagram wale questions ke liye AI khud figure kaat leta hai)
      </label>

      {progress && (
        <div className="space-y-1" data-testid="shot-progress">
          <Progress value={Math.max(0, Math.min(100, progress.pct || 0))} />
          <div className="text-xs text-muted-foreground">{progress.msg}</div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {(qShots.length > 0 || aShots.length > 0) && (
          <Button type="button" variant="outline" className="rounded-full" onClick={clearShots} disabled={busy}>Clear</Button>
        )}
        <Button data-testid="shot-generate" className="rounded-full px-8" onClick={generate} disabled={busy || !qShots.length || ai?.ready === false}>
          <Sparkles className="h-4 w-4 mr-2" /> {busy ? "Generating…" : "Generate question"}
        </Button>
      </div>
    </Card>
  );
}
