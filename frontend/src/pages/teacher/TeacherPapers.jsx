import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { testsApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, BarChart3, FileText, UserPlus, CalendarClock } from "lucide-react";
import AssignTestDialog from "@/components/AssignTestDialog";
import { printPaper } from "@/lib/printPaper";
import { toast } from "sonner";

export default function TeacherPapers() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);

  const load = () => testsApi.list().then(setPapers).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const doPrint = async (t, withAnswers) => {
    try {
      const full = await testsApi.get(t.id, true);
      printPaper({ title: t.title, duration: t.duration_minutes, questions: full.questions || [], withAnswers });
    } catch { toast.error("Could not load questions"); }
  };

  return (
    <div data-testid="teacher-papers" className="space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Papers</div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">My Papers</h1>
        <p className="text-muted-foreground mt-1">Assign a paper to your students with a test date, print it, or open question-wise performance.</p>
      </div>

      {loading && <div className="text-muted-foreground">Loading…</div>}
      {!loading && papers.length === 0 && (
        <Card className="en-card p-8 text-center text-muted-foreground">
          No papers yet. <Link to="/teacher/question-bank" className="text-primary font-medium">Build your first paper →</Link>
        </Card>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {papers.map((t) => (
          <Card key={t.id} data-testid={`paper-${t.id}`} className="en-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display font-bold text-lg">{t.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{(t.question_ids || []).length} questions · {t.duration_minutes} min · {t.total_marks} marks</div>
                <div className="flex flex-wrap gap-1.5 mt-2">{(t.subjects || []).map((s) => <Badge key={s} variant="secondary" className="rounded-full">{s}</Badge>)}</div>
                <div className="text-xs mt-2 flex flex-wrap items-center gap-2" data-testid={`paper-assigned-${t.id}`}>
                  {(t.assigned_to || []).length
                    ? <span className="text-emerald-600 font-medium">Assigned to {t.assigned_to.length} student{t.assigned_to.length === 1 ? "" : "s"}</span>
                    : t.draft
                      ? <span className="text-amber-600 font-medium">Not assigned yet — students can't see it</span>
                      : <span className="text-muted-foreground font-medium">Open to all students</span>}
                  {t.starts_at && <span className="text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" /> opens {new Date(t.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
                </div>
              </div>
              <FileText className="h-5 w-5 text-primary/60 shrink-0" />
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button data-testid={`assign-${t.id}`} size="sm" className="rounded-full" onClick={() => setAssigning(t)}><UserPlus className="h-4 w-4 mr-1.5" /> Assign to students</Button>
              <Button data-testid={`print-${t.id}`} size="sm" variant="outline" className="rounded-full" onClick={() => doPrint(t, false)}><Printer className="h-4 w-4 mr-1.5" /> Print</Button>
              <Button data-testid={`print-key-${t.id}`} size="sm" variant="ghost" className="rounded-full" onClick={() => doPrint(t, true)}>+ Answer key</Button>
              <Link to={`/teacher/results?test=${t.id}`}><Button data-testid={`analyze-${t.id}`} size="sm" className="rounded-full"><BarChart3 className="h-4 w-4 mr-1.5" /> Analysis</Button></Link>
            </div>
          </Card>
        ))}
      </div>
      <AssignTestDialog test={assigning} onClose={() => setAssigning(null)} onDone={load} />
    </div>
  );
}
