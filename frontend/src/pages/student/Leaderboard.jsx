import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { analyticsApi, testsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Flame, Crown, Medal, Radio, Sparkles } from "lucide-react";

const POLL_MS = 5000;
const BADGE_ICONS = { flame: Flame, trophy: Trophy, medal: Medal, crown: Crown, sparkles: Sparkles };

export default function Leaderboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tests, setTests] = useState([]);
  const [selected, setSelected] = useState(params.get("test") || "overall");
  const [data, setData] = useState(null);
  const [ago, setAgo] = useState(0);
  const lastFetch = useRef(Date.now());

  useEffect(() => { testsApi.list().then((t) => setTests(t || [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    try {
      const testId = selected === "overall" ? undefined : selected;
      const res = await analyticsApi.liveLeaderboard(testId);
      setData(res);
      lastFetch.current = Date.now();
      setAgo(0);
    } catch { /* keep last data on transient errors */ }
  }, [selected]);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setAgo(Math.round((Date.now() - lastFetch.current) / 1000)), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  const onSelect = (v) => {
    setSelected(v);
    if (v === "overall") { params.delete("test"); } else { params.set("test", v); }
    setParams(params, { replace: true });
  };

  const rows = data?.rows || [];
  const isTest = data?.kind === "test";
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div data-testid="leaderboard-page" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
            <Radio className="h-3.5 w-3.5" /> Live class leaderboard
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">
            {isTest ? (data?.test?.title || "Test ranking") : "Top aspirants"}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2.5 w-2.5" data-testid="live-indicator">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Live · updates every 5s · synced {ago}s ago
          </div>
        </div>
        <div className="w-full sm:w-72">
          <Select value={selected} onValueChange={onSelect}>
            <SelectTrigger data-testid="leaderboard-scope" className="rounded-full">
              <SelectValue placeholder="Choose ranking" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overall">Overall · reward coins</SelectItem>
              {tests.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end">
          {[1, 0, 2].map((slot) => {
            const r = podium[slot];
            if (!r) return <div key={slot} />;
            const heights = ["h-28", "h-36", "h-24"];
            const order = slot === 0 ? "order-2" : slot === 1 ? "order-1" : "order-3";
            const ring = slot === 0 ? "ring-amber-400" : slot === 1 ? "ring-slate-300" : "ring-orange-400";
            const Icon = slot === 0 ? Crown : Medal;
            const mine = r.user.id === data?.you;
            return (
              <div key={slot} className={`flex flex-col items-center ${order}`} data-testid={`podium-${slot + 1}`}>
                <div className={`h-14 w-14 rounded-2xl grid place-items-center bg-primary/10 text-primary font-display font-bold ring-2 ${ring} ${mine ? "ring-offset-2 ring-offset-background" : ""}`}>
                  {(r.user.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="mt-2 text-sm font-medium text-center truncate max-w-[9rem]">{r.user.name}{mine && " (You)"}</div>
                {r.user.pinned_badge && (() => { const BI = BADGE_ICONS[r.user.pinned_badge_icon] || Medal; return (
                  <span title={r.user.pinned_badge} data-testid="podium-pinned-badge" className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-accent/15 text-accent px-1.5 py-0.5 text-[10px] font-semibold">
                    <BI className="h-3 w-3" />{r.user.pinned_badge}
                  </span>); })()}
                <div className="text-xs text-muted-foreground">{r.score} {isTest ? "pts" : "coins"}</div>
                <div className={`mt-2 w-full ${heights[slot]} rounded-t-2xl bg-gradient-to-t from-primary/20 to-primary/5 border border-border grid place-items-start justify-center pt-2`}>
                  <Icon className={`h-6 w-6 ${slot === 0 ? "text-amber-500" : slot === 1 ? "text-slate-400" : "text-orange-500"}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card className="en-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-lg">Full ranking</h3>
          <Badge variant="secondary" className="rounded-full ml-auto">{rows.length} on board</Badge>
        </div>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center" data-testid="leaderboard-empty">
            No submissions yet. Rankings appear here the moment students submit.
          </div>
        ) : (
          <div className="space-y-2">
            {(rest.length ? rest : rows).map((r) => {
              const mine = r.user.id === data?.you;
              return (
                <div key={r.user.id}
                  data-testid={`leaderboard-row-${r.rank}`}
                  className={`flex items-center justify-between gap-2 p-3 rounded-xl transition-colors ${mine ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/40 hover:bg-muted/70"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 shrink-0 rounded-lg grid place-items-center bg-background border border-border font-display font-bold text-sm tabular-nums">#{r.rank}</div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{r.user.name}</span>
                        {r.user.pinned_badge && (() => { const BI = BADGE_ICONS[r.user.pinned_badge_icon] || Sparkles; return (
                          <span title={r.user.pinned_badge} className="inline-flex items-center gap-0.5 rounded-full bg-accent/15 text-accent px-1.5 py-0.5 text-[10px] font-semibold shrink-0" data-testid="leaderboard-pinned-badge">
                            <BI className="h-3 w-3" />{r.user.pinned_badge}
                          </span>); })()}
                        {mine && <span className="text-primary shrink-0">· You</span>}
                      </div>
                      {isTest ? (
                        <div className="text-xs text-muted-foreground">{r.correct}✓ · {r.wrong}✗{r.time_taken_seconds ? ` · ${Math.round(r.time_taken_seconds / 60)}m` : ""}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">{r.user.exam_target || "Aspirant"} {r.streak ? <><Flame className="h-3 w-3 text-orange-500" />{r.streak}d</> : null}</div>
                      )}
                    </div>
                  </div>
                  <Badge variant={mine ? "default" : "secondary"} className="rounded-full tabular-nums shrink-0 whitespace-nowrap">{r.score} {isTest ? "pts" : "coins"}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
