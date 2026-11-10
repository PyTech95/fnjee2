import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { analyticsApi, testsApi, rewardsApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { Flame, Trophy, Target, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [tests, setTests] = useState([]);
  const [rewards, setRewards] = useState(null);

  useEffect(() => {
    analyticsApi.student(user.id).then(setStats);
    testsApi.list().then((t) => setTests(t.slice(0, 4)));
    rewardsApi.me().then(setRewards);
  }, [user.id]);

  return (
    <div data-testid="student-dashboard" className="space-y-8">
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="en-card p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl" aria-hidden />
          <div className="relative">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Welcome back</div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">{user.name.split(" ")[0]} 👋</h1>
            <p className="text-muted-foreground mt-2 max-w-lg">You're preparing for <b>{user.exam_target || "JEE"}</b>. Keep the streak alive — every day counts.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/student/tests"><Button data-testid="cta-take-test" className="rounded-full">Take a test</Button></Link>
              <Link to="/student/rewards"><Button variant="outline" className="rounded-full">View rewards</Button></Link>
            </div>
          </div>
        </Card>

        <Card className="en-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-accent/15 text-accent grid place-items-center"><Flame className="h-6 w-6" /></div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Streak</div>
              <div className="font-display font-bold text-3xl">{rewards?.streak || 0} days</div>
            </div>
          </div>
          <Progress value={Math.min((rewards?.streak || 0) * 10, 100)} className="mt-4" />
          <div className="text-xs text-muted-foreground mt-2">Coins: <b className="text-foreground">{rewards?.coins || 0}</b> · Rank #{stats?.rank || "—"} of {stats?.total_students || 0}</div>
        </Card>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatMini icon={Target} label="Accuracy" value={`${stats?.accuracy || 0}%`} />
        <StatMini icon={TrendingUp} label="Attempts" value={stats?.attempts || 0} />
        <StatMini icon={Trophy} label="Rank" value={`#${stats?.rank || "—"}`} />
        <StatMini icon={Flame} label="Coins" value={rewards?.coins || 0} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="en-card p-6 lg:col-span-2">
          <h3 className="font-display font-semibold text-lg mb-4">Score trend</h3>
          <div className="h-64">
            {stats?.trend?.length > 0 ? (
              <ResponsiveContainer initialDimension={{ width: 1, height: 1 }} minWidth={0}>
                <LineChart data={stats.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-muted-foreground text-sm">Take your first test to see the trend.</div>
            )}
          </div>
        </Card>

        <Card className="en-card p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Subject strengths</h3>
          <div className="space-y-4">
            {Object.entries(stats?.subject_stats || {}).map(([s, st]) => {
              const acc = Math.round((st.correct / Math.max(st.total, 1)) * 100);
              return (
                <div key={s}>
                  <div className="flex justify-between text-sm"><span>{s}</span><span className="font-medium">{acc}%</span></div>
                  <Progress value={acc} className="mt-1" />
                </div>
              );
            })}
            {(!stats?.subject_stats || Object.keys(stats.subject_stats).length === 0) && <div className="text-sm text-muted-foreground">No data yet.</div>}
          </div>
        </Card>
      </div>

      <Card className="en-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg">Available tests</h3>
          <Link to="/student/tests" className="text-sm text-primary font-medium">View all →</Link>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {tests.map(t => (
            <div key={t.id} className="p-4 rounded-xl border border-border flex items-center justify-between">
              <div>
                <div className="font-semibold">{t.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.duration_minutes} min · {t.question_ids?.length} qs · {t.exam_type}</div>
              </div>
              <Link to={`/student/cbt/${t.id}`}><Button size="sm" className="rounded-full">Start</Button></Link>
            </div>
          ))}
          {tests.length === 0 && <div className="text-sm text-muted-foreground">No tests assigned.</div>}
        </div>
      </Card>
    </div>
  );
}

function StatMini({ icon: Icon, label, value }) {
  return (
    <Card className="en-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="font-display font-bold text-xl">{value}</div>
        </div>
      </div>
    </Card>
  );
}
