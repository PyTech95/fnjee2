import { useEffect, useState } from "react";
import { testsApi } from "@/lib/api";
import AssignTestDialog from "@/components/AssignTestDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function AdminTests() {
  const [rows, setRows] = useState([]);
  const [active, setActive] = useState(null);

  const load = () => testsApi.list().then(setRows);
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm("Delete this test?")) return;
    await testsApi.remove(id); toast.success("Deleted"); load();
  };

  return (
    <div data-testid="admin-tests-page" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Exams</div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">All tests</h1>
        </div>
        <Link to="/admin/tests/new"><Button data-testid="new-test-btn" className="rounded-full">+ New test</Button></Link>
      </div>

      <Card className="en-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Questions</TableHead>
              <TableHead className="text-right">Assigned</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell><Badge variant="secondary" className="rounded-full">{r.exam_type}</Badge></TableCell>
                <TableCell>{r.duration_minutes} min</TableCell>
                <TableCell className="text-right">{r.question_ids?.length || 0}</TableCell>
                <TableCell className="text-right">{r.assigned_to?.length || (r.draft ? <span className="text-amber-600">Draft</span> : (r.personal ? "Own" : "All"))}{r.starts_at ? <div className="text-[11px] text-muted-foreground">opens {new Date(r.starts_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</div> : null}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button data-testid={`assign-test-${r.id}`} size="icon" variant="ghost" onClick={() => setActive(r)}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tests yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <AssignTestDialog test={active} onClose={() => setActive(null)} onDone={load} />
    </div>
  );
}
