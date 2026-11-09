import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cbtApi } from "@/lib/cbtApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, ShieldCheck, ShieldOff, ClipboardCheck, AlertTriangle } from "lucide-react";

export default function CbtExams() {
  const [exams, setExams] = useState([]);
  const [issues, setIssues] = useState(null); // { title, issues: [] }
  const [busyId, setBusyId] = useState(null);

  const load = () => cbtApi.adminListExams().then(setExams).catch(() => toast.error("Could not load exams"));
  useEffect(() => { load(); }, []);

  const validate = async (ex) => {
    setBusyId(ex.id);
    try {
      const r = await cbtApi.adminValidateExam(ex.id);
      if (r.valid) toast.success(`"${ex.title}" passed validation`);
      else setIssues({ title: ex.title, issues: r.issues });
    } catch { toast.error("Validation failed"); }
    finally { setBusyId(null); }
  };

  const togglePublish = async (ex) => {
    setBusyId(ex.id);
    try {
      const r = await cbtApi.adminPublishExam(ex.id, !ex.published);
      toast.success(r.published ? `"${ex.title}" is now live for students` : `"${ex.title}" unpublished`);
      load();
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (d && d.issues) setIssues({ title: ex.title, issues: d.issues });
      else toast.error(d?.message || d || "Publish failed");
    } finally { setBusyId(null); }
  };

  return (
    <div data-testid="cbt-exams-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">CBT</div>
          <h1 className="font-display font-bold text-3xl tracking-tight mt-1">CBT Exams</h1>
          <p className="text-sm text-muted-foreground mt-1">Create, validate and publish DigiALM-style computer-based exams.</p>
        </div>
        <Link to="/admin/cbt-exams/new"><Button data-testid="cbt-new-exam" className="rounded-full"><Plus className="h-4 w-4 mr-2" />New CBT exam</Button></Link>
      </div>

      <div className="grid gap-3">
        {exams.map((ex) => (
          <Card key={ex.id} className="en-card p-4 flex flex-wrap items-center gap-3" data-testid={`cbt-exam-row-${ex.id}`}>
            <div className="flex-1 min-w-[220px]">
              <div className="font-semibold">{ex.title}</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge variant="secondary" className="rounded-full">{ex.question_count} Qs</Badge>
                <Badge variant="outline" className="rounded-full">{ex.duration_minutes} min</Badge>
                <Badge variant="outline" className="rounded-full">{ex.total_marks} marks</Badge>
                {(ex.subjects || []).map((s) => <Badge key={s} variant="outline" className="rounded-full">{s}</Badge>)}
              </div>
            </div>
            <Badge className={`rounded-full ${ex.published ? "bg-green-600" : "bg-slate-400"}`} data-testid={`cbt-published-${ex.id}`}>
              {ex.published ? "Live" : "Draft"}
            </Badge>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => validate(ex)} disabled={busyId === ex.id} data-testid={`cbt-validate-${ex.id}`}>
                <ClipboardCheck className="h-4 w-4 mr-1" /> Validate
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => togglePublish(ex)} disabled={busyId === ex.id}
                data-testid={`cbt-publish-toggle-${ex.id}`}>
                {ex.published ? <><ShieldOff className="h-4 w-4 mr-1" /> Unpublish</> : <><ShieldCheck className="h-4 w-4 mr-1" /> Publish</>}
              </Button>
              <Link to={`/admin/cbt-exams/${ex.id}/edit`}><Button variant="outline" size="sm" className="rounded-full" data-testid={`cbt-edit-${ex.id}`}><Pencil className="h-4 w-4 mr-1" /> Edit</Button></Link>
            </div>
          </Card>
        ))}
        {exams.length === 0 && <div className="text-muted-foreground">No exams yet. Create your first CBT exam.</div>}
      </div>

      <Dialog open={!!issues} onOpenChange={(o) => !o && setIssues(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Cannot publish — fix these issues</DialogTitle>
            <DialogDescription>"{issues?.title}" has {issues?.issues?.length || 0} problem(s). Resolve them before publishing.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc ml-5 space-y-1 text-sm text-slate-700 max-h-[50vh] overflow-y-auto" data-testid="cbt-issues-list">
            {(issues?.issues || []).map((i, idx) => <li key={idx}>{i}</li>)}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
