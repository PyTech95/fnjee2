import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSEO } from "@/lib/useSEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, SITE, SUPPORT_EMAIL, OPERATOR, LEGAL_UPDATED } from "@/lib/appInfo";
import { dashboardFor } from "@/lib/native";

function LegalShell({ title, children, testId }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const back = () => (window.history.length > 1 ? nav(-1) : nav(user ? dashboardFor(user.role) : "/login"));
  return (
    <div data-testid={testId} className="min-h-screen bg-[#FAF7F2] text-[#09090B]">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-black/10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={back} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
          <img src="/icon-192.png" alt="" className="h-7 w-7" />
          <div className="font-semibold">{title}</div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 pb-16">{children}</main>
      <footer className="max-w-3xl mx-auto px-4 pb-10 text-xs text-black/50 flex flex-wrap gap-4"
        style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}>
        <Link to="/privacy" className="hover:underline">Privacy policy</Link>
        <Link to="/terms" className="hover:underline">Terms of use</Link>
        <Link to="/delete-account" className="hover:underline">Delete account</Link>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">{SUPPORT_EMAIL}</a>
      </footer>
    </div>
  );
}

const H = ({ children }) => <h2 className="text-lg font-semibold mt-8 mb-2">{children}</h2>;
const P = ({ children }) => <p className="text-[15px] leading-7 text-black/75 mb-3">{children}</p>;
const UL = ({ items }) => <ul className="list-disc pl-6 space-y-1.5 text-[15px] leading-7 text-black/75 mb-3">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;

export function PrivacyPolicy() {
  useSEO({ title: "Privacy Policy | FNJEE.com", description: "How FNJEE.com and the FNJEE app collect, use and protect your data.", canonical: "https://fnjee.com/privacy" });
  return (
    <LegalShell title="Privacy policy" testId="privacy-page">
      <h1 className="text-3xl font-bold tracking-tight">Privacy policy</h1>
      <p className="text-sm text-black/50 mt-1">Last updated: {LEGAL_UPDATED}</p>
      <P>This policy explains what information {OPERATOR} (“we”) collects when you use the website {SITE} and the {APP_NAME} apps for Android and iOS (together, the “Service”), how we use it and the choices you have. The apps show the same Service as the website.</P>

      <H>Information we collect</H>
      <UL items={[
        "Account details you give us: name, email address, password (stored only as a one-way hash), role (student, parent or teacher), class / target exam and, if you choose, a parent–child link.",
        "Learning data created while you use the Service: tests and questions attempted, answers, scores, time taken, streaks, coins, bookmarks, revision cards, doubts you ask the AI tutor and notes or screenshots you upload.",
        "Exam-integrity signals during a test (for example switching tabs or leaving full-screen) so teachers can review attempts.",
        "Technical data: device and browser type, app version, IP address and error logs, used to keep the Service secure and working.",
      ]} />
      <P>We do not collect your contacts, precise location, health data or payment card numbers, and we do not use advertising or cross-app tracking.</P>

      <H>Camera and photos</H>
      <P>The app asks for camera or photo access only when you choose to upload a picture of a question or your notes. The picture is sent to our server to create questions or answer your doubt and is not used for anything else.</P>

      <H>How we use information</H>
      <UL items={[
        "To run your account, tests, results, rankings and study plans.",
        "To show parents and teachers the progress of students linked to them.",
        "To send emails you have asked for, such as results, weekly digests and password help.",
        "To answer doubts, explain solutions and build practice from your notes using AI.",
        "To prevent cheating, fraud and abuse, and to fix errors.",
      ]} />

      <H>AI processing</H>
      <P>When you use AI features (AI tutor, explanations, notes-to-quiz, question import), the text or picture you submit is sent to our AI provider (Google Gemini, OpenAI or Anthropic, as configured by us) only to generate the answer. These providers process it on our behalf under their API terms, which do not allow them to use API data to train their models.</P>

      <H>Sharing</H>
      <P>We do not sell your personal information. We share it only with: service providers that host our servers, send email and provide AI processing; your linked parent or teacher; and authorities when the law requires it.</P>

      <H>Storage and security</H>
      <P>Data is stored on our servers with encrypted connections (HTTPS), hashed passwords and regular backups. Access is limited to people who need it to run the Service.</P>

      <H>Retention and deletion</H>
      <P>We keep your data while your account is active. You can delete your account and its data at any time from <Link to="/delete-account" className="text-[#0A66C2] underline">Delete account</Link> (also in the app’s profile menu). Deletion removes your profile, attempts, results, notifications and other personal data immediately; backups are overwritten within 14 days.</P>

      <H>Children</H>
      <P>The Service is meant for students preparing for school and competitive exams. Students under 18 should use it with the consent of a parent or guardian, who can create a parent account to follow progress. If you believe a child has given us data without consent, contact us and we will delete it.</P>

      <H>Your rights</H>
      <P>You can view and correct your profile in the app, download your results, and ask us for a copy or deletion of your data by writing to {SUPPORT_EMAIL}. We reply within 30 days.</P>

      <H>Changes and contact</H>
      <P>We will post any change to this policy on this page and update the date above. Questions: <a className="text-[#0A66C2] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</P>
    </LegalShell>
  );
}

export function TermsOfUse() {
  useSEO({ title: "Terms of Use | FNJEE.com", description: "Terms for using FNJEE.com and the FNJEE app.", canonical: "https://fnjee.com/terms" });
  return (
    <LegalShell title="Terms of use" testId="terms-page">
      <h1 className="text-3xl font-bold tracking-tight">Terms of use</h1>
      <p className="text-sm text-black/50 mt-1">Last updated: {LEGAL_UPDATED}</p>
      <P>By creating an account or using {SITE} or the {APP_NAME} app you agree to these terms.</P>
      <H>Your account</H>
      <UL items={[
        "Give correct details and keep your password private. You are responsible for activity on your account.",
        "Students under 18 should use the Service with a parent's or guardian's permission.",
        "You can delete your account at any time from the Delete account page.",
      ]} />
      <H>Fair use</H>
      <UL items={[
        "Do not cheat in tests, share accounts, copy or resell our questions, or try to break or overload the Service.",
        "Content you upload (questions, notes, pictures) must be yours or allowed for you to use.",
        "We may suspend accounts that break these rules.",
      ]} />
      <H>Content and AI</H>
      <P>Questions, solutions and AI answers are for practice. We work to keep them correct but cannot guarantee that every answer, rank prediction or study plan is error-free or that you will get a particular exam result.</P>
      <H>Availability</H>
      <P>We may change or pause features to improve the Service. We are not liable for indirect losses arising from use of the Service, to the extent the law allows.</P>
      <H>Governing law</H>
      <P>These terms are governed by the laws of India. Contact: <a className="text-[#0A66C2] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</P>
    </LegalShell>
  );
}

export function DeleteAccount() {
  useSEO({ title: "Delete your account | FNJEE.com", description: "Permanently delete your FNJEE.com account and data.", canonical: "https://fnjee.com/delete-account" });
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.delete("/auth/me", { data: { password, confirm } });
      setDone(true);
      logout();
      toast.success("Your account has been deleted");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not delete the account");
    } finally { setBusy(false); }
  };

  return (
    <LegalShell title="Delete account" testId="delete-account-page">
      <h1 className="text-3xl font-bold tracking-tight">Delete your account</h1>
      <P>Deleting your {APP_NAME} account permanently removes your profile, test attempts, results, rankings, coins, notifications, revision cards, AI-tutor history and links to parents or children. This cannot be undone.</P>
      <P>Questions and tests created by teachers or the institute are not personal data and stay in the question bank.</P>

      {done ? (
        <Card className="p-6 mt-6 border-emerald-500/30 bg-emerald-50" data-testid="delete-account-done">
          <div className="flex items-center gap-2 font-semibold text-emerald-800"><ShieldCheck className="h-5 w-5" /> Account deleted</div>
          <p className="text-sm text-emerald-900/80 mt-2">All your data has been removed. Backups are overwritten within 14 days.</p>
          <Button className="mt-4 rounded-full" onClick={() => nav("/login")}>OK</Button>
        </Card>
      ) : user ? (
        <Card className="p-6 mt-6 border-destructive/30" data-testid="delete-account-form">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 text-destructive" /> Signed in as {user.email} ({user.role})</div>
          <form onSubmit={submit} className="space-y-4 mt-4">
            <div className="space-y-1.5"><Label htmlFor="del-pw">Password</Label>
              <Input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="delete-password" /></div>
            <div className="space-y-1.5"><Label htmlFor="del-confirm">Type DELETE to confirm</Label>
              <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" required data-testid="delete-confirm" /></div>
            <Button type="submit" variant="destructive" className="rounded-full" disabled={busy || confirm.trim().toUpperCase() !== "DELETE" || !password} data-testid="delete-account-btn">
              <Trash2 className="h-4 w-4 mr-2" />{busy ? "Deleting…" : "Delete my account permanently"}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="p-6 mt-6" data-testid="delete-account-signin">
          <div className="font-semibold">Sign in to delete your account</div>
          <ol className="list-decimal pl-6 text-sm text-black/70 mt-2 space-y-1">
            <li>Sign in to {SITE} or the {APP_NAME} app.</li>
            <li>Open the profile menu (top right) → <b>Delete account</b>.</li>
            <li>Enter your password, type DELETE and confirm.</li>
          </ol>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button className="rounded-full" onClick={() => nav("/login?next=/delete-account")} data-testid="delete-account-login">Sign in</Button>
          </div>
          <p className="text-sm text-black/60 mt-4">Can't sign in? Email <a className="text-[#0A66C2] underline" href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20FNJEE%20account`}>{SUPPORT_EMAIL}</a> from your registered email address with the subject “Delete my FNJEE account” and we will delete it within 7 days.</p>
        </Card>
      )}
    </LegalShell>
  );
}
