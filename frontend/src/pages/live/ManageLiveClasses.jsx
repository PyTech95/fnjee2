import { useEffect, useState } from "react";
import { liveClassesApi, api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Video, Plus, Radio, CalendarClock, CheckCircle2, Trash2, Users, Link2, ExternalLink, Download, FileText, Clapperboard } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = [
  { v: "jitsi", label: "Jitsi (instant, no login)" },
  { v: "meet", label: "Google Meet (paste link)" },
  { v: "zoom", label: "Zoom (paste link)" },
  { v: "webinar.gg", label: "Webinar.gg (paste link)" },
  { v: "custom", label: "Other link" },
];
const STATUS_STYLE = {
  live: "bg-red-500/10 text-red-600 border-red-500/30",
  upcoming: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  ended: "bg-muted text-muted-foreground border-border",
};
const fmt = (iso) => { try { return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } };
// datetime-local needs *local* time; toISOString() is UTC and shifted classes by 5h30 on every edit.
const toLocalInput = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const emptyForm = { title: "", subject: "", description: "", provider: "jitsi", meeting_url: "", starts_at: "", duration_minutes: 60, recording_url: "", material_name: "", material_url: "" };

export default function ManageLiveClasses({ accent = "Teacher" }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState(null); // {class, rows,...}

  const load = () => { setLoading(true); liveClassesApi.list().then(setClasses).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c) => {
    setEditId(c.id);
    setForm({ ...emptyForm, title: c.title, subject: c.subject || "", description: c.description || "",
      provider: c.provider, meeting_url: c.meeting_url || "",
      starts_at: c.starts_at ? toLocalInput(c.starts_at) : "",
      duration_minutes: c.duration_minutes, recording_url: c.recording_url || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!editId && !form.starts_at) return toast.error("Pick a start time");
    if (form.provider !== "jitsi" && !form.meeting_url.trim()) return toast.error("Paste the meeting link");
    setSaving(true);
    try {
      const materials = form.material_url.trim() ? [{ name: form.material_name || "Material", url: form.material_url.trim() }] : undefined;
      const payload = {
        title: form.title.trim(), subject: form.subject, description: form.description,
        provider: form.provider, meeting_url: form.meeting_url.trim() || null,
        duration_minutes: Number(form.duration_minutes) || 60,
        recording_url: form.recording_url.trim() || null,
      };
      if (form.starts_at) payload.starts_at = new Date(form.starts_at).toISOString();
      if (materials) payload.materials = materials;
      if (editId) await liveClassesApi.update(editId, payload);
      else await liveClassesApi.create(payload);
      toast.success(editId ? "Class updated" : "Class scheduled — students notified");
      setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const del = async (id) => { if (!confirm("Delete this class?")) return; await liveClassesApi.remove(id); toast.success("Deleted"); load(); };
  const openRoster = async (c) => { try { setRoster(await liveClassesApi.attendance(c.id)); } catch { toast.error("Could not load attendance"); } };
  const downloadCsv = async (cid) => {
    try {
      const res = await api.get(`/live-classes/${cid}/attendance.csv`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `attendance-${cid.slice(0, 8)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error("Could not download CSV"); }
  };
  const togglePresent = async (studentId, present) => {
    await liveClassesApi.mark(roster.class.id, studentId, present);
    setRoster(await liveClassesApi.attendance(roster.class.id));
  };

  const groups = {
    live: classes.filter((c) => c.status === "live"),
    upcoming: classes.filter((c) => c.status === "upcoming"),
    ended: classes.filter((c) => c.status === "ended"),
  };

  const Section = ({ title, icon: Icon, items, tint }) => (
    items.length > 0 && (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Icon className={`h-4 w-4 ${tint}`} /> {title} <span className="text-muted-foreground">({items.length})</span></div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((c) => (
            <Card key={c.id} data-testid={`lc-card-${c.id}`} className={`en-card p-5 ${c.status === "live" ? "ring-2 ring-red-500/40" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display font-bold text-lg truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {fmt(c.starts_at)} · {c.duration_minutes}m</div>
                </div>
                <Badge variant="outline" className={`rounded-full border capitalize ${STATUS_STYLE[c.status]}`}>{c.status === "live" && <Radio className="h-3 w-3 mr-1 animate-pulse" />}{c.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {c.subject && <Badge variant="secondary" className="rounded-full">{c.subject}</Badge>}
                <Badge variant="outline" className="rounded-full capitalize">{c.provider}</Badge>
                {c.recording_url && <Badge variant="outline" className="rounded-full"><Clapperboard className="h-3 w-3 mr-1" />Recording</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button data-testid={`lc-copy-${c.id}`} size="sm" variant="outline" className="rounded-full" onClick={() => { navigator.clipboard?.writeText(c.meeting_url); toast.success("Link copied"); }}><Link2 className="h-4 w-4 mr-1" />Copy</Button>
                <a href={c.meeting_url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="rounded-full"><ExternalLink className="h-4 w-4 mr-1" />Open</Button></a>
                <Button data-testid={`lc-roster-${c.id}`} size="sm" className="rounded-full" onClick={() => openRoster(c)}><Users className="h-4 w-4 mr-1" />Attendance</Button>
                <Button data-testid={`lc-edit-${c.id}`} size="sm" variant="ghost" className="rounded-full" onClick={() => openEdit(c)}>Edit</Button>
                <Button data-testid={`lc-del-${c.id}`} size="icon" variant="ghost" className="rounded-full" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  );

  return (
    <div data-testid="manage-live-classes" className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{accent} · Live</div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Live Classes</h1>
          <p className="text-muted-foreground mt-1">Schedule, launch, and track attendance for live sessions.</p>
        </div>
        <Button data-testid="schedule-class-btn" className="rounded-full" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Schedule class</Button>
      </div>

      {loading && <div className="text-muted-foreground">Loading…</div>}
      {!loading && classes.length === 0 && (
        <Card className="en-card p-10 text-center">
          <Video className="h-8 w-8 mx-auto text-primary/50" />
          <div className="mt-3 font-medium">No classes yet</div>
          <p className="text-sm text-muted-foreground mt-1">Schedule your first live class — students get notified instantly.</p>
        </Card>
      )}
      <Section title="Live now" icon={Radio} items={groups.live} tint="text-red-500" />
      <Section title="Upcoming" icon={CalendarClock} items={groups.upcoming} tint="text-blue-500" />
      <Section title="Ended" icon={CheckCircle2} items={groups.ended} tint="text-muted-foreground" />

      {/* Schedule / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit class" : "Schedule a live class"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto en-scroll pr-1">
            <div><Label>Title</Label><Input data-testid="lc-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Physics · Rotational Motion doubt class" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Subject</Label><Input data-testid="lc-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Physics" /></div>
              <div><Label>Duration (min)</Label><Input data-testid="lc-duration" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
            </div>
            <div>
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger data-testid="lc-provider"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.provider !== "jitsi" && (
              <div><Label>Meeting link</Label><Input data-testid="lc-url" value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="https://zoom.us/j/… · https://meet.google.com/… · https://webinar.gg/…" /></div>
            )}
            {form.provider === "jitsi" && <p className="text-xs text-muted-foreground">A secure room link is generated automatically — no accounts needed.</p>}
            <div><Label>Start time</Label><Input data-testid="lc-start" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label className="flex items-center gap-1"><Clapperboard className="h-3.5 w-3.5" />Recording link (optional)</Label><Input data-testid="lc-recording" value={form.recording_url} onChange={(e) => setForm({ ...form, recording_url: e.target.value })} placeholder="https://…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />Material name</Label><Input value={form.material_name} onChange={(e) => setForm({ ...form, material_name: e.target.value })} placeholder="Notes PDF" /></div>
              <div><Label>Material link</Label><Input value={form.material_url} onChange={(e) => setForm({ ...form, material_url: e.target.value })} placeholder="https://…" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="lc-save" className="rounded-full" disabled={saving} onClick={save}>{saving ? "Saving…" : editId ? "Save changes" : "Schedule & notify"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance roster dialog */}
      <Dialog open={!!roster} onOpenChange={(o) => !o && setRoster(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Attendance · {roster?.class?.title}</DialogTitle></DialogHeader>
          {roster && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <Badge className="rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30" variant="outline">Present {roster.present}</Badge>
                <Badge className="rounded-full" variant="outline">Absent {roster.absent}</Badge>
                <a href={liveClassesApi.csvUrl(roster.class.id)} className="ml-auto" download>
                  <Button data-testid="lc-csv" size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.preventDefault(); downloadCsv(roster.class.id); }}><Download className="h-4 w-4 mr-1" />CSV</Button>
                </a>
              </div>
              <div className="max-h-[50vh] overflow-y-auto en-scroll mt-3">
                <Table>
                  <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Present</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {roster.rows.map((r) => (
                      <TableRow key={r.student_id} data-testid={`att-row-${r.student_id}`}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.joined_at ? fmt(r.joined_at) : "—"}</TableCell>
                        <TableCell className="text-right"><Switch data-testid={`att-toggle-${r.student_id}`} checked={r.present} onCheckedChange={(v) => togglePresent(r.student_id, v)} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
