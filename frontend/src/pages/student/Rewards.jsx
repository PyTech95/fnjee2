import { useEffect, useState } from "react";
import { rewardsApi, analyticsApi, storeApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Flame, Trophy, Medal, Sparkles, Snowflake, Lightbulb, Repeat, Crown, ShoppingBag, Coins } from "lucide-react";

const ICONS = { flame: Flame, trophy: Trophy, medal: Medal, sparkles: Sparkles, crown: Crown, snowflake: Snowflake, lightbulb: Lightbulb, repeat: Repeat };

export default function Rewards() {
  const [r, setR] = useState(null);
  const [board, setBoard] = useState([]);
  const [refBoard, setRefBoard] = useState([]);
  const [store, setStore] = useState(null);
  const [buying, setBuying] = useState(null);

  useEffect(() => {
    rewardsApi.me().then(setR);
    analyticsApi.leaderboard("coins").then(setBoard);
    analyticsApi.leaderboard("referral").then(setRefBoard);
    storeApi.get().then(setStore);
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(r?.referral_code || "");
    toast.success("Referral code copied");
  };

  const useFreeze = async () => {
    try {
      const res = await rewardsApi.useFreeze();
      toast.success(res.message || "Streak saved!");
      rewardsApi.me().then(setR);
      storeApi.get().then(setStore);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not use freeze");
    }
  };

  const buy = async (item) => {
    setBuying(item.id);
    try {
      const res = await storeApi.buy(item.id);
      toast.success(`${item.name} unlocked! ${res.coins} coins left`);
      setStore((s) => ({ ...s, coins: res.coins, inventory: res.inventory }));
      setR((prev) => (prev ? { ...prev, coins: res.coins } : prev));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Purchase failed");
    } finally { setBuying(null); }
  };

  return (
    <div data-testid="rewards-page" className="space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Rewards</div>
        <h1 className="font-display font-bold text-3xl tracking-tight mt-1">Share & Earn</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="en-card p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 h-52 w-52 rounded-full bg-accent/15 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Your referral code</div>
            <div className="flex items-center gap-3 mt-2">
              <div className="font-display font-bold text-2xl sm:text-3xl tracking-wider sm:tracking-widest break-all">{r?.referral_code}</div>
              <Button data-testid="copy-referral" size="icon" variant="outline" className="rounded-full" onClick={copy}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3 max-w-md">Every friend who signs up with your code earns you <b>100 coins</b>. Unlock badges, premium mock tests, and mentorship sessions.</p>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg">
              <StatChip label="Coins" value={r?.coins || 0} />
              <StatChip label="Streak" value={`${r?.streak || 0}d`} />
              <StatChip label="Referrals" value={r?.referrals || 0} />
            </div>
          </div>
        </Card>

        <Card data-testid="streak-freeze-card" className="en-card p-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
              <Snowflake className="h-3.5 w-3.5 text-primary" /> Streak Freeze · monthly
            </div>
            <div className="mt-2 flex items-end gap-2">
              <div className="font-display font-bold text-3xl">{r?.freeze_available ? "1" : "0"}</div>
              <div className="text-sm text-muted-foreground pb-1">available</div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Life happens. Use your freeze on a missed day so your months-long streak stays intact.
            </p>
            <Button data-testid="use-freeze-btn" onClick={useFreeze} disabled={!r?.freeze_available}
              className="rounded-full mt-4 w-full" variant={r?.freeze_available ? "default" : "outline"}>
              <Snowflake className="h-4 w-4 mr-2" />
              {r?.freeze_available ? "Freeze today" : "Refills next month"}
            </Button>
          </div>
        </Card>
      </div>

      <Card data-testid="coin-store" className="en-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-primary" /> Coin Store</h3>
          <Badge className="rounded-full bg-primary/10 text-primary border-0 gap-1"><Coins className="h-3.5 w-3.5" /> {store?.coins ?? r?.coins ?? 0}</Badge>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {(store?.items || []).map((it) => {
            const Icon = ICONS[it.icon] || Sparkles;
            const owned = store?.inventory?.[it.field] ?? 0;
            const canAfford = (store?.coins ?? 0) >= it.cost;
            return (
              <div key={it.id} data-testid={`store-item-${it.id}`} className="rounded-2xl border border-border p-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="h-11 w-11 rounded-xl bg-accent/15 text-accent grid place-items-center"><Icon className="h-5 w-5" /></div>
                  {owned > 0 && <Badge variant="secondary" className="rounded-full">x{owned}</Badge>}
                </div>
                <div className="font-medium mt-3">{it.name}</div>
                <div className="text-xs text-muted-foreground mt-1 flex-1">{it.desc}</div>
                <Button data-testid={`buy-${it.id}`} onClick={() => buy(it)} disabled={!canAfford || buying === it.id}
                  className="rounded-full mt-4 w-full" variant={canAfford ? "default" : "outline"}>
                  <Coins className="h-4 w-4 mr-2" />
                  {buying === it.id ? "Buying…" : canAfford ? `Buy · ${it.cost}` : `Need ${it.cost}`}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="en-card p-6">
        <h3 className="font-display font-semibold text-lg mb-3">Badges</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(r?.badges || []).map((b, i) => {
            const Icon = ICONS[b.icon] || Sparkles;
            return (
              <div key={i} className="p-3 rounded-xl border border-border text-center">
                <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent grid place-items-center mx-auto"><Icon className="h-5 w-5" /></div>
                <div className="text-xs font-medium mt-2">{b.name}</div>
              </div>
            );
          })}
          {(!r?.badges || r.badges.length === 0) && <div className="text-sm text-muted-foreground col-span-full">Take a test to earn your first badge.</div>}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="en-card p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Coin leaderboard</h3>
          <div className="space-y-2">
            {board.map((b, i) => (
              <div key={b.user.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center font-display font-bold text-sm">#{i+1}</div>
                  <div className="font-medium text-sm">{b.user.name}</div>
                </div>
                <Badge variant="secondary" className="rounded-full">{b.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="en-card p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Referral leaderboard</h3>
          <div className="space-y-2">
            {refBoard.length === 0 && <div className="text-sm text-muted-foreground">Be the first to invite friends!</div>}
            {refBoard.map((b, i) => (
              <div key={b.user.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-accent/10 text-accent grid place-items-center font-display font-bold text-sm">#{i+1}</div>
                  <div className="font-medium text-sm">{b.user.name}</div>
                </div>
                <Badge variant="secondary" className="rounded-full">{b.count} invites</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="rounded-xl bg-card border border-border p-2.5 sm:p-3 min-w-0">
      <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide sm:tracking-widest truncate">{label}</div>
      <div className="font-display font-bold text-xl sm:text-2xl mt-1 truncate">{value}</div>
    </div>
  );
}
