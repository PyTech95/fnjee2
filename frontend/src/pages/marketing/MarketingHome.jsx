import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useSEO } from "@/lib/useSEO";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Reveal, Stagger, StaggerItem, Counter } from "./motion";
import {
  ArrowRight, Award, Zap, Layers, Network, Target,
  Flame, PlayCircle, ShieldCheck, PhoneCall, Bot, Headphones
} from "lucide-react";

const FAQS = [
  { q: "What is the difference between Target Batch and Score Booster?", a: "Target Batch is a full 1-year NEET course covering all subjects with video lessons, DPPs and mock tests. Score Booster is built for droppers and final-prep students who need targeted weak-area drilling and AI-powered scheduling." },
  { q: "How is FNJEE.com different?", a: "Most platforms are built around video lectures. We are built around daily MCQ practice — the activity most correlated with NEET / JEE rank: 40,000+ practice questions, daily DPPs, and a rank predictor after every session." },
  { q: "What does the 3-day free trial include?", a: "Full access to all platform features, daily DPPs, mock tests, video lessons, analytics and rank predictor. No credit card required." },
  { q: "Can I use FNJEE.com alongside my offline coaching?", a: "Yes — most top-ranked students use it as their daily practice layer alongside classroom coaching. It complements, never replaces, your schedule." },
  { q: "What is the refund policy?", a: "3-day no-questions-asked refund from date of purchase." },
  { q: "Is this for Class 11, Class 12, or droppers?", a: "All three. Target Batch covers Class 11 and 12 over 1-2 years; Score Booster is built for droppers and late-stage Class 12 students." },
];

// Practice stats only — no AIR ranks or result claims (meeting 9 Nov).
const TOPPERS = [
  { name: "Mrinal K. Jha", mcqs: "158k", tests: 280, exam: "NEET" },
  { name: "Aarav Agarwal", mcqs: "11k", tests: 95, exam: "JEE Main" },
  { name: "Rachit C.", mcqs: "22k", tests: 145, exam: "NEET" },
  { name: "Umaid Khan", mcqs: "32k", tests: 48, exam: "JEE Advanced" },
  { name: "Tanishq R.", mcqs: "19k", tests: 120, exam: "NEET" },
  { name: "Neev Mit", mcqs: "28k", tests: 165, exam: "JEE Main" },
];

// Hero batch picker: "Enroll for …" opens sign-up with the exam pre-selected.
const BATCHES = ["NEET 2027", "NEET 2028", "JEE 2027", "JEE 2028", "Olympiad"];
const examOf = (b) => (b.startsWith("JEE") ? "JEE" : b.startsWith("NEET") ? "NEET" : "Olympiad");

const STATS = [
  { label: "NEET & JEE selections", value: "10,500+" },
  { label: "Daily aspirants", value: "45,000+" },
  { label: "Questions practiced", value: "82 Cr+" },
  { label: "Tests generated", value: "2.4 M+" },
  { label: "Chapters covered", value: "97" },
];

const FEATURES = [
  { icon: Headphones, tag: "Learn", title: "Audio/Video Explanations", desc: "Every question in the bank comes with a clear audio-video walkthrough. Understand each step, not just the final answer.", span: "lg:col-span-8", tone: "ink" },
  { icon: Zap, tag: "Practice", title: "Custom Tests", desc: "Build a test your way: pick subject, chapter, topic and length, then attempt on a real CBT interface.", span: "lg:col-span-4", tone: "volt" },
  { icon: Layers, tag: "Revise", title: "Flashcards", desc: "Quick-flip cards for fast revision — lock in the exact NCERT statements that get tested, in minutes.", span: "lg:col-span-4", tone: "plain" },
  { icon: Flame, tag: "Daily", title: "DPP Generator", desc: "Fresh Daily Practice Problems on topics you choose. One focused set a day, streak-linked.", span: "lg:col-span-4", tone: "plain" },
  { icon: Network, tag: "Connect", title: "Mindmaps", desc: "One sheet per chapter linking every formula and concept — built for fast, last-mile revision.", span: "lg:col-span-4", tone: "indigo" },
  { icon: Target, tag: "Improve", title: "Performance Analytics", desc: "See which chapters leak marks and exactly what to practice next. Track score movement, not just scores.", span: "lg:col-span-12", tone: "plain" },
];

export default function MarketingHome() {
  useSEO({
    title: "FNJEE.com — NEET & JEE Practice, CBT Mock Tests & Rank Predictor",
    description: "MCQ practice and testing for serious NEET & JEE aspirants. Real NTA CBT interface, 8L+ MCQs with solutions, daily DPPs, flashcards, mindmaps and a rank predictor.",
    canonical: "https://fnjee.com/",
    ogImage: "https://fnjee.com/og-image.jpg",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "FNJEE.com",
        url: "https://fnjee.com/",
        logo: "https://fnjee.com/icon-512.png",
        description: "AI-powered CBT mock-test platform for JEE, NEET, Olympiads and competitive exams.",
        sameAs: [],
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "FNJEE.com",
        url: "https://fnjee.com/",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://fnjee.com/courses?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  });
  const [batch, setBatch] = useState("NEET 2027");

  return (
    <div data-testid="marketing-home" className="mkt">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 mkt-grid" aria-hidden="true" />
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full mkt-blob bg-[#0A66C2]/25" aria-hidden="true" />
        <div className="absolute top-40 -right-20 h-96 w-96 rounded-full mkt-blob bg-[#4338CA]/20" style={{ animationDelay: "3s" }} aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <Stagger gap={0.09}>
              <StaggerItem>
                <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#09090B] bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em]">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-[#0A66C2] opacity-75" /><span className="relative rounded-full h-2 w-2 bg-[#0A66C2]" /></span>
                  NEET & JEE 2027 admissions open
                </span>
              </StaggerItem>
              <StaggerItem>
                <h1 className="mkt-display font-semibold text-[2.5rem] leading-[1.02] sm:text-5xl lg:text-6xl mt-6">
                  Practice like<br />
                  a <span className="relative inline-block text-[#0A66C2]">topper.
                    <svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none">
                      <motion.path d="M2 8C50 3 150 3 198 8" stroke="#0A66C2" strokeWidth="3" strokeLinecap="round"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.6, ease: "easeInOut" }} />
                    </svg>
                  </span><br />
                  Rank like one.
                </h1>
              </StaggerItem>
              <StaggerItem>
                <p className="mt-7 text-lg leading-relaxed text-[#52525B] max-w-xl">
                  MCQ practice and testing for serious NEET &amp; JEE aspirants — the exact NTA CBT interface, 8L+ solved MCQs, daily DPPs and a rank predictor after every mock.
                </p>
              </StaggerItem>

              <StaggerItem>
                <div className="mt-8 flex items-center gap-3 flex-wrap">
                  <div className="mkt-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#52525B]">Batch</div>
                  <div className="relative flex flex-wrap border-[1.5px] border-[#09090B] rounded-[22px] p-1 bg-white">
                    {BATCHES.map((b) => (
                      <button key={b} onClick={() => setBatch(b)}
                        data-testid={`hero-batch-${b.replace(/\s+/g, "-").toLowerCase()}`}
                        className="relative px-4 sm:px-5 py-1.5 rounded-full text-sm font-semibold transition-colors">
                        {batch === b && <motion.span layoutId="hero-batch-pill" className="absolute inset-0 rounded-full bg-[#09090B]" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                        <span className={`relative ${batch === b ? "text-white" : "text-[#09090B]/70"}`}>{b}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link to={`/signup?exam=${encodeURIComponent(examOf(batch))}`}>
                    <button data-testid="hero-enroll-btn" className="mkt-btn-primary group inline-flex items-center gap-2 px-8 py-4 text-base font-semibold">
                      Enroll for {batch}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </Link>
                  <Link to="/signup">
                    <button data-testid="hero-start-free" className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#09090B] px-7 py-4 text-base font-semibold transition-all hover:bg-[#09090B] hover:text-white">
                      <PlayCircle className="h-4 w-4" /> Start free trial
                    </button>
                  </Link>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#52525B]">
                  <div className="flex -space-x-2">
                    {["V", "R", "P", "A"].map((c, i) => (
                      <span key={i} className="h-8 w-8 rounded-full border-2 border-[#FAF7F2] bg-[#09090B] text-white grid place-items-center text-xs font-bold">{c}</span>
                    ))}
                  </div>
                  <span><b className="text-[#09090B]">45,000+ aspirants</b> practicing right now.</span>
                </div>
              </StaggerItem>
            </Stagger>
          </div>

          {/* Floating dashboard mockup */}
          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative rounded-[28px] overflow-hidden border-[1.5px] border-[#09090B] shadow-[10px_10px_0_0_#0A66C2] mb-6">
                <img
                  src="/hero-app.jpg"
                  alt="FNJEE app — NEET and JEE mock tests, results and daily practice"
                  width="1200" height="680"
                  className="w-full h-[300px] sm:h-[340px] object-cover object-center"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/55 via-transparent to-transparent" aria-hidden="true" />
                <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-bold">
                  <Flame className="h-3.5 w-3.5 text-orange-500" /> 7-day streak
                </div>
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="mkt-display font-semibold text-lg leading-tight drop-shadow">Practice that shows up on rank day</div>
                  <div className="text-xs text-white/85">NEET · JEE Main · JEE Advanced · Olympiads</div>
                </div>
              </div>
              <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
                <div className="mkt-card p-5 relative">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Biology · Genetics <span className="font-bold text-[#0A66C2] ml-1">92%</span></div>
                    <div className="flex items-center gap-1 text-orange-500 font-semibold"><Flame className="h-3.5 w-3.5" /> 7-day streak</div>
                  </div>
                  <div className="mt-3 mkt-mono text-[11px] text-[#52525B]">COURSE PROGRESS · <span className="text-[#09090B] font-bold">62%</span></div>
                  <div className="mt-2 h-2.5 rounded-full bg-[#09090B]/10 overflow-hidden">
                    <motion.div className="h-full bg-[#0A66C2]" initial={{ width: 0 }} animate={{ width: "62%" }} transition={{ duration: 1.2, delay: 0.9, ease: "easeOut" }} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="p-3 rounded-xl border-[1.5px] border-[#09090B]/15">
                      <div className="mkt-mono text-[9px] font-bold uppercase tracking-widest text-[#52525B]">Projected</div>
                      <div className="mkt-display font-bold text-2xl">648<span className="text-sm text-[#52525B]">/720</span></div>
                      <div className="text-xs text-emerald-600 mt-0.5 font-semibold">↑ +48 · Top 1%</div>
                    </div>
                    <div className="p-3 rounded-xl border-[1.5px] border-[#09090B]/15">
                      <div className="mkt-mono text-[9px] font-bold uppercase tracking-widest text-[#52525B]">Next test</div>
                      <div className="mkt-display font-bold text-sm mt-1">Full Mock</div>
                      <div className="text-xs text-[#52525B]">Sun · 3h 20m</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#09090B] text-white">
                      <div className="mkt-mono text-[9px] font-bold uppercase tracking-widest text-white/70">Revision</div>
                      <div className="mkt-display font-bold text-2xl">323</div>
                      <div className="text-xs text-[#0A66C2]">Start →</div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 rounded-xl border-[1.5px] border-dashed border-[#0A66C2]/40 bg-[#0A66C2]/5">
                    <div className="mkt-mono text-[9px] font-bold uppercase tracking-widest text-[#0A66C2]">Weak chapter analysis</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["Electrochemistry", "Morphology", "Ray Optics"].map((c) => (
                        <span key={c} className="rounded-full border-[1.5px] border-[#09090B]/15 px-2.5 py-0.5 text-xs font-medium">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-5 -right-4 mkt-card p-3 hidden sm:block">
                <div className="flex items-center gap-2"><Award className="h-4 w-4 text-[#0A66C2]" /><div className="text-xs font-bold">Rank predictor live</div></div>
              </motion.div>
              <motion.div animate={{ y: [0, -9, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -top-5 -left-4 mkt-card p-3 hidden sm:block">
                <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-[#4338CA]" /><div className="text-xs font-bold">AI weak-topic drills</div></div>
              </motion.div>
            </motion.div>
          </div>
        </div>

      </section>

      {/* ================= CBT PREVIEW ================= */}
      <section className="max-w-7xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-12 gap-12 items-center">
        <Reveal className="lg:col-span-5">
          <div className="mkt-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0A66C2]">CBT mode</div>
          <h2 className="mkt-display font-bold text-4xl sm:text-5xl mt-3">Exact NTA exam conditions.</h2>
          <p className="text-[#52525B] mt-4 text-lg leading-relaxed">
            Same interface. Same timer. Same pressure. So exam day feels like just another session.
          </p>
          <ul className="mt-6 space-y-3">
            {["NTA-identical interface & question format", "Per-subject timer + total time, like the real exam",
              "Mark for review, clear response, section navigation", "Instant scorecard + rank estimate after every mock"].map(x => (
              <li key={x} className="flex items-start gap-3 text-[#09090B]"><span className="mt-1 h-5 w-5 rounded-md bg-[#0A66C2]/10 grid place-items-center shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-[#0A66C2]" /></span>{x}</li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3">
            <Link to="/signup"><button data-testid="cbt-try-free-btn" className="mkt-btn-primary px-7 py-3.5 font-semibold">Try a free CBT</button></Link>
            <Link to="/how-it-works"><button className="rounded-full border-[1.5px] border-[#09090B] px-7 py-3.5 font-semibold transition-all hover:bg-[#09090B] hover:text-white">How it works</button></Link>
          </div>
        </Reveal>

        <Reveal delay={0.15} className="lg:col-span-7">
          <div className="rounded-2xl border-[1.5px] border-[#09090B] bg-white p-4 shadow-[8px_8px_0_0_#09090B]">
            <div className="h-9 flex items-center gap-2 px-2 border-b-[1.5px] border-[#09090B]/10">
              <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0A66C2]" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></div>
              <div className="mkt-mono text-[10px] text-[#52525B] ml-2">Candidate: <b className="text-[#09090B]">Kapil Gupta</b> · NEET / JEE</div>
              <div className="ml-auto mkt-mono text-xs font-bold text-[#0A66C2]">03:19:02</div>
            </div>
            <div className="grid grid-cols-12 gap-4 mt-4">
              <div className="col-span-12 sm:col-span-8 space-y-3">
                <div className="mkt-mono text-xs font-semibold text-[#52525B]">QUESTION 5</div>
                <div className="text-sm leading-relaxed">In an ideal transformer, the turns ratio is Np/Ns = 1/2. The ratio Vs : Vp is equal to (symbols carry usual meaning):</div>
                <div className="space-y-2 mt-2">
                  {["2 : 1", "1 : 1", "1 : 4", "1 : 2"].map((opt, i) => (
                    <motion.div key={i} whileHover={{ x: 4 }} className={`text-sm p-2.5 rounded-lg border-[1.5px] flex items-center gap-3 cursor-pointer ${i === 0 ? "border-[#0A66C2] bg-[#0A66C2]/10" : "border-[#09090B]/15"}`}>
                      <span className={`h-5 w-5 rounded-full border grid place-items-center text-[10px] font-bold ${i === 0 ? "border-[#0A66C2] bg-[#0A66C2] text-white" : "border-[#09090B]/30"}`}>{i + 1}</span>
                      {opt}
                    </motion.div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 mkt-mono text-[10px] font-bold">
                  {["SAVE & NEXT", "CLEAR", "MARK & NEXT"].map((b, i) => (
                    <span key={b} className={`px-3 py-1.5 rounded ${i === 0 ? "bg-[#0A66C2] text-white" : "bg-[#09090B]/5 border border-[#09090B]/15"}`}>{b}</span>
                  ))}
                </div>
              </div>
              <div className="col-span-12 sm:col-span-4 space-y-2">
                <div className="mkt-mono text-xs font-semibold">PALETTE</div>
                <div className="grid grid-cols-6 sm:grid-cols-5 gap-1">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <motion.div key={i} whileHover={{ scale: 1.18 }} className={`h-6 rounded text-[9px] grid place-items-center font-bold cursor-pointer ${
                      i < 2 ? "bg-emerald-500 text-white" :
                      i === 2 ? "bg-[#0A66C2] text-white ring-2 ring-[#0A66C2]/40" :
                      i === 3 || i === 4 ? "bg-purple-500 text-white" :
                      "bg-[#09090B]/5 border border-[#09090B]/10"
                    }`}>{i + 1}</motion.div>
                  ))}
                </div>
                <div className="mt-3 space-y-1 text-[10px]">
                  <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-emerald-500 rounded-sm" /> Answered</div>
                  <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-purple-500 rounded-sm" /> Marked</div>
                  <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-[#09090B]/5 rounded-sm border border-[#09090B]/15" /> Not visited</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================= STATS (dark) ================= */}
      <section className="bg-[#0F172A] text-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
          <Reveal>
            <div className="mkt-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0A66C2]">By the numbers</div>
            <h2 className="mkt-display font-bold text-4xl sm:text-5xl mt-3 max-w-2xl">Built on practice, proven by rank.</h2>
          </Reveal>
          <Stagger className="mt-14 grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-10" gap={0.1}>
            {STATS.map((s) => (
              <StaggerItem key={s.label} data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`} className="border-l-2 border-[#0A66C2] pl-4">
                <Counter value={s.value} className="mkt-display font-bold text-4xl sm:text-5xl block" />
                <div className="text-xs text-white/50 mt-2 uppercase tracking-widest">{s.label}</div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ================= STUDENTS (no rank claims) ================= */}
      <section className="border-b-[1.5px] border-[#09090B]/10">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <Reveal className="max-w-3xl">
            <div className="mkt-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0A66C2]">Our students</div>
            <h2 className="mkt-display font-bold text-4xl sm:text-5xl mt-3">NEET &amp; JEE aspirants who practise every day.</h2>
            <p className="text-[#52525B] mt-4 text-lg">Daily MCQs, mocks and DPPs on FNJEE — the habit that moves a rank.</p>
          </Reveal>
          <Stagger className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5" gap={0.07}>
            {TOPPERS.map((t) => (
              <StaggerItem key={t.name}>
                <div className="mkt-card mkt-card-hover p-5 h-full" data-testid={`topper-${t.name.split(" ")[0].toLowerCase()}`}>
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-[#09090B] text-white grid place-items-center mkt-display font-bold text-lg shrink-0">
                      {t.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mkt-display font-semibold truncate">{t.name}</div>
                      <div className="text-xs text-[#52525B]">{t.exam} aspirant</div>
                    </div>
                    <span className="rounded-full bg-[#0A66C2]/10 text-[#0A66C2] text-xs font-bold px-3 py-1 shrink-0">{t.exam.startsWith("JEE") ? "JEE" : "NEET"}</span>
                  </div>
                  <div className="mt-4 pt-4 border-t-[1.5px] border-[#09090B]/10 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-[#52525B]">MCQs</span> <b className="ml-1">{t.mcqs}</b></div>
                    <div><span className="text-[#52525B]">Tests</span> <b className="ml-1">{t.tests}</b></div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ================= FEATURE BENTO ================= */}
      <section className="bg-white border-y-[1.5px] border-[#09090B]/10">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <Reveal className="max-w-2xl mb-12">
            <div className="mkt-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0A66C2]">What's inside</div>
            <h2 className="mkt-display font-bold text-4xl sm:text-5xl mt-3">Six modules built for NEET &amp; JEE rank.</h2>
          </Reveal>
          <Stagger className="grid lg:grid-cols-12 gap-5" gap={0.07}>
            {FEATURES.map((f, i) => {
              const tone = {
                ink: "bg-[#0F172A] text-[#FAF7F2] border-[#0F172A]",
                volt: "bg-[#0A66C2] text-white border-[#0A66C2]",
                indigo: "bg-[#4338CA] text-white border-[#4338CA]",
                plain: "bg-[#FAF7F2] text-[#09090B] border-[#09090B]",
              }[f.tone];
              const mute = f.tone === "plain" ? "text-[#52525B]" : "text-white/70";
              return (
                <StaggerItem key={f.title} className={f.span}>
                  <motion.div whileHover={{ y: -5 }} data-testid={`feature-tile-${i}`}
                    className={`rounded-2xl border-[1.5px] p-8 h-full ${tone}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl grid place-items-center ${f.tone === "plain" ? "bg-[#0A66C2]/10 text-[#0A66C2]" : "bg-white/15"}`}><f.icon className="h-5 w-5" strokeWidth={1.5} /></div>
                      <span className={`mkt-mono text-[10px] font-bold uppercase tracking-[0.2em] ${mute}`}>{f.tag}</span>
                    </div>
                    <h3 className="mkt-display font-semibold text-xl mt-5">{f.title}</h3>
                    <p className={`text-sm mt-2 leading-relaxed ${mute}`}>{f.desc}</p>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ================= COUNSELLING ================= */}
      <section id="counselling" className="max-w-7xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-start">
        <Reveal>
          <div className="mkt-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0A66C2]">Happy to help</div>
          <h2 className="mkt-display font-bold text-4xl sm:text-5xl mt-3">Not sure which course fits?</h2>
          <p className="text-[#52525B] mt-4 max-w-xl text-lg leading-relaxed">
            Book a free consulting session with our team. We'll help you pick the right batch for your class, target year, and current level.
          </p>
          <a href="tel:+918527521718" className="mt-6 inline-flex items-center gap-2 text-[#0A66C2] font-bold mkt-link">
            <PhoneCall className="h-4 w-4" /> +91 85275 21718
          </a>
          <div className="mkt-card mt-8 p-6">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs font-bold">Counsellor online · replies in ~5 min</div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="p-3 rounded-2xl bg-[#09090B]/5 max-w-[80%]"><b>Hi!</b> Which class are you in right now?</div>
              <div className="p-3 rounded-2xl bg-[#0A66C2] text-white max-w-[80%] ml-auto">Class 12, targeting JEE Main 2027</div>
              <div className="p-3 rounded-2xl bg-[#09090B]/5 max-w-[80%]">Great! The JEE 2027 batch fits you best 👍</div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.15}><CounsellingForm /></Reveal>
      </section>

      {/* ================= FAQ ================= */}
      <section className="bg-white border-t-[1.5px] border-[#09090B]/10">
        <div className="max-w-4xl mx-auto px-6 py-20 lg:py-28">
          <Reveal>
            <div className="mkt-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0A66C2]">FAQ</div>
            <h2 className="mkt-display font-bold text-4xl sm:text-5xl mt-3">The questions aspirants keep asking.</h2>
          </Reveal>
          <Accordion type="single" collapsible className="mt-10">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} data-testid={`home-faq-${i}`} className="border-b-[1.5px] border-[#09090B]/10">
                <AccordionTrigger className="text-left mkt-display font-semibold text-lg hover:no-underline py-5">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[#52525B] text-base leading-relaxed pb-5">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="bg-[#0F172A] text-[#FAF7F2] relative overflow-hidden">
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full mkt-blob bg-[#0A66C2]/30" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <h2 className="mkt-display font-bold text-4xl sm:text-6xl leading-[1.02]">Your rank starts with a single mock.</h2>
            <p className="mt-5 text-white/60 max-w-lg text-lg">Sign up in 30 seconds. Take your first NEET / JEE-style CBT in 60. See your predicted AIR in 90.</p>
          </Reveal>
          <Reveal delay={0.15} className="flex flex-wrap gap-3 lg:justify-end">
            <Link to="/signup"><button data-testid="footer-cta-signup" className="mkt-btn-primary px-8 py-4 text-base font-semibold">Start free trial</button></Link>
            <Link to="/courses"><button data-testid="footer-cta-courses" className="rounded-full border-[1.5px] border-white/40 px-8 py-4 text-base font-semibold transition-all hover:bg-white hover:text-[#0F172A]">See courses</button></Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function CounsellingForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", student_class: "Class 12", target_year: "NEET 2027", message: "" });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) { toast.error("Fill name, email & phone"); return; }
    setBusy(true);
    try {
      await api.post("/counselling", form);
      setSent(true);
      toast.success("Thanks — we'll call you shortly.");
    } catch (err) {
      toast.error(err?.response?.data?.detail?.[0]?.msg || "Could not submit. Try again.");
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div className="mkt-card p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 text-emerald-600 mx-auto grid place-items-center mb-4"><ShieldCheck className="h-7 w-7" /></div>
        <div className="mkt-display font-bold text-2xl">Thanks for submitting!</div>
        <p className="text-[#52525B] mt-2">We'll contact you soon. Check your email for the free trial link.</p>
      </div>
    );
  }

  return (
    <div className="mkt-card p-6 lg:p-8">
      <div className="mkt-display font-bold text-2xl mb-1">Get a free counselling session</div>
      <div className="text-sm text-[#52525B] mb-6">Proper guidance for a better future.</div>
      <form onSubmit={submit} className="space-y-4" data-testid="counselling-form">
        <div>
          <Label className="text-[#09090B]">I'm preparing as a</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Class 11", "Class 12", "Class 12 (Passout)"].map((c) => (
              <button type="button" key={c} onClick={() => setForm({ ...form, student_class: c })}
                data-testid={`class-${c.toLowerCase().replace(/[\s()]+/g, "-").replace(/-+$/, "")}`}
                className={`px-4 py-2 rounded-full text-sm border-[1.5px] transition-colors ${
                  form.student_class === c ? "bg-[#0A66C2] text-white border-[#0A66C2]" : "border-[#09090B]/20 hover:border-[#09090B]"
                }`}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#09090B]">Target</Label>
          <Select value={form.target_year} onValueChange={(v) => setForm({ ...form, target_year: v })}>
            <SelectTrigger data-testid="counselling-target" className="rounded-full mt-2 border-[1.5px] border-[#09090B]/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["NEET 2027", "NEET 2028", "JEE Main 2027", "JEE Advanced 2027", "JEE 2028", "Olympiad"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[#09090B]">Full name</Label>
          <Input data-testid="counselling-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-full mt-2 border-[1.5px] border-[#09090B]/20" placeholder="Your name" />
        </div>
        <div>
          <Label className="text-[#09090B]">Mobile number</Label>
          <Input data-testid="counselling-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-full mt-2 border-[1.5px] border-[#09090B]/20" placeholder="+91 XXXXXXXXXX" />
        </div>
        <div>
          <Label className="text-[#09090B]">Email address</Label>
          <Input data-testid="counselling-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-full mt-2 border-[1.5px] border-[#09090B]/20" placeholder="you@example.com" />
        </div>
        <button data-testid="counselling-submit" type="submit" disabled={busy} className="w-full mkt-btn-primary py-3.5 font-semibold disabled:opacity-60">
          {busy ? "Sending…" : "Start free trial"}
        </button>
        <p className="text-[11px] text-[#52525B] leading-relaxed">
          By submitting, I authorize FNJEE.com representatives to contact me via Call, SMS, Email or WhatsApp, overriding my DND registration. I agree to the Terms of Use.
        </p>
      </form>
    </div>
  );
}
