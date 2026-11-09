import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, practiceApi } from "@/lib/api";
import { classLabel } from "@/lib/bank";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Zap, Layers, Network, Play, Clock, ArrowRight, CheckCircle2, RotateCcw, Search } from "lucide-react";

export default function ChapterPlaylist() {
  const [chapters, setChapters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [playlist, setPlaylist] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [subject, setSubject] = useState("");
  const [query, setQuery] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    api.get("/playlist/chapters").then((r) => {
      setChapters(r.data);
      const subs = [...new Set(r.data.map((c) => c.subject))];
      if (subs.length) setSubject((s) => s || subs[0]);
    }).finally(() => setLoaded(true));
  }, []);

  const start = async (item) => {
    setSelected(item); setStepIdx(0); setCardIdx(0); setFlipped(false);
    try {
      const r = await api.get(`/playlist/${encodeURIComponent(item.subject)}/${encodeURIComponent(item.chapter)}`);
      setPlaylist(r.data);
    } catch { toast.error("Could not load playlist"); }
  };

  const startDpp = async () => {
    if (!playlist?.steps?.[0]?.questions?.length) { toast.error("No DPP questions available"); return; }
    setStarting(true);
    try {
      // a chapter-only practice set (does not replace today's DPP)
      const t = await practiceApi.generate({ subjects: [playlist.subject], chapters: [playlist.chapter], count: 10, allow_repeat: true });
      nav(`/student/cbt/${t.id}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not start DPP"); setStarting(false); }
  };

  if (!playlist) {
    return (
      <div data-testid="chapter-playlist-picker" className="space-y-8">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Chapter playlist</div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">One tap · 25 minutes · one chapter done.</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">A tight bundle of quick MCQs → flashcards → mindmap. Perfect for a study break or right before a mock.</p>
        </div>
        <PlaylistPicker chapters={chapters} loaded={loaded} subject={subject} setSubject={setSubject}
          query={query} setQuery={setQuery} onPick={start} />
      </div>
    );
  }

  const step = playlist.steps[stepIdx];
  const next = () => { setStepIdx((i) => Math.min(i + 1, playlist.steps.length - 1)); setCardIdx(0); setFlipped(false); };
  const restart = () => { setSelected(null); setPlaylist(null); setStepIdx(0); setCardIdx(0); setFlipped(false); };

  return (
    <div data-testid="chapter-playlist-runner" className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Badge variant="secondary" className="rounded-full">{playlist.subject}</Badge>
          <h1 className="font-display font-bold text-3xl mt-2">{playlist.chapter}</h1>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <Clock className="h-3 w-3" /> ~{playlist.total_minutes} min total · step {stepIdx + 1} of {playlist.steps.length}
          </div>
        </div>
        <Button data-testid="playlist-restart" variant="outline" size="sm" className="rounded-full" onClick={restart}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Pick another
        </Button>
      </div>

      <div className="flex gap-2">
        {playlist.steps.map((s, i) => (
          <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
            <div className={`h-full ${i < stepIdx ? "bg-emerald-500" : i === stepIdx ? "bg-primary" : "bg-transparent"}`} style={{ width: "100%" }} />
          </div>
        ))}
      </div>

      {step.kind === "dpp" && (
        <Card data-testid="playlist-step-dpp" className="en-card p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto grid place-items-center mb-4"><Zap className="h-7 w-7" /></div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Step 1 · Warm-up</div>
          <h2 className="font-display font-bold text-2xl mt-2">{step.title}</h2>
          <p className="text-muted-foreground mt-2">{step.questions_count} MCQs · about {step.estimate_min} minutes</p>
          <div className="mt-6 flex gap-2 justify-center">
            <Button data-testid="playlist-start-dpp" onClick={startDpp} disabled={starting} className="rounded-full">
              {starting ? "Preparing…" : "Start MCQs"} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button data-testid="playlist-skip-step" variant="outline" onClick={next} className="rounded-full">Skip to flashcards</Button>
          </div>
        </Card>
      )}

      {step.kind === "flashcards" && (
        <Card data-testid="playlist-step-flashcards" className="en-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-xl bg-accent/15 text-accent grid place-items-center"><Layers className="h-5 w-5" /></div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Step 2 · Fast recall</div>
              <h2 className="font-display font-bold text-xl">{step.title}</h2>
            </div>
            <div className="text-xs text-muted-foreground font-mono">{step.cards?.length ? `${cardIdx + 1} / ${step.cards.length}` : "—"}</div>
          </div>

          {step.cards?.length > 0 ? (
            <>
              <div onClick={() => setFlipped((f) => !f)} className="relative rounded-3xl border-2 border-border bg-card shadow-lg cursor-pointer overflow-hidden aspect-[3/2] max-w-2xl mx-auto select-none" data-testid="playlist-flashcard">
                <AnimatePresence mode="wait">
                  <motion.div key={`${cardIdx}-${flipped}`} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.22 }} className="absolute inset-0 grid place-items-center p-6 text-center">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-3">{flipped ? "Answer" : "Prompt · tap to flip"}</div>
                      <div className={`font-display font-bold ${flipped ? "text-base sm:text-lg" : "text-xl sm:text-2xl"}`}>
                        {flipped ? step.cards[cardIdx].back : step.cards[cardIdx].front}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="mt-4 flex gap-2 justify-center">
                <Button data-testid="playlist-flashcard-next" variant="outline" className="rounded-full" onClick={() => {
                  setFlipped(false);
                  if (cardIdx + 1 >= step.cards.length) next(); else setCardIdx(cardIdx + 1);
                }}>{cardIdx + 1 >= step.cards.length ? "Continue to mindmap" : "Next card"} <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No flashcards for this chapter yet.
              <div className="mt-4"><Button variant="outline" className="rounded-full" onClick={next}>Skip to mindmap</Button></div>
            </div>
          )}
        </Card>
      )}

      {step.kind === "mindmap" && (
        <Card data-testid="playlist-step-mindmap" className="en-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/15 text-emerald-600 grid place-items-center"><Network className="h-5 w-5" /></div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Step 3 · Connect the dots</div>
              <h2 className="font-display font-bold text-xl">{step.title}</h2>
            </div>
          </div>
          {step.mindmap ? (
            <div className="rounded-2xl border border-border p-6 lg:p-8 bg-muted/20">
              <div className="text-center">
                <div className="inline-block rounded-full px-6 py-2.5 font-display font-bold text-lg bg-primary text-primary-foreground">{step.mindmap.root}</div>
              </div>
              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                {step.mindmap.branches?.map((b, i) => (
                  <div key={b.name} className="rounded-2xl border-2 border-dashed border-primary/30 p-4 bg-card">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground grid place-items-center text-xs font-bold">{String.fromCharCode(65 + i)}</div>
                      <div className="font-display font-semibold">{b.name}</div>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {b.leaves?.map((l) => <li key={l} className="text-foreground/80 flex items-start gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />{l}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No mindmap for this chapter yet.</div>
          )}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Chapter revision complete 🎉
            </div>
            <div className="mt-4 flex gap-2 justify-center">
              <Button data-testid="playlist-pick-another" onClick={restart} className="rounded-full">Pick another chapter</Button>
              <Button variant="outline" onClick={() => nav("/student")} className="rounded-full">Back to dashboard</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// Any chapter of the question bank can be a playlist: subject tabs, search, a scrolling list.
function PlaylistPicker({ chapters, loaded, subject, setSubject, query, setQuery, onPick }) {
  const subjects = [...new Set(chapters.map((c) => c.subject))];
  const needle = query.trim().toLowerCase();
  const list = chapters.filter((c) => c.subject === subject && (!needle || c.chapter.toLowerCase().includes(needle)));
  const byClass = list.reduce((acc, c) => { const k = c.student_class ? classLabel(c.student_class) : "Other chapters"; (acc[k] = acc[k] || []).push(c); return acc; }, {});
  if (!loaded) return <div className="text-sm text-muted-foreground">Loading chapters…</div>;
  if (!chapters.length) return <div className="text-sm text-muted-foreground">No chapters yet — questions need a subject and chapter in the Question Bank.</div>;
  return (
    <Card className="en-card p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <button key={s} type="button" data-testid={`playlist-subject-${s.toLowerCase()}`} onClick={() => setSubject(s)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${subject === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{s}</button>
        ))}
      </div>
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input data-testid="playlist-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${subject} chapters…`}
          className="w-full h-10 rounded-full border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      <div className="max-h-[60vh] overflow-y-auto en-scroll rounded-xl border divide-y">
        {Object.entries(byClass).map(([cls, items]) => (
          <div key={cls}>
            <div className="sticky top-0 z-10 bg-muted/90 backdrop-blur px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider">{cls}</div>
            {items.map((c) => (
              <button key={`${c.subject}|${c.chapter}`} type="button" onClick={() => onPick(c)}
                data-testid={`playlist-pick-${c.chapter.toLowerCase().replace(/\s+/g, "-")}`}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-medium break-anywhere">{c.chapter}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~25 min</span>
                    {c.questions !== false && <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> MCQs</span>}
                    <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> Cards</span>
                    {c.has_map && <span className="flex items-center gap-1"><Network className="h-3 w-3" /> Map</span>}
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5"><Play className="h-3 w-3" /> Start</span>
              </button>
            ))}
          </div>
        ))}
        {!list.length && <div className="px-4 py-6 text-sm text-muted-foreground">No chapter matches “{query}”.</div>}
      </div>
    </Card>
  );
}
