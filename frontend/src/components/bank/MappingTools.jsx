import { useEffect, useRef, useState } from "react";
import { questionsApi, importApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Sparkles, Wand2, Clock } from "lucide-react";
import { toast } from "sonner";

const JOB_KEY = "fnjee_autotag_job";
const store = {
  get: () => { try { return localStorage.getItem(JOB_KEY); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(JOB_KEY, v) : localStorage.removeItem(JOB_KEY); } catch { /* ignore */ } },
};

/**
 * "Mapping health" bar for the admin bank:
 *  - N questions missing class/chapter/topic → Show them · Fix names automatically · Auto-tag with AI
 *  - N questions in Review → Show them (students/auto-pick use Approved only)
 */
export default function MappingTools({ tax, onChanged, onShowUntagged, onShowReview, jobId }) {
  const [preview, setPreview] = useState(null);     // dry-run result of "fix names"
  const [applying, setApplying] = useState(false);
  const [askAi, setAskAi] = useState(false);
  const [fixSubject, setFixSubject] = useState(true);
  const [job, setJob] = useState(null);             // {id, pct, msg}
  const timer = useRef(null);

  const poll = (id) => {
    clearTimeout(timer.current);
    importApi.jobStatus(id).then((j) => {
      if (j.status === "processing") {
        setJob({ id, pct: j.progress?.pct || 5, msg: j.progress?.msg || "Working…" });
        timer.current = setTimeout(() => poll(id), 2500);
        return;
      }
      store.set(null); setJob(null);
      if (j.status === "done") {
        const r = j.result || {};
        toast.success(`AI tagged ${r.tagged || 0} of ${r.checked || 0} questions` +
          (r.unsure ? ` · ${r.unsure} need a manual look` : ""));
        if (r.warnings?.length) toast.warning(r.warnings[0]);
      } else {
        toast.error(j.error || "Auto-tag stopped");
      }
      onChanged?.();
    }).catch(() => { timer.current = setTimeout(() => poll(id), 5000); });
  };

  useEffect(() => {          // resume a job started before a page reload
    const id = store.get();
    if (id) { setJob({ id, pct: 5, msg: "Resuming…" }); poll(id); }
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {          // a job started elsewhere on the page (e.g. "AI-tag selected")
    if (!jobId) return;
    store.set(jobId); setJob({ id: jobId, pct: 3, msg: "Queued…" }); poll(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const openFix = async () => {
    try { setPreview(await questionsApi.normalizeTaxonomy(true)); }
    catch (e) { toast.error(e?.response?.data?.detail || "Could not check the names"); }
  };
  const applyFix = async () => {
    setApplying(true);
    try {
      const r = await questionsApi.normalizeTaxonomy(false);
      toast.success(`Fixed ${r.changed} question(s)`);
      setPreview(null); onChanged?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Fix failed"); }
    finally { setApplying(false); }
  };
  const startAi = async () => {
    try {
      const r = await questionsApi.autoTagStart({ fix_subject: fixSubject });
      setAskAi(false);
      if (!r.job_id) { toast.success(r.message || "Nothing to tag"); onChanged?.(); return; }
      store.set(r.job_id);
      setJob({ id: r.job_id, pct: 3, msg: `Queued ${r.count} questions…` });
      poll(r.job_id);
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not start auto-tag"); }
  };

  if (!tax) return null;
  const untagged = tax.untagged || 0;
  const review = (tax.status?.review || 0) + (tax.status?.draft || 0);
  if (!untagged && !review && !job) return null;

  return (
    <div className="space-y-3" data-testid="mapping-tools">
      {job && (
        <Card className="en-card p-4 border-primary/30" data-testid="autotag-progress">
          <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> AI is tagging questions…</div>
          <Progress value={job.pct} className="mt-2 h-2" />
          <div className="mt-1.5 text-xs text-muted-foreground">{job.msg} — you can keep working; the list refreshes when it finishes.</div>
        </Card>
      )}
      {untagged > 0 && !job && (
        <Card className="en-card p-4 border-amber-500/40 bg-amber-500/5" data-testid="untagged-banner">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-sm flex-1 min-w-[220px]">
              <b>{untagged.toLocaleString()}</b> question(s) are missing <b>Class, Chapter or Topic</b>, so they don't show up
              when you browse or assign by chapter/topic.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-full" data-testid="show-untagged" onClick={onShowUntagged}>Show them</Button>
              <Button size="sm" variant="outline" className="rounded-full" data-testid="fix-names-btn" onClick={openFix}>
                <Wand2 className="h-4 w-4 mr-1.5" /> Fix names automatically
              </Button>
              <Button size="sm" className="rounded-full" data-testid="autotag-btn" onClick={() => setAskAi(true)}>
                <Sparkles className="h-4 w-4 mr-1.5" /> Auto-tag with AI
              </Button>
            </div>
          </div>
        </Card>
      )}
      {review > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground px-1" data-testid="review-note">
          <Clock className="h-4 w-4 text-amber-600" />
          <span><b className="text-foreground">{review.toLocaleString()}</b> question(s) are in Review/Draft — students, practice and auto-pick
            only use <b className="text-foreground">Approved</b> ones. Check them, then select → Set status → Approved.</span>
          <Button size="sm" variant="link" className="h-auto p-0" data-testid="show-review" onClick={onShowReview}>Show them</Button>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="fix-names-dialog">
          <DialogHeader>
            <DialogTitle>Fix names automatically</DialogTitle>
            <DialogDescription>
              Makes every spelling match, e.g. "chem" → Chemistry, "XI" → 11, "Mole concept" → chapter
              "Some Basic Concepts of Chemistry" + topic "Mole Concept", and fills the class when a chapter is only in one class.
              Question text, options and answers are not touched.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[["Will change", preview.changed], ["Class filled", preview.class_filled],
                  ["Chapter renamed", preview.chapter_renamed], ["Subject fixed", preview.subject_fixed]].map(([l, n]) => (
                  <div key={l} className="rounded-lg border p-2"><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-semibold">{n}</div></div>
                ))}
              </div>
              {preview.examples?.length > 0 && (
                <div className="rounded-lg border divide-y">
                  {preview.examples.map((ex) => (
                    <div key={ex.id} className="p-2 text-xs">
                      {Object.keys(ex.after).map((k) => (
                        <div key={k}><span className="text-muted-foreground">{k.replace("student_class", "class")}:</span>{" "}
                          <s className="text-muted-foreground">{ex.before[k] || "—"}</s> → <b>{ex.after[k] || "—"}</b></div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {preview.changed === 0 && <p>All names are already consistent. Use <b>Auto-tag with AI</b> for questions that have no chapter or topic at all.</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
            <Button data-testid="fix-names-apply" disabled={applying || !preview?.changed} onClick={applyFix}>
              {applying ? "Fixing…" : `Fix ${preview?.changed || 0} question(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={askAi} onOpenChange={setAskAi}>
        <DialogContent className="max-w-lg" data-testid="autotag-dialog">
          <DialogHeader>
            <DialogTitle>Auto-tag with AI</DialogTitle>
            <DialogDescription>
              First fixes spellings, then the AI reads each question that still has no class, chapter or topic and files it
              under the NCERT chapter list. It only adds tags — question text, options and answers stay the same.
              Uses the AI key from AI Settings (about one AI call per 12 questions).
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={fixSubject} onCheckedChange={(v) => setFixSubject(!!v)} data-testid="autotag-fix-subject" className="mt-0.5" />
            <span>Also correct the subject when it is clearly wrong (e.g. a chemistry question saved under Physics).</span>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAskAi(false)}>Cancel</Button>
            <Button data-testid="autotag-start" onClick={startAi}><Sparkles className="h-4 w-4 mr-1.5" /> Start tagging {untagged.toLocaleString()} question(s)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
