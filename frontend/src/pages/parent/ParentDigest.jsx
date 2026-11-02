import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, digestApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Mail, TrendingUp, TrendingDown, Minus, AlertCircle, Flame } from "lucide-react";
import { toast } from "sonner";

export default function ParentDigest() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [child, setChild] = useState(null);
  const [digest, setDigest] = useState(null);

  useEffect(() => {
    (async () => {
      if (!user.child_ids?.length) return;
      const cs = await Promise.all(user.child_ids.map(id => usersApi.get(id)));
      setChildren(cs); setChild(cs[0]);
    })();
  }, [user]);
  useEffect(() => {
    if (child) digestApi.weekly(child.id).then(setDigest).catch(() => setDigest(null));
  }, [child]);

  const emailIt = () => toast.success(`Weekly digest emailed to ${user.email} (mocked — real email coming soon)`);

  if (!user.child_ids?.length) {
    return <div data-testid="parent-digest" className="text-sm text-muted-foreground">No child linked to your account.</div>;
  }

  const trendIcon = !digest ? Minus : digest.delta_pct > 0 ? TrendingUp : digest.delta_pct < 0 ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const trendColor = !digest ? "text-muted-foreground" : digest.delta_pct > 0 ? "text-emerald-600" : digest.delta_pct < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div data-testid="parent-digest" className="space-y-8 max-w-3xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Weekly digest</div>
          <h1 className="font-display font-bold text-3xl tracking-tight mt-2">Sunday recap</h1>
          <p className="text-muted-foreground mt-1">Everything that matters from your child's week.</p>
        </div>
        <div className="flex gap-2">
          {children.length > 1 && (
            <Select value={child?.id} onValueChange={(v) => setChild(children.find(c => c.id === v))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button data-testid="email-digest" variant="outline" className="rounded-full" onClick={emailIt}>
            <Mail className="h-4 w-4 mr-2" /> Email me this
          </Button>
        </div>
      </div>

      {!digest && <div className="text-sm text-muted-foreground">Loading digest…</div>}

      {digest && (
        <Card className="en-card p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14"><AvatarImage src={digest.child.avatar} /><AvatarFallback>{digest.child.name?.[0]}</AvatarFallback></Avatar>
              <div>
                <div className="font-display font-bold text-2xl">{digest.child.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full">{digest.child.exam_target || "JEE"}</Badge>
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-accent" /> {digest.streak_days}-day streak</span>
                </div>
              </div>
            </div>
            {/* Message */}
            <p className="text-lg mt-6 leading-relaxed">{digest.message}</p>

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6">
              <Stat label="Mocks this week" value={digest.week_attempts} />
              <Stat label="Avg score" value={`${digest.week_avg_pct}%`} />
              <Stat label="Vs last weeks" value={`${digest.delta_pct >= 0 ? "+" : ""}${digest.delta_pct}pp`} icon={TrendIcon} tint={trendColor} />
            </div>

            {digest.weak_subject && (
              <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Weakest subject: {digest.weak_subject} ({digest.weak_accuracy}% accuracy)</div>
                  <div className="text-xs mt-1 opacity-80">Nudge your child to drill this subject for 30 minutes daily next week.</div>
                </div>
              </div>
            )}

            {digest.recent.length > 0 && (
              <div className="mt-6">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Recent mocks</div>
                <div className="space-y-1.5">
                  {digest.recent.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                      <div className="truncate">{r.date}</div>
                      <div className="font-medium">{r.score} / {r.total}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, tint }) {
  return (
    <div className="p-2.5 sm:p-4 rounded-xl border border-border min-w-0">
      <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide sm:tracking-widest leading-tight">{label}</div>
      <div className={`font-display font-bold text-[15px] sm:text-2xl mt-1 flex items-center gap-1 whitespace-nowrap ${tint || ""}`}>
        {Icon && <Icon className="hidden sm:block h-5 w-5 shrink-0" />}
        {value}
      </div>
    </div>
  );
}
