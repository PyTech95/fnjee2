import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useSEO } from "@/lib/useSEO";
import { TESTIMONIALS } from "@/lib/marketingData";
import { CheckCircle2, Clock, BarChart3, Brain, BookOpen, Zap, Shield, Award, Sparkles } from "lucide-react";

const ORIGIN = "https://exam-builder-hub.emergent.host";

/* ---------------- FEATURES ---------------- */
export function Features() {
  useSEO({
    title: "Features — CBT engine, deep analytics & AI recommendations · FNJEE.com",
    description: "Real NTA-style CBT interface, chapter-wise analytics, All India rank prediction, AI weak-topic drills, 5+ lakh question bank, daily practice streaks and multi-exam coverage.",
    canonical: `${ORIGIN}/features`,
  });
  const groups = [
    { icon: Clock, title: "Real CBT Experience", body: "NTA-identical palette, timer with auto-submit, section switch, mark-for-review, save & next, clear response. Everything works exactly like the real JEE / NEET paper." },
    { icon: Zap, title: "Daily Practice Layer", body: "Daily Practice Problems (DPP), streak tracking, baby-tests (30 Q / 30 min), chapter-wise mini-mocks. Build the habit of touching the CBT engine every day." },
    { icon: BarChart3, title: "Deep Analytics & Rank Prediction", body: "Chapter-wise accuracy, speed-vs-accuracy quadrant, subject strength map, weekly improvement trend, and predicted All India Rank after every mock." },
    { icon: Brain, title: "AI-Powered Recommendations", body: "Our AI watches your attempts, spots your 3 weakest concepts, and generates a 15-min targeted drill. Personalised study plans that actually adapt." },
    { icon: BookOpen, title: "Massive Question Bank", body: "5 lakh+ curated questions with solutions — NCERT-tagged NEET MCQs, JEE PYQs, chapter-wise & topic-wise, single-correct / multi-correct / integer / assertion-reason." },
    { icon: Award, title: "Multi-Exam Coverage", body: "JEE Main / Advanced, NEET UG, Olympiads (NSO, IMO, NSTSE, NTSE), Govt exams (SSC CGL/CHSL, IBPS, SBI, RRB) — one CBT platform." },
    { icon: Shield, title: "Reattempts & solutions library", body: "Retake any mock unlimited times. Watch step-by-step solutions. Bookmark for last-week revision." },
    { icon: Sparkles, title: "Mobile & PWA-friendly", body: "Works fully in your mobile browser. Installable as a Progressive Web App — no Play Store or App Store required." },
  ];
  return (
    <div data-testid="features-page" className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
      <div className="max-w-2xl mb-10">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Features</div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-2">Every module a serious aspirant needs.</h1>
        <p className="text-muted-foreground mt-4">Eight modules, one login. No plugins, no switching.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {groups.map((g, i) => (
          <Card key={g.title} className="en-card p-6" data-testid={`feature-block-${i}`}>
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4"><g.icon className="h-5 w-5" /></div>
            <h3 className="font-display font-semibold text-xl">{g.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{g.body}</p>
          </Card>
        ))}
      </div>
      <div className="mt-14 text-center">
        <Link to="/signup"><Button size="lg" className="rounded-full px-8">Start free mock</Button></Link>
      </div>
    </div>
  );
}

/* ---------------- HOW IT WORKS ---------------- */
export function HowItWorks() {
  useSEO({
    title: "How it works — from signup to rank prediction in 3 minutes · FNJEE.com",
    description: "Sign up in 30 seconds, pick your exam, take your first CBT mock, and see your predicted rank + AI weak-topic drill — all inside 3 minutes.",
    canonical: `${ORIGIN}/how-it-works`,
  });
  const steps = [
    { n: 1, title: "Sign up in 30 seconds", body: "Use your email. No credit card. No spam. Pick your exam target (JEE / NEET / other)." },
    { n: 2, title: "Choose a test", body: "Pick a full mock, a chapter-wise test, or generate your own custom paper by subject + chapter + count." },
    { n: 3, title: "Attempt the CBT", body: "Real NTA-style palette, timer, section switch. Auto-submits when time runs out." },
    { n: 4, title: "Get instant analytics", body: "Chapter-wise accuracy, speed, subject heatmap, predicted All India Rank — all within seconds of submitting." },
    { n: 5, title: "Follow your AI plan", body: "Weak-topic drills scheduled for the coming week. Repeat next Sunday — watch the rank climb." },
  ];
  return (
    <div data-testid="how-it-works-page" className="max-w-5xl mx-auto px-6 py-16 lg:py-20">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">How it works</div>
      <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-2">From signup to rank prediction in 3 minutes.</h1>
      <p className="text-muted-foreground mt-4 max-w-2xl">Five steps. That's it.</p>
      <div className="mt-10 space-y-4">
        {steps.map((s, i) => (
          <Card key={s.n} className="en-card p-6 flex items-start gap-5" data-testid={`step-${s.n}`}>
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display font-bold text-lg">{s.n}</div>
            <div>
              <div className="font-display font-semibold text-lg">{s.title}</div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-12">
        <Link to="/signup"><Button size="lg" className="rounded-full px-8">Start now</Button></Link>
      </div>
    </div>
  );
}

/* ---------------- PRICING ---------------- */
export function Pricing() {
  useSEO({
    title: "Pricing — Free CBT mocks & premium JEE / NEET test series · FNJEE.com",
    description: "Free forever plan with unlimited full CBT mocks. Premium courses starting ₹399 for JEE, NEET and combo packs. All plans include AI analytics and rank prediction.",
    canonical: `${ORIGIN}/pricing`,
  });
  const plans = [
    { name: "Free", price: "₹0", period: "forever", cta: "Start free", features: ["Unlimited CBT mocks", "Basic analytics", "5,000+ practice questions", "Rank estimate on full mocks"], featured: false },
    { name: "Starter", price: "₹399", period: "/ course", cta: "Start at ₹399", features: ["Masterclass in Biology", "NCERT-line coverage", "3-day full refund", "Web + mobile app"], featured: false },
    { name: "Serious", price: "₹799", period: "/ course", cta: "Get serious", features: ["Target Batch Ascend NEET 2027", "AI weak-topic drills", "Chapter-wise + PYQs", "Full analytics + heatmap", "Reattempts unlocked"], featured: true },
    { name: "Combo", price: "₹1,499", period: "/ 2 years", cta: "Combo it", features: ["Target AIIMS Batch NEET 2028", "All features unlocked", "1-on-1 monthly mentor call", "Priority support"], featured: false },
  ];
  return (
    <div data-testid="pricing-page" className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Pricing</div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-2">Fair pricing. Serious rank.</h1>
        <p className="text-muted-foreground mt-4">Start free forever. Upgrade only when your rank asks for it.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
        {plans.map((p) => (
          <Card key={p.name} data-testid={`plan-${p.name.toLowerCase()}`}
            className={`p-6 rounded-3xl relative ${p.featured ? "bg-primary text-primary-foreground border-primary" : "en-card"}`}>
            {p.featured && <Badge className="absolute -top-3 left-6 rounded-full bg-accent text-accent-foreground">Most popular</Badge>}
            <div className="text-sm uppercase tracking-widest opacity-70">{p.name}</div>
            <div className="mt-3 flex items-end gap-1">
              <div className="font-display font-bold text-4xl">{p.price}</div>
              <div className={`text-sm ${p.featured ? "opacity-70" : "text-muted-foreground"} mb-1`}>{p.period}</div>
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2"><CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${p.featured ? "text-accent" : "text-primary"}`} />{f}</li>
              ))}
            </ul>
            <Link to="/signup" className="block mt-6">
              <Button variant={p.featured ? "secondary" : "default"} className="w-full rounded-full">{p.cta}</Button>
            </Link>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-8">All plans include free CBT engine access. Cancel anytime. GST included where applicable.</p>
    </div>
  );
}

/* ---------------- RESULTS ---------------- */
export function Results() {
  useSEO({
    title: "Results & testimonials — real ranks, real students · FNJEE.com",
    description: "Read how JEE and NEET aspirants across India — Kota, Delhi, Hyderabad, Patna — cracked their target rank with FNJEE.com's CBT practice and AI drills.",
    canonical: `${ORIGIN}/results`,
  });
  return (
    <div data-testid="results-page" className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
      <div className="max-w-2xl mb-10">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Results</div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-2">Real students. Real ranks. Real rise.</h1>
        <p className="text-muted-foreground mt-4">These are the aspirants who trusted the daily-mock discipline.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TESTIMONIALS.map(t => (
          <Card key={t.name} className="en-card p-6" data-testid={`result-${t.name.split(" ")[0].toLowerCase()}`}>
            <div className="text-2xl text-primary leading-none">“</div>
            <p className="text-sm mt-2 leading-relaxed">{t.quote}</p>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t.role} · {t.city}</div>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-14 text-center">
        <Link to="/signup"><Button size="lg" className="rounded-full px-8">Be the next story</Button></Link>
      </div>
    </div>
  );
}

/* ---------------- FAQ ---------------- */
const FAQS = [
  { q: "Is FNJEE.com free?", a: "Yes — the Free plan gives you unlimited CBT mocks and basic analytics forever. Premium plans add AI weak-topic drills, deep analytics and reattempts." },
  { q: "How does the CBT engine compare to NTA's?", a: "Pixel-identical. Same palette colours, same mark-for-review behaviour, same section switch, same auto-submit — so you feel zero surprise on exam day." },
  { q: "Do you cover NEET Biology (Botany + Zoology)?", a: "Yes — every NEET Biology MCQ is tagged to its NCERT source line, which is where 80%+ of NEET Biology questions come from." },
  { q: "Which devices do you support?", a: "Any modern mobile or desktop browser, plus the FNJEE app for Android and iPhone. Your account, tests and results are the same everywhere." },
  { q: "How is rank predicted?", a: "After every full mock, we compare your score against the current active cohort attempting the same paper — the more mocks you take, the tighter the prediction gets." },
  { q: "Do you have Olympiads and NTSE tests?", a: "Yes — NSO, IMO, NSTSE and NTSE, from Class 6 upwards. See our Olympiads page for the full list." },
  { q: "Can parents track their child?", a: "Yes — a dedicated Parent Portal gives you a read-only view of your child's progress, weak subjects, and full mock scores, plus the ability to assign a custom practice test." },
  { q: "Can I get a refund?", a: "Yes — 7-day no-questions-asked refund on all paid plans. Just email support and we'll process it." },
  { q: "Do you offer institute / school licences?", a: "Yes — bulk licences with dashboards for coaching institutes. Contact us via the Contact page." },
];

export function FAQ() {
  useSEO({
    title: "FAQ — Everything about FNJEE.com's CBT mock tests",
    description: "Answers to common questions: pricing, refunds, CBT interface, NEET / JEE coverage, Olympiads, device support, rank prediction, parent portal and institute licences.",
    canonical: `${ORIGIN}/faq`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": FAQS.map(f => ({
        "@type": "Question", "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a },
      })),
    },
  });
  return (
    <div data-testid="faq-page" className="max-w-3xl mx-auto px-6 py-16 lg:py-20">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">FAQ</div>
      <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-2">Answers to the usual questions.</h1>
      <Accordion type="single" collapsible className="mt-10">
        {FAQS.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`} data-testid={`faq-${i}`}>
            <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

/* ---------------- CONTACT ---------------- */
export function Contact() {
  useSEO({
    title: "Contact — Get in touch with FNJEE.com",
    description: "Get support, ask about institute licences, or partner with us. Email, WhatsApp, and phone details for the FNJEE.com team.",
    canonical: `${ORIGIN}/contact`,
  });
  return (
    <div data-testid="contact-page" className="max-w-4xl mx-auto px-6 py-16 lg:py-20">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Contact</div>
      <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-2">We reply, usually within a day.</h1>
      <p className="text-muted-foreground mt-4 max-w-xl">Support, institute licences, or just questions about your rank plan — reach out.</p>
      <div className="grid md:grid-cols-3 gap-4 mt-10">
        <Card className="en-card p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Email</div>
          <div className="font-display font-semibold text-lg mt-1">hello@mocktestclub.in</div>
          <p className="text-sm text-muted-foreground mt-2">Best for detailed questions, bugs, partnerships.</p>
        </Card>
        <Card className="en-card p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">WhatsApp</div>
          <div className="font-display font-semibold text-lg mt-1">+91 90000 00000</div>
          <p className="text-sm text-muted-foreground mt-2">Mon–Sat, 9 AM – 8 PM IST for support queries.</p>
        </Card>
        <Card className="en-card p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Institute licences</div>
          <div className="font-display font-semibold text-lg mt-1">sales@mocktestclub.in</div>
          <p className="text-sm text-muted-foreground mt-2">Bulk plans for coaching institutes and schools.</p>
        </Card>
      </div>
      <Card className="en-card p-6 mt-6">
        <h3 className="font-display font-semibold text-lg">Quick help</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>· Forgot password? Log in and click "Forgot" (feature coming soon — email us for now).</li>
          <li>· Payment failed? Try again from Pricing, or WhatsApp us.</li>
          <li>· Refund request? Email hello@mocktestclub.in within 7 days of purchase.</li>
        </ul>
      </Card>
    </div>
  );
}
