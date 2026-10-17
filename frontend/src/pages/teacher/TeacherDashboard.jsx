import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { teacherApi, testsApi, questionsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, FilePlus2, BarChart3, ShieldCheck } from "lucide-react";

function Stat({ icon: Icon, label, value }) {
  return (
    <Card data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`} className="en-card p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-display font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </div>
    </Card>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [perms, setPerms] = useState(null);
  const [qCount, setQCount] = useState(0);
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    teacherApi.myPerms().then((r) => setPerms(r.teacher_perms)).catch(() => {});
    questionsApi.page({ page: 1, page_size: 10 }).then((r) => setQCount(r.total)).catch(() => {});
    testsApi.list().then(setPapers).catch(() => {});
  }, []);

  return (
    <div data-testid="teacher-dashboard" className="space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Teacher / Vendor</div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Welcome, {user?.name}</h1>
        <p className="text-muted-foreground mt-1">Build papers from the shared question bank and track how your students perform.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={BookOpen} label="Questions available" value={qCount} />
        <Stat icon={FilePlus2} label="Papers created" value={papers.length} />
        <Stat icon={BarChart3} label="Attempts to review" value={papers.reduce((a) => a, 0) || "—"} />
      </div>

      {perms && (
        <Card className="en-card p-5">
          <div className="flex items-center gap-2 mb-3"><ShieldCheck className="h-4 w-4 text-primary" /><span className="font-semibold">Your access</span></div>
          <div className="flex flex-wrap gap-2">
            {(perms.subjects || []).length === 0 && <Badge variant="secondary" className="rounded-full">All subjects</Badge>}
            {(perms.subjects || []).map((s) => <Badge key={s} className="rounded-full" data-testid={`perm-subject-${s}`}>{s}</Badge>)}
            {(perms.exams || []).map((e) => <Badge key={e} variant="outline" className="rounded-full">{e}</Badge>)}
            {(perms.classes || []).map((c) => <Badge key={c} variant="outline" className="rounded-full">Class {c}</Badge>)}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/teacher/question-bank"><Button data-testid="go-build-paper" className="rounded-full">Build a paper</Button></Link>
        <Link to="/teacher/results"><Button data-testid="go-results" variant="outline" className="rounded-full">View results</Button></Link>
      </div>
    </div>
  );
}
