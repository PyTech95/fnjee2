import { useEffect, useState } from "react";
import { shareContent } from "@/lib/native";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Users, Gift, Share2 } from "lucide-react";

export default function ReferralWidget() {
  const [data, setData] = useState(null);

  useEffect(() => { api.get("/referrals/me").then((r) => setData(r.data)).catch(() => {}); }, []);

  const link = data ? `${window.location.origin}${data.invite_link}` : "";

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success("Referral link copied to clipboard"); }
    catch { toast.error("Copy failed — long-press to copy manually"); }
  };
  const share = async () => {
    const ok = await shareContent({ title: "FNJEE.com", text: "Join me on FNJEE.com — practice NEET/JEE mocks:", url: link });
    if (!ok) copy();
  };

  if (!data) return null;

  return (
    <Card data-testid="referral-widget" className="en-card p-6 relative overflow-hidden">
      <div className="absolute -right-8 -bottom-10 h-40 w-40 rounded-full bg-accent/15 blur-2xl" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-accent/15 text-accent grid place-items-center"><Gift className="h-5 w-5" /></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Refer & earn</div>
            <div className="font-display font-bold text-lg">Give a week, get a week.</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Every friend who joins with your code unlocks <b className="text-foreground">{data.bonus_days_per_friend} free days</b> for both of you.
        </p>

        <div className="mt-4 flex items-center gap-2 p-2 rounded-full border border-border bg-muted/40">
          <div className="pl-3 font-mono text-sm truncate flex-1" data-testid="referral-link">{link}</div>
          <Button data-testid="referral-copy" size="sm" onClick={copy} className="rounded-full">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Friends</div>
            <div className="font-display font-bold text-2xl mt-1" data-testid="referral-count">{data.referral_count}</div>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Free days</div>
            <div className="font-display font-bold text-2xl mt-1 text-primary" data-testid="referral-days">{data.bonus_days_unlocked}</div>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coins</div>
            <div className="font-display font-bold text-2xl mt-1">{data.coins_earned}</div>
          </div>
        </div>

        <Button data-testid="referral-share" onClick={share} variant="outline" className="w-full rounded-full mt-4">
          <Share2 className="h-4 w-4 mr-2" /> Share with a friend
        </Button>
      </div>
    </Card>
  );
}
