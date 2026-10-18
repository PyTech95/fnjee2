import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Square, Loader2 } from "lucide-react";

const n = (x) => (x || 0).toLocaleString("en-IN");

/** One button: AI fills every missing answer in the bank and flags questions whose picture is missing. */
export default function AiFixPanel({ onShowIssue, onFinished }) {
  const [s, setS] = useState(null);
  const [subject, setSubject] = useState("all");
  const [approve, setApprove] = useState(false);
  const [retry, setRetry] = useState(false);
  const [busy, setBusy] = useState(false);
  const wasRunning = useRef(false);

  const load = async () => {
    try {
      const r = await api.get("/admin/ai-fix");
      setS(r.data);
      if (wasRunning.current && !r.data.running) onFinished?.();
      wasRunning.current = r.data.running;
    } catch { /* ignore */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!s?.running) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [s?.running]);

  const start = async () => {
    setBusy(true);
    try {
      const r = await api.post("/admin/ai-fix/start", { subject: subject === "all" ? "" : subject, approve, retry_unsure: retry });
      setS(r.data); wasRunning.current = true;
      toast.success("AI Fix shuru ho gaya — aap page band bhi kar sakte hain, ye server pe chalta rahega");
    } catch (e) { toast.error(e.response?.data?.detail || "Start nahi ho paya"); }
    finally { setBusy(false); }
  };
  const stop = async () => {
    try { await api.post("/admin/ai-fix/stop"); toast("Ruk raha hai… (chal rahe AI calls poore hone ke baad)"); setTimeout(load, 1500); }
    catch { toast.error("Stop nahi ho paya"); }
  };

  if (!s) return null;
  const st = s.status;
  const pct = st?.total ? Math.min(100, Math.round((st.checked / st.total) * 100)) : 0;
  const chip = (label, value, issue, tone) => (
    <button type="button" onClick={() => onShowIssue?.(issue)} data-testid={`aifix-${issue}`}
      className={`rounded-xl border px-3 py-2 text-left hover:bg-muted/50 ${tone}`}>
      <div className="text-xl font-bold">{n(value)}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );

  return (
    <Card className="en-card p-4 space-y-3" data-testid="ai-fix-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Fix — poore question bank ki jaanch</div>
          <div className="text-xs text-muted-foreground">
            Jin questions ka answer nahi hai, AI unhe solve karke answer + solution daal deta hai (picture wale questions picture ke saath bheje jaate hain).
            Jinke text mein figure/diagram ki baat hai par picture nahi hai, unhe "Picture missing" mark karta hai.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {chip("Answer nahi hai", s.missing_answers, "no-answer", "border-amber-300/60")}
        {chip("Picture missing", s.picture_missing, "picture-missing", "border-red-300/60")}
        {chip("AI ko yakeen nahi", s.ai_unsure, "ai-unsure", "border-slate-300")}
        {chip("AI answer — check karein", s.ai_answered_review, "ai-answered", "border-emerald-300/60")}
      </div>

      {s.running ? (
        <div className="space-y-2" data-testid="aifix-progress">
          <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />
              {n(st?.checked)} / {n(st?.total)} checked · {n(st?.answered)} answered · {n(st?.unsure)} unsure · {n(st?.picture_missing)} picture missing</span>
            <Button size="sm" variant="outline" className="rounded-full" onClick={stop} data-testid="aifix-stop"><Square className="h-3.5 w-3.5 mr-1.5" /> Stop</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-[160px] h-9" data-testid="aifix-subject"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {["Physics", "Chemistry", "Mathematics", "Biology"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={approve} onCheckedChange={(v) => setApprove(!!v)} data-testid="aifix-approve" />
            AI answers seedha Approved kar do</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={retry} onCheckedChange={(v) => setRetry(!!v)} />
            "Yakeen nahi" wale dobara try karo</label>
          <Button className="rounded-full ml-auto" onClick={start} disabled={busy} data-testid="aifix-start">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />} Run AI Fix
          </Button>
        </div>
      )}
      {st && !s.running && st.state && (
        <div className="text-xs text-muted-foreground" data-testid="aifix-last">
          Last run ({st.state}{st.finished_at ? `, ${new Date(st.finished_at).toLocaleString()}` : ""}): {n(st.answered)} answered, {n(st.unsure)} unsure,
          {" "}{n(st.picture_missing)} picture missing{st.errors ? `, ${st.errors} AI errors` : ""}.{st.last_error ? ` ${st.last_error}` : ""}
        </div>
      )}
      {!approve && !s.running && (
        <div className="text-xs text-muted-foreground">AI ke answers "Review" status mein aayenge — upar "AI answer — check karein" pe click karke dekh lijiye, phir select karke Status → Approved.</div>
      )}
    </Card>
  );
}
