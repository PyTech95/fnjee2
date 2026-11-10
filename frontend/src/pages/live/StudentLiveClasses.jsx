import { useEffect, useState } from "react";
import { liveClassesApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Radio, CalendarClock, CheckCircle2, ExternalLink, Clapperboard, FileText } from "lucide-react";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/native";

const fmt = (iso) => { try { return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } };

export default function StudentLiveClasses() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); liveClassesApi.list().then(setClasses).finally(() => setLoading(false)); };
  useEffect(() => { load(); const iv = setInterval(load, 60000); return () => clearInterval(iv); }, []);

  // Open the tab synchronously (inside the tap) so pop-up blockers / the app WebView don't swallow it,
  // then point it at the meeting once attendance is marked.
  const join = async (c) => {
    const inApp = isNativeApp();
    const win = inApp ? null : window.open("about:blank", "_blank");
    if (win) { try { win.opener = null; } catch { /* cross-origin later — fine */ } }
    try {
      const r = await liveClassesApi.join(c.id);
      if (!r?.meeting_url) throw new Error("No meeting link for this class yet");
      toast.success("Attendance marked — opening class");
      if (win && !win.closed) win.location.href = r.meeting_url;
      else window.location.href = r.meeting_url;   // app / blocked pop-up: open in place (the app hands it to Meet/Zoom)
    } catch (e) {
      if (win && !win.closed) win.close();
      toast.error(e?.response?.data?.detail || e?.message || "Could not join");
    }
  };

  const live = classes.filter((c) => c.status === "live");
  const upcoming = classes.filter((c) => c.status === "upcoming");
  const ended = classes.filter((c) => c.status === "ended");

  const ClassCard = ({ c }) => (
    <Card data-testid={`slc-card-${c.id}`} className={`en-card p-5 ${c.status === "live" ? "ring-2 ring-red-500/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-bold text-lg truncate">{c.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmt(c.starts_at)} · {c.duration_minutes}m</div>
          <div className="text-xs text-muted-foreground mt-0.5">Host: {c.host_name}</div>
        </div>
        {c.status === "live" && <Badge variant="outline" className="rounded-full border-red-500/30 bg-red-500/10 text-red-600"><Radio className="h-3 w-3 mr-1 animate-pulse" />LIVE</Badge>}
      </div>
      {c.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{c.description}</p>}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {c.subject && <Badge variant="secondary" className="rounded-full">{c.subject}</Badge>}
        <Badge variant="outline" className="rounded-full capitalize">{c.provider}</Badge>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {c.status !== "ended" && <Button data-testid={`slc-join-${c.id}`} className="rounded-full" onClick={() => join(c)}><Video className="h-4 w-4 mr-1.5" />{c.status === "live" ? "Join now" : "Join room"}</Button>}
        {c.recording_url && <a href={c.recording_url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="rounded-full"><Clapperboard className="h-4 w-4 mr-1.5" />Recording</Button></a>}
        {(c.materials || []).map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" className="rounded-full"><FileText className="h-4 w-4 mr-1.5" />{m.name}</Button></a>)}
      </div>
    </Card>
  );

  return (
    <div data-testid="student-live-classes" className="space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Learn live</div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Live Classes</h1>
        <p className="text-muted-foreground mt-1">Join scheduled sessions and revisit recordings.</p>
      </div>

      {live.length > 0 && (
        <div data-testid="live-now-banner" className="rounded-3xl p-5 sm:p-6 bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2 text-red-600 font-semibold"><Radio className="h-4 w-4 animate-pulse" /> Live now</div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">{live.map((c) => <ClassCard key={c.id} c={c} />)}</div>
        </div>
      )}

      {loading && <div className="text-muted-foreground">Loading…</div>}
      {!loading && classes.length === 0 && (
        <Card className="en-card p-10 text-center"><Video className="h-8 w-8 mx-auto text-primary/50" /><div className="mt-3 font-medium">No live classes scheduled yet</div></Card>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-blue-500" /> Upcoming ({upcoming.length})</div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{upcoming.map((c) => <ClassCard key={c.id} c={c} />)}</div>
        </div>
      )}
      {ended.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Past classes ({ended.length})</div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{ended.map((c) => <ClassCard key={c.id} c={c} />)}</div>
        </div>
      )}
    </div>
  );
}
