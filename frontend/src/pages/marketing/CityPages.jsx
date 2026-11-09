import { Link, useParams, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/lib/useSEO";
import { CITIES } from "@/lib/marketingData";
import { MapPin, ChevronRight } from "lucide-react";

const ORIGIN = "https://fnjee.com";

export function CitiesIndex() {
  useSEO({
    title: "Cities we serve — JEE & NEET online test series across India · FNJEE.com",
    description: "FNJEE.com serves JEE, NEET, Olympiad and govt exam aspirants in Delhi, Kota, Patna, Lucknow, Hyderabad, Mumbai, Bengaluru and beyond. Kota-level test discipline from anywhere.",
    canonical: `${ORIGIN}/cities`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Cities we serve — FNJEE.com",
      "url": `${ORIGIN}/cities`,
      "hasPart": CITIES.map(c => ({
        "@type": "Service",
        "name": `JEE & NEET mock tests for ${c.name}`,
        "url": `${ORIGIN}/cities/${c.slug}`,
        "areaServed": { "@type": "City", "name": c.name },
      })),
    },
  });
  return (
    <div data-testid="cities-index" className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
      <div className="max-w-2xl mb-10">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Cities we serve</div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-2">JEE & NEET test series across India</h1>
        <p className="text-muted-foreground mt-4 max-w-xl">Whether you're in a metro or a Tier-2 city, FNJEE.com brings Kota-level test discipline to your screen. Pick your city below.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CITIES.map((c) => (
          <Link key={c.slug} to={`/cities/${c.slug}`} data-testid={`city-card-${c.slug}`}>
            <Card className="en-card p-5 h-full">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><MapPin className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-lg">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.state}</div>
                  <p className="text-sm text-muted-foreground mt-2">{c.tagline}</p>
                  <div className="mt-3 text-sm text-primary font-medium inline-flex items-center gap-1">
                    Explore <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CityPage() {
  const { slug } = useParams();
  const city = CITIES.find((c) => c.slug === slug);
  const title = city ? `JEE & NEET Online Test Series for ${city.name} · FNJEE.com` : "FNJEE.com";
  const desc = city ? `Online CBT mock tests for JEE, NEET, Olympiads and govt exams for students in ${city.name}, ${city.state}. ${city.tagline}` : undefined;

  useSEO({
    title, description: desc,
    canonical: city ? `${ORIGIN}/cities/${city.slug}` : undefined,
    jsonLd: city ? {
      "@context": "https://schema.org",
      "@type": "Service",
      "serviceType": "Online CBT mock tests for JEE and NEET",
      "provider": { "@type": "Organization", "name": "FNJEE.com" },
      "areaServed": { "@type": "City", "name": city.name },
    } : undefined,
  });

  if (!city) return <Navigate to="/cities" replace />;

  return (
    <div data-testid={`city-page-${city.slug}`}>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 en-grid-bg opacity-30" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-16">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2 mb-3">
            <MapPin className="h-3.5 w-3.5" /> {city.name} · {city.state}
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05] max-w-4xl">
            NEET & JEE mock tests for students in {city.name}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {city.tagline} Practice on our NTA-identical CBT engine, get AI-driven weak-topic drills, and see your predicted All India rank after every mock.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/signup"><Button data-testid={`city-${city.slug}-cta`} size="lg" className="rounded-full px-8">Start free mock</Button></Link>
            <Link to="/jee"><Button size="lg" variant="outline" className="rounded-full px-8">JEE series</Button></Link>
            <Link to="/neet"><Button size="lg" variant="ghost" className="rounded-full">NEET series</Button></Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-14 grid md:grid-cols-3 gap-4">
        {[
          { title: `Why ${city.name} aspirants pick us`, body: `Whether you're at a coaching institute in ${city.name} or self-studying at home, our CBT layer complements your prep — never replaces it.` },
          { title: "Online, on your schedule", body: `No commuting across ${city.name}. Take a full CBT mock from your bedroom at 6 AM or 11 PM — the engine's always on.` },
          { title: "Kota-level test rigor", body: `The same test discipline that puts Kota students in the top ranks — delivered to ${city.name} students at a fraction of the cost.` },
        ].map(b => (
          <Card key={b.title} className="en-card p-6">
            <h3 className="font-display font-semibold text-lg mb-2">{b.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{b.body}</p>
          </Card>
        ))}
      </section>

      <section className="max-w-4xl mx-auto px-6 py-14">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight mb-6">Prep smart in {city.name}</h2>
        <div className="prose prose-slate dark:prose-invert text-foreground/80 max-w-none text-sm leading-relaxed space-y-3">
          <p>FNJEE.com is used by thousands of aspirants in {city.name} and across {city.state}. Our exam engine is engineered to be pixel-identical to the NTA JEE and NEET CBT interfaces, so on the day of the real test you feel zero interface surprise.</p>
          <p>We recommend two habits for {city.name} aspirants: (1) a daily NCERT MCQ drill of 20–25 questions in the subject you're weakest in, and (2) a full-length weekend mock every Sunday morning. Track both on your streak calendar.</p>
          <p>Sign up in 30 seconds — free — and take your first full mock today.</p>
        </div>
        <div className="mt-6">
          <Link to="/signup"><Button className="rounded-full">Start your {city.name} rank climb</Button></Link>
        </div>
      </section>
    </div>
  );
}
