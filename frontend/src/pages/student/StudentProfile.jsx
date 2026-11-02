import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { profileApi, rewardsApi } from "@/lib/api";
import { toast } from "sonner";
import { Mail, Clock, Eye, Flame, Trophy, Medal, Crown, Sparkles } from "lucide-react";

const BADGE_ICONS = { flame: Flame, trophy: Trophy, medal: Medal, crown: Crown, sparkles: Sparkles };
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6:00 AM – 11:00 PM
const fmtHour = (h) => {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
};

export default function StudentProfile() {
  const { user, setUser } = useAuth();
  const [emailOn, setEmailOn] = useState(user?.email_results_enabled !== false);
  const [reminderHour, setReminderHour] = useState(String(user?.reminder_hour ?? 19));
  const [saving, setSaving] = useState(false);
  const [badges, setBadges] = useState([]);

  useEffect(() => { rewardsApi.me().then((r) => setBadges(r.badges || [])).catch(() => {}); }, []);

  const toggleEmail = async (v) => {
    setEmailOn(v); setSaving(true);
    try {
      const u = await profileApi.updateSettings({ email_results_enabled: v });
      setUser(u);
      toast.success(v ? "Result emails turned on" : "Result emails turned off");
    } catch {
      setEmailOn(!v);
      toast.error("Could not update setting");
    } finally { setSaving(false); }
  };

  const saveReminderHour = async (v) => {
    setReminderHour(v); setSaving(true);
    try {
      const u = await profileApi.updateSettings({ reminder_hour: Number(v) });
      setUser(u);
      toast.success(`Reminder set for ${fmtHour(Number(v))}`);
    } catch {
      toast.error("Could not update reminder time");
    } finally { setSaving(false); }
  };

  const streak = user?.streak_days || 0;
  const pinnedBadge = user?.pinned_badge;

  const pinBadge = async (name) => {
    const next = pinnedBadge === name ? "" : name;
    try {
      const u = await profileApi.updateSettings({ pinned_badge: next });
      setUser(u);
      toast.success(next ? `Pinned "${name}" to the leaderboard` : "Badge unpinned");
    } catch { toast.error("Could not update pinned badge"); }
  };

  return (
    <div data-testid="student-profile" className="space-y-6 max-w-2xl">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Profile</div>
        <h1 className="font-display font-bold text-3xl tracking-tight mt-1">You</h1>
      </div>
      <Card className="en-card p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16"><AvatarImage src={user?.avatar} /><AvatarFallback>{user?.name?.[0]}</AvatarFallback></Avatar>
          <div>
            <div className="font-display font-bold text-xl">{user?.name}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
            <Badge variant="secondary" className="rounded-full mt-2">{user?.exam_target || "JEE"}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Field label="Coins" value={user?.reward_coins || 0} />
          <Field label="Streak" value={`${user?.streak_days || 0} days`} />
          <Field label="Referral code" value={user?.referral_code} />
          <Field label="Joined" value={(user?.created_at || "").slice(0, 10)} />
        </div>
      </Card>

      <Card className="en-card p-6">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Notifications</div>
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl grid place-items-center bg-primary/10 text-primary shrink-0"><Mail className="h-5 w-5" /></div>
            <div>
              <div className="font-medium">Email me my results</div>
              <div className="text-sm text-muted-foreground">Get a scorecard emailed to you right after you submit a test.</div>
            </div>
          </div>
          <Switch data-testid="toggle-email-results" checked={emailOn} disabled={saving} onCheckedChange={toggleEmail} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mt-5 pt-5 border-t border-border">
          <div className="flex items-start gap-3 min-w-0 flex-1 basis-56">
            <div className="h-10 w-10 rounded-xl grid place-items-center bg-accent/15 text-accent shrink-0"><Clock className="h-5 w-5" /></div>
            <div>
              <div className="font-medium">Streak reminder time</div>
              <div className="text-sm text-muted-foreground">When we nudge you to keep your streak alive.</div>
            </div>
          </div>
          <Select value={reminderHour} onValueChange={saveReminderHour} disabled={saving}>
            <SelectTrigger data-testid="reminder-hour-select" className="w-36 rounded-full ml-[52px] sm:ml-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => <SelectItem key={h} value={String(h)}>{fmtHour(h)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button data-testid="preview-reminder-btn" variant="outline" size="sm" className="rounded-full mt-4 ml-[52px]">
              <Eye className="h-4 w-4 mr-2" /> Preview reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md p-0 overflow-hidden" data-testid="reminder-preview-dialog">
            <div className="bg-primary px-6 py-4">
              <div className="text-white font-display font-bold text-lg">FNJEE.com</div>
              <div className="text-white/80 text-xs">Keep your streak alive 🔥</div>
            </div>
            <div className="p-6 text-center">
              <div className="text-4xl font-display font-bold text-orange-500">{streak}🔥</div>
              <div className="text-xs text-muted-foreground">day streak</div>
              <p className="text-base font-medium mt-4">Hi {user?.name?.split(" ")[0]}, you haven't practised today.</p>
              <p className="text-sm text-muted-foreground mt-1">
                One quick mock or DPP keeps your <b>{streak}-day</b> streak going. It arrives daily at {fmtHour(Number(reminderHour))}.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </Card>

      <Card data-testid="milestone-badges" className="en-card p-6">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Milestone badges</div>
        <div className="text-sm text-muted-foreground mt-1">Tap a badge to pin it beside your name on leaderboards.</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {badges.map((b, i) => {
            const Icon = BADGE_ICONS[b.icon] || Sparkles;
            const pinned = pinnedBadge === b.name;
            return (
              <button key={i} data-testid={`pin-badge-${i}`} onClick={() => pinBadge(b.name)}
                className={`p-4 rounded-2xl border text-center relative overflow-hidden group transition-all ${pinned ? "border-accent ring-2 ring-accent/40 bg-accent/5" : "border-border hover:border-accent/50"}`}>
                <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-accent/20 blur-2xl group-hover:bg-accent/40 transition-colors" aria-hidden />
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-accent/30 to-primary/20 text-accent grid place-items-center mx-auto relative">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-xs font-semibold mt-2 relative">{b.name}</div>
                {pinned && <div className="text-[10px] font-bold text-accent uppercase tracking-widest mt-1 relative">Pinned</div>}
              </button>
            );
          })}
          {badges.length === 0 && <div className="text-sm text-muted-foreground col-span-full">Keep a streak going to earn shiny badges.</div>}
        </div>
      </Card>
    </div>
  );
}
function Field({ label, value }) {
  return (
    <div className="p-3 rounded-xl border border-border">
      <div className="text-xs text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="font-medium mt-1">{value}</div>
    </div>
  );
}
