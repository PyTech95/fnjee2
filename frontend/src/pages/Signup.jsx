import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { dashboardFor } from "@/lib/native";

const EXAMS = ["JEE", "NEET", "JEE + NEET", "Olympiad", "Board exams", "Other"];

// Admin and teacher accounts are created by the institute, never by public sign-up.
export default function Signup() {
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ name: "", email: "", password: "", referral_code: "", child_email: "", exam_target: "JEE" });
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { signup, user, loading } = useAuth();
  const nav = useNavigate();
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ?ref=CODE from an invite link fills the referral code
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) upd("referral_code", ref);
  }, []);
  useEffect(() => { if (!loading && user) nav(dashboardFor(user.role), { replace: true }); /* eslint-disable-next-line */ }, [loading, user]);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    try {
      const u = await signup({ ...form, name: form.name.trim(), email: form.email.trim(), role });
      toast.success(`Account created! Welcome ${u.name}`);
      nav(dashboardFor(u.role));
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Signup failed — check your details");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="signup-page" className="min-h-[100dvh] flex items-start sm:items-center justify-center bg-muted/30 px-4 py-6 sm:p-8"
      style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
      <Card className="w-full max-w-lg p-5 sm:p-8 rounded-3xl border-border">
        <Link to="/" className="flex items-center gap-2 mb-5">
          <div className="h-9 w-9 rounded-xl bg-white grid place-items-center shadow-sm border border-border"><img src="/icon-192.png" alt="FNJEE.com" className="h-7 w-7" /></div>
          <span className="font-display font-bold text-xl tracking-tight">FNJEE.com</span>
        </Link>
        <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">Pick your role and get started in seconds.</p>

        <Tabs value={role} onValueChange={setRole}>
          <TabsList data-testid="signup-role-tabs" className="grid w-full grid-cols-2 rounded-full h-auto p-1">
            <TabsTrigger value="student" className="rounded-full py-2">Student</TabsTrigger>
            <TabsTrigger value="parent" className="rounded-full py-2">Parent</TabsTrigger>
          </TabsList>
          <TabsContent value={role} className="mt-5">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="signup-name">Full name</Label>
                <Input id="signup-name" data-testid="signup-name" required autoComplete="name" value={form.name}
                  onChange={(e) => upd("name", e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" data-testid="signup-email" type="email" inputMode="email" autoComplete="email"
                  autoCapitalize="none" spellCheck={false} required value={form.email}
                  onChange={(e) => upd("email", e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input id="signup-password" data-testid="signup-password" type={showPw ? "text" : "password"} required minLength={8}
                    autoComplete="new-password" className="pr-11" value={form.password}
                    onChange={(e) => upd("password", e.target.value)} placeholder="At least 8 characters" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 w-11 grid place-items-center text-muted-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {role === "student" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Exam target</Label>
                    <Select value={form.exam_target} onValueChange={(v) => upd("exam_target", v)}>
                      <SelectTrigger data-testid="signup-exam"><SelectValue /></SelectTrigger>
                      <SelectContent>{EXAMS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-ref">Referral code (optional)</Label>
                    <Input id="signup-ref" value={form.referral_code} autoCapitalize="characters"
                      onChange={(e) => upd("referral_code", e.target.value)} placeholder="EXN…" />
                  </div>
                </>
              )}
              {role === "parent" && (
                <div className="space-y-1.5">
                  <Label htmlFor="signup-child">Your child's email (student account)</Label>
                  <Input id="signup-child" data-testid="signup-child-email" type="email" inputMode="email" autoCapitalize="none"
                    value={form.child_email} onChange={(e) => upd("child_email", e.target.value)} placeholder="child@example.com" />
                </div>
              )}
              <Button data-testid="signup-submit" disabled={busy} className="w-full rounded-full h-11">{busy ? "Creating…" : "Create account"}</Button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                By creating an account you agree to the <Link to="/terms" className="underline">Terms of use</Link> and{" "}
                <Link to="/privacy" className="underline">Privacy policy</Link>.
              </p>
            </form>
          </TabsContent>
        </Tabs>
        <div className="mt-5 text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </div>
      </Card>
    </div>
  );
}
