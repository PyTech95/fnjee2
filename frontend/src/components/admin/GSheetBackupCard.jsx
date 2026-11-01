import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sheet, Save, Loader2, CloudUpload, ExternalLink } from "lucide-react";

/** Website → Google Sheet backup of the whole question bank (only when the admin presses the button). */
export default function GSheetBackupCard() {
  const [s, setS] = useState(null);
  const [link, setLink] = useState("");
  const [json, setJson] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { const r = await api.get("/admin/settings/gsheet"); setS(r.data); if (r.data.sheet_url && !link) setLink(r.data.sheet_url); }
    catch { /* ignore */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  const running = s?.status?.state === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [running]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put("/admin/settings/gsheet", { sheet_link: link.trim(), service_account_json: json.trim() || undefined });
      setS(r.data); setJson("");
      toast.success(`Sheet connect ho gayi: ${r.data.sheet_title || ""}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Save nahi ho paya"); }
    finally { setSaving(false); }
  };
  const backup = async () => {
    try { const r = await api.post("/admin/settings/gsheet/backup"); setS(r.data); toast.success("Backup shuru — saare questions Sheet mein ja rahe hain"); }
    catch (e) { toast.error(e.response?.data?.detail || "Backup start nahi hua"); }
  };

  if (!s) return null;
  const st = s.status || {};
  return (
    <Card className="p-5 space-y-4" data-testid="gsheet-backup-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold flex items-center gap-2"><Sheet className="w-5 h-5" /> Google Sheet backup</h2>
        <Badge variant={s.configured ? "default" : "secondary"}>{s.configured ? "Connected" : "Not set up"}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        "Backup now" dabane par website ke saare questions Google Sheet mein copy ho jaate hain (har subject ka alag tab).
        Ye sirf backup hai — Sheet mein kiya badlav website pe nahi aata, aur agla backup Sheet ko dobara likh deta hai.
      </p>

      {s.configured && (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Sheet:</span>
            <a className="text-primary inline-flex items-center gap-1 underline" href={s.sheet_url} target="_blank" rel="noreferrer">
              {s.sheet_title || "Open"} <ExternalLink className="w-3 h-3" /></a>
          </div>
          <div><span className="text-muted-foreground">Service account:</span> <span className="font-mono text-xs">{s.service_account_email}</span></div>
          {st.state && (
            <div data-testid="gsheet-status">
              <span className="text-muted-foreground">Last backup:</span>{" "}
              {st.state === "running" ? `chal raha hai… ${(st.done || 0).toLocaleString("en-IN")} / ${(st.total || 0).toLocaleString("en-IN")}`
                : st.state === "done" ? `${(st.done || 0).toLocaleString("en-IN")} questions, ${new Date(st.finished_at).toLocaleString()}`
                : <span className="text-red-600">{st.error}</span>}
            </div>
          )}
          <Button size="sm" onClick={backup} disabled={running} data-testid="gsheet-backup-now">
            {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-1" />} Backup now
          </Button>
        </div>
      )}

      <div className="grid gap-3">
        <div>
          <label className="text-sm text-muted-foreground">Google Sheet ka link</label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/edit" data-testid="gsheet-link" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Service account JSON key {s.configured && "(khali chhodo to purani hi rahegi)"}</label>
          <Textarea rows={4} value={json} onChange={(e) => setJson(e.target.value)} className="font-mono text-xs"
            placeholder='{"type": "service_account", "client_email": "…", "private_key": "…"}' data-testid="gsheet-json" />
        </div>
      </div>
      <Button onClick={save} disabled={saving || !link.trim()} data-testid="gsheet-save">
        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save &amp; test
      </Button>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Setup kaise karein (ek baar)</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>console.cloud.google.com → naya project → "Google Sheets API" Enable.</li>
          <li>IAM &amp; Admin → Service Accounts → Create → bana ke Keys → Add key → JSON (file download hogi).</li>
          <li>Ek khali Google Sheet banaiye → Share → service account ka e-mail (…iam.gserviceaccount.com) → Editor.</li>
          <li>Upar Sheet ka link aur JSON file ka poora text paste karke "Save &amp; test", phir "Backup now".</li>
        </ol>
      </details>
    </Card>
  );
}
