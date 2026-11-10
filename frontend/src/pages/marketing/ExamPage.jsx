import { useParams, useLocation, Link, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useSEO } from "@/lib/useSEO";
import { EXAM_PAGES } from "@/lib/marketingData";
import { CheckCircle2, ChevronRight, Sparkles, Target, TrendingUp } from "lucide-react";

const ORIGIN = "https://fnjee.com";

export default function ExamPage() {
  // Static routes (/jee, /neet, …) don't yield a param via useParams; derive from pathname.
  const params = useParams();
  const location = useLocation();
  const slug = params.slug || location.pathname.replace(/^\//, "").split("/")[0];
  const exam = EXAM_PAGES[slug];

  useSEO({
    title: exam ? `${exam.heroHeadline} · FNJEE.com` : "FNJEE.com",
    description: exam?.heroSub,
    canonical: exam ? `${ORIGIN}/${exam.slug}` : undefined,
    jsonLd: exam ? [
      {
        "@context": "https://schema.org",
        "@type": "Course",
        "name": `${exam.name} Online Test Series`,
        "description": exam.heroSub,
        "provider": { "@type": "Organization", "name": "FNJEE.com", "url": ORIGIN },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": exam.faqs.map(f => ({
          "@type": "Question", "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      },
    ] : undefined,
  });

  if (!exam) return <Navigate to="/" replace />;

  return (
    <div data-testid={`exam-page-${exam.slug}`}>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 en-grid-bg opacity-30" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-16 lg:pt-20 lg:pb-20">
          <Badge className="rounded-full mb-5 bg-secondary/15 text-secondary hover:bg-secondary/20 border border-secondary/30">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> {exam.tagline}
          </Badge>
          <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05] max-w-4xl">
            {exam.heroHeadline}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl leading-relaxed">{exam.heroSub}</p>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl italic">{exam.hook}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup"><Button data-testid={`${exam.slug}-cta-start`} size="lg" className="rounded-full px-8">{exam.cta} <ChevronRight className="h-4 w-4 ml-1" /></Button></Link>
            <Link to="/pricing"><Button size="lg" variant="outline" className="rounded-full px-8">See plans & pricing</Button></Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-4xl">
            {exam.stats.map((s) => (
              <Card key={s.label} className="en-card p-5" data-testid={`${exam.slug}-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="font-display font-bold text-2xl sm:text-3xl">{s.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{s.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SUBJECTS */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">Subjects covered</div>
        <div className="flex flex-wrap gap-2">
          {exam.subjects.map((s) => (
            <div key={s} className="rounded-full bg-muted px-4 py-2 text-sm font-medium">{s}</div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-card/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
          <div className="max-w-2xl mb-10">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">What's inside</div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">Everything your rank needs.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exam.features.map((f, i) => (
              <Card key={f.title} className="en-card p-6 en-fade-up" style={{animationDelay: `${i*60}ms`}}>
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4"><Target className="h-5 w-5" /></div>
                <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* HOW YOU'LL WIN */}
      <section className="max-w-7xl mx-auto px-6 py-16 lg:py-20 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">How you'll actually win</div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">Practice → analyse → drill → repeat.</h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">Every mock feeds our AI. Our AI feeds you a personalised weak-topic drill. You come back stronger next week. That's the loop that builds ranks.</p>
        </div>
        <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
          {[
            {step: 1, title: "Take a full CBT mock", body: "Exactly like the real paper — timer, palette, everything."},
            {step: 2, title: "Get chapter-wise analytics", body: "See exactly where you leaked marks and where you shone."},
            {step: 3, title: "AI drills your weakness", body: "A 15-min targeted drill on your 3 weakest topics — every week."},
            {step: 4, title: "Track your predicted rank", body: "Watch it climb, mock after mock. The scoreboard doesn't lie."},
          ].map((s) => (
            <Card key={s.step} className="en-card p-5 flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display font-bold">{s.step}</div>
              <div>
                <div className="font-semibold">{s.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{s.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQs */}
      <section className="bg-card/40 border-y border-border">
        <div className="max-w-4xl mx-auto px-6 py-16 lg:py-20">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">FAQ</div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">Common questions from {exam.short} aspirants</h2>
          <Accordion type="single" collapsible className="mt-8">
            {exam.faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} data-testid={`${exam.slug}-faq-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
        <Card className="bg-primary text-primary-foreground p-10 lg:p-14 rounded-3xl border-0 relative overflow-hidden">
          <div className="absolute inset-0 en-grid-bg opacity-10" aria-hidden />
          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight leading-tight">Take your first {exam.short} mock — free.</h2>
              <p className="mt-4 text-primary-foreground/80 max-w-lg">30 seconds to sign up. Full CBT interface. Instant rank estimate.</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link to="/signup"><Button data-testid={`${exam.slug}-cta-footer`} size="lg" variant="secondary" className="rounded-full px-8">{exam.cta}</Button></Link>
              <Link to={`/${exam.slug === "jee" ? "neet" : "jee"}`}><Button size="lg" variant="outline" className="rounded-full px-8 border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">Also prepping {exam.slug === "jee" ? "NEET" : "JEE"}?</Button></Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
