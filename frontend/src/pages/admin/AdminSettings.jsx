import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import GSheetBackupCard from "@/components/admin/GSheetBackupCard";
import { KeyRound, FlaskConical, RotateCcw, Save, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const PROVIDER_LABELS = {
  emergent: "Emergent Universal Key",
  openai: "OpenAI (apni key)",
  gemini: "Google Gemini (apni key)",
  claude: "Anthropic Claude (apni key)",
};

export default function AdminSettings() {
  const [s, setS] = useState(null);
  const [provider, setProvider] = useState("emergent");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = async () => {
    try {
      const r = await api.get("/admin/settings/ai");
      setS(r.data);
      setProvider(r.data.provider);
      setModel(r.data.source === "admin" ? (r.data.model || "") : "");
      setTestResult(null);
    } catch { toast.error("AI settings load nahi ho payi"); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!key.trim()) { toast.error("API key daaliye"); return; }
    setSaving(true);
    try {
      const r = await api.put("/admin/settings/ai", { provider, api_key: key.trim(), model: model.trim() || undefined });
      setS(r.data); setKey(""); setTestResult(null);
      toast.success("AI key save ho gayi");
    } catch (e) { toast.error(e.response?.data?.detail || "Save fail ho gaya"); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await api.post("/admin/settings/ai/test");
      setTestResult(r.data);
      toast.success(`Key kaam kar rahi hai (${r.data.latency_ms}ms)`);
    } catch (e) {
      setTestResult({ ok: false, error: e.response?.data?.detail || "Test fail" });
      toast.error("Key test fail ho gaya");
    } finally { setTesting(false); }
  };

  const reset = async () => {
    try {
      const r = await api.delete("/admin/settings/ai");
      setS(r.data); setTestResult(null);
      toast.success("Environment default par reset ho gaya");
    } catch { toast.error("Reset fail ho gaya"); }
  };

  if (!s) return <div className="p-8 text-muted-foreground" data-testid="ai-settings-loading">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl space-y-6" data-testid="admin-ai-settings">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound className="w-6 h-6" /> AI Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Question import, quiz generation, AI tutor aur coach — sab isi key se chalte hain.
          VPS par host karte waqt yahan apni key daal dijiye, code change ki zaroorat nahi.
        </p>
      </div>

      <Card className="p-5 space-y-3" data-testid="ai-current-status-card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Current configuration</h2>
          <Badge variant={s.source === "admin" ? "default" : "secondary"} data-testid="ai-source-badge">
            {s.source === "admin" ? "Admin-saved key" : "Environment default"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Provider:</span> <span data-testid="ai-current-provider">{PROVIDER_LABELS[s.provider] || s.provider}</span></div>
          <div><span className="text-muted-foreground">Model:</span> <span data-testid="ai-current-model" className="font-mono text-xs">{s.effective_model}</span></div>
          <div><span className="text-muted-foreground">Key:</span> <span data-testid="ai-current-masked-key" className="font-mono text-xs">{s.masked_key || "—"}</span></div>
          <div><span className="text-muted-foreground">Env fallback:</span> <span data-testid="ai-env-fallback">{s.env_key_present ? "set" : "not set"}</span></div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={test} disabled={testing || !s.masked_key} data-testid="ai-test-key-button">
            {testing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-1" />} Test key
          </Button>
          {s.source === "admin" && (
            <Button size="sm" variant="ghost" onClick={reset} data-testid="ai-reset-button">
              <RotateCcw className="w-4 h-4 mr-1" /> Reset to env default
            </Button>
          )}
        </div>
        {testResult && (
          <div className={`text-sm flex items-center gap-2 rounded-md border p-2 ${testResult.ok ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"}`} data-testid="ai-test-result">
            {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {testResult.ok ? `OK — ${testResult.provider}/${testResult.model} replied in ${testResult.latency_ms}ms` : testResult.error}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4" data-testid="ai-save-form-card">
        <h2 className="font-semibold">Nayi key save karein</h2>
        <div className="grid gap-3">
          <div>
            <label className="text-sm text-muted-foreground">Provider</label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger data-testid="ai-provider-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v} data-testid={`ai-provider-option-${v}`}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">API key</label>
            <Input type="password" value={key} onChange={(e) => setKey(e.target.value)}
              placeholder={s.source === "admin" ? "Nayi key paste karein (puri key kabhi dikhai nahi jati)" : "sk-..."}
              data-testid="ai-key-input" autoComplete="off" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Model (optional — khali chhodo to default)</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)}
              placeholder={`default: ${s.default_models?.[provider] || ""}`}
              data-testid="ai-model-input" className="font-mono text-xs" />
          </div>
        </div>
        <Button onClick={save} disabled={saving} data-testid="ai-save-button">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save key
        </Button>
        <p className="text-xs text-muted-foreground">
          Key database mein save hoti hai aur turant sabhi AI features par lagu ho jaati hai (restart nahi chahiye).
          Save ke baad key sirf masked dikhti hai. Galti ho to "Reset to env default" se wapas ja sakte hain.
        </p>
      </Card>
      <GSheetBackupCard />
    </div>
  );
}
