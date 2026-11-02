import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, testsApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import ChapterPicker from "@/components/bank/ChapterPicker";

export default function ParentAssign() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [form, setForm] = useState({
    title: "Weekend Practice", subjects: ["Physics"], difficulty: "medium",
    num_questions: 10, duration_minutes: 30, child_id: "", chapters: [], topics: [],
  });
  const [busy, setBusy] = useState(false);
  const [assignedTests, setAssignedTests] = useState([]);

  useEffect(() => {
    (async () => {
      if (!user.child_ids?.length) return;
      const cs = await Promise.all(user.child_ids.map(id => usersApi.get(id)));
      setChildren(cs);
      setForm(f => ({ ...f, child_id: cs[0]?.id }));
    })();
    testsApi.list().then(setAssignedTests);
  }, [user]);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleSubject = (s) => upd("subjects", form.subjects.includes(s) ? form.subjects.filter(x => x !== s) : [...form.subjects, s]);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await testsApi.parentAssign(form);
      toast.success("Test assigned to your child");
      testsApi.list().then(setAssignedTests);
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div data-testid="parent-assign-page" className="space-y-8 max-w-3xl">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Assign</div>
        <h1 className="font-display font-bold text-3xl tracking-tight mt-1">Create a custom practice test</h1>
        <p className="text-muted-foreground mt-1">Pick subjects and difficulty — FNJEE.com builds it in a click.</p>
      </div>

      <Card className="en-card p-6">
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Title</Label><Input data-testid="parent-title" value={form.title} onChange={(e) => upd("title", e.target.value)} required /></div>
          <div>
            <Label>Child</Label>
            <Select value={form.child_id} onValueChange={(v) => upd("child_id", v)}>
              <SelectTrigger data-testid="parent-child-select"><SelectValue placeholder="Select child" /></SelectTrigger>
              <SelectContent>{children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subjects</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {["Physics", "Chemistry", "Mathematics", "Biology"].map(s => (
                <Badge key={s} onClick={() => toggleSubject(s)}
                  data-testid={`parent-subj-${s}`}
                  className={`cursor-pointer rounded-full ${form.subjects.includes(s) ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{s}</Badge>
              ))}
            </div>
          </div>
          <div>
            <Label>Chapters (optional)</Label>
            <div className="mt-2">
              <ChapterPicker subjects={form.subjects} value={{ chapters: form.chapters, topics: form.topics }}
                onChange={(v) => setForm((f) => ({ ...f, ...v }))} testId="parent-chapters" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => upd("difficulty", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Questions</Label><Input type="number" value={form.num_questions} onChange={(e) => upd("num_questions", parseInt(e.target.value || 0))} /></div>
            <div><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => upd("duration_minutes", parseInt(e.target.value || 0))} /></div>
          </div>
          <Button data-testid="parent-assign-btn" disabled={busy} className="rounded-full">{busy ? "Assigning…" : "Assign test"}</Button>
        </form>
      </Card>

      <Card className="en-card p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Tests you've assigned</h3>
        <div className="space-y-3">
          {assignedTests.map(t => (
            <div key={t.id} className="p-3 rounded-xl border border-border flex items-center justify-between">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.duration_minutes} min · {t.question_ids?.length} qs · {t.subjects?.join(", ")}</div>
              </div>
              <Badge variant="secondary" className="rounded-full">{t.total_marks} marks</Badge>
            </div>
          ))}
          {assignedTests.length === 0 && <div className="text-sm text-muted-foreground">No tests assigned yet.</div>}
        </div>
      </Card>
    </div>
  );
}
