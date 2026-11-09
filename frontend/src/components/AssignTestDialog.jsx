import { useEffect, useMemo, useState } from "react";
import { testsApi, usersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarClock, Search } from "lucide-react";
import { toast } from "sonner";

// datetime-local wants local time; the API stores ISO (UTC).
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Admin / teacher: pick students (search, select all) and an optional date-time the test opens. */
export default function AssignTestDialog({ test, onClose, onDone }) {
  const [students, setStudents] = useState(null);
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { usersApi.directory().then(setStudents).catch(() => setStudents([])); }, []);
  useEffect(() => {
    setPicked(test?.assigned_to || []);
    setWhen(toLocalInput(test?.starts_at));
    setQ("");
  }, [test]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (students || []).filter((s) => !n || `${s.name} ${s.email} ${s.exam_target || ""}`.toLowerCase().includes(n));
  }, [students, q]);
  const allShownPicked = shown.length > 0 && shown.every((s) => picked.includes(s.id));
  const toggleAll = () => setPicked(allShownPicked ? picked.filter((id) => !shown.some((s) => s.id === id))
                                                   : [...new Set([...picked, ...shown.map((s) => s.id)])]);

  const save = async () => {
    if (!picked.length) return toast.error("Select at least one student");
    setBusy(true);
    try {
      const r = await testsApi.assign({ test_id: test.id, student_ids: picked, starts_at: when ? new Date(when).toISOString() : "" });
      toast.success(`Assigned to ${r.assigned} student${r.assigned === 1 ? "" : "s"}${when ? " · opens " + new Date(when).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""}`);
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not assign");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!test} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Assign “{test?.title}”</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" /> Test date &amp; time <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input data-testid="assign-when" type="datetime-local" className="mt-1.5" value={when} onChange={(e) => setWhen(e.target.value)} />
            <div className="text-xs text-muted-foreground mt-1">Students see the test now, but can start it only from this time. Leave empty to open it now.</div>
          </div>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="assign-search" className="pl-9" placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <button type="button" className="text-primary font-medium hover:underline" onClick={toggleAll} disabled={!shown.length}>
              {allShownPicked ? "Unselect" : "Select"} all{q ? " shown" : ""}
            </button>
            <span className="text-muted-foreground">{picked.length} selected</span>
          </div>
          <div className="max-h-72 overflow-y-auto en-scroll space-y-1.5" data-testid="assign-students">
            {students === null && <div className="text-sm text-muted-foreground p-3">Loading students…</div>}
            {students && !shown.length && <div className="text-sm text-muted-foreground p-3">No students found.</div>}
            {shown.map((s) => (
              <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${picked.includes(s.id) ? "bg-primary/10" : "hover:bg-muted/60"}`}>
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={picked.includes(s.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.email}{s.exam_target ? ` · ${s.exam_target}` : ""}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="confirm-assign" onClick={save} disabled={busy}>{busy ? "Saving…" : `Assign to ${picked.length}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
