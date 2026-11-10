import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useSEO } from "@/lib/useSEO";
import { Star, Users, CheckCircle2, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

export default function CoursesListing() {
  useSEO({
    title: "NEET & JEE Courses — Target Batches & Test Series · FNJEE.com",
    description: "1-year and 2-year NEET and JEE preparation courses with question banks, DPPs, CBT mock tests and analytics. NEET 2027/2028 and JEE 2027/2028 batches.",
    canonical: "https://fnjee.com/courses",
  });
  const [target, setTarget] = useState(() => new URLSearchParams(window.location.search).get("t") || "all");
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get("/courses").then((r) => setCourses(r.data));
  }, []);

  const filtered = target === "all" ? courses : courses.filter((c) => c.target === target);

  return (
    <div data-testid="courses-listing-page" className="max-w-7xl mx-auto px-6 py-14 lg:py-20">
      <div className="max-w-2xl">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Courses</div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-2">
          Practice courses built for <span className="text-primary">serious NEET &amp; JEE aspirants.</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl">
          Choose a course that gives you the exact practice, tests and analytics your target rank needs. All courses run on the same CBT engine your exam does.
        </p>
      </div>

      <div className="mt-8 flex items-center gap-4 flex-wrap">
        <Tabs value={target} onValueChange={setTarget}>
          <TabsList data-testid="courses-tabs" className="rounded-[22px] h-auto p-1 flex-wrap justify-start">
            <TabsTrigger value="all" className="rounded-full px-4">All batches</TabsTrigger>
            <TabsTrigger value="NEET 2027" className="rounded-full px-4">NEET 2027</TabsTrigger>
            <TabsTrigger value="NEET 2028" className="rounded-full px-4">NEET 2028</TabsTrigger>
            <TabsTrigger value="JEE 2027" className="rounded-full px-4">JEE 2027</TabsTrigger>
            <TabsTrigger value="JEE 2028" className="rounded-full px-4">JEE 2028</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="text-xs text-muted-foreground flex items-center gap-2 ml-auto">
          <ShieldCheck className="h-4 w-4 text-primary" /> 3-day full refund · Secure UPI / card checkout
        </div>
      </div>

      <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((c) => (
          <Card key={c.slug} data-testid={`course-card-${c.slug}`}
                className={`en-card p-6 flex flex-col relative ${c.featured ? "ring-2 ring-primary" : ""}`}>
            {c.featured && (
              <Badge className="absolute -top-3 left-6 rounded-full bg-accent text-accent-foreground gap-1">
                <Sparkles className="h-3 w-3" /> Most popular
              </Badge>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="rounded-full">{c.target}</Badge>
              <Badge variant="outline" className="rounded-full">{c.kind}</Badge>
            </div>
            <h3 className="font-display font-bold text-xl mt-4">{c.title}</h3>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.enrolments.toLocaleString()}+ enrolled</span>
              <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-current text-amber-500" /> {c.rating} ({c.reviews.toLocaleString()})</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm flex-1">
              {c.highlights.slice(0, 6).map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />{h}
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-end gap-2">
                <div className="font-display font-bold text-3xl" data-testid={`course-price-${c.slug}`}>₹{c.price.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground line-through mb-1">₹{c.mrp.toLocaleString()}</div>
                <Badge variant="outline" className="ml-auto rounded-full text-emerald-600 border-emerald-500/40">
                  Save ₹{(c.mrp - c.price).toLocaleString()}
                </Badge>
              </div>
              <div className="mt-4 flex gap-2">
                <Link to={`/courses/${c.slug}`} className="flex-1">
                  <Button data-testid={`enroll-${c.slug}`} className="w-full rounded-full">Enroll now</Button>
                </Link>
                <Link to={`/courses/${c.slug}`}>
                  <Button variant="outline" className="rounded-full">Details</Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="en-card mt-14 p-8 lg:p-10 grid md:grid-cols-[1fr,auto] items-center gap-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" /> Not sure which one fits?
          </div>
          <h3 className="font-display font-bold text-2xl mt-2">Talk to a counsellor · free 20-min call</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg">
            We'll match you to the right batch based on your current class, weak subjects and target year — no sales pitch, just the honest answer.
          </p>
        </div>
        <Link to="/#counselling"><Button size="lg" className="rounded-full px-8">Book free session</Button></Link>
      </Card>
    </div>
  );
}
