import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ArrowLeft, ArrowRight, BookMarked, Shuffle } from "lucide-react";

export default function Flashcards() {
  const [chapters, setChapters] = useState([]);
  const [chapter, setChapter] = useState("");
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    api.get("/flashcards/chapters").then((r) => {
      setChapters(r.data);
      if (r.data.length && !chapter) setChapter(`${r.data[0].subject}|${r.data[0].chapter}`);
    });
  }, []);

  useEffect(() => {
    if (!chapter) return;
    const [subject, ch] = chapter.split("|");
    api.get("/flashcards", { params: { subject, chapter: ch } }).then((r) => {
      setCards(r.data);
      setIdx(0); setFlipped(false);
    });
  }, [chapter]);

  const next = () => { setFlipped(false); setIdx((i) => (i + 1) % Math.max(cards.length, 1)); };
  const prev = () => { setFlipped(false); setIdx((i) => (i - 1 + cards.length) % Math.max(cards.length, 1)); };
  const shuffle = () => { setFlipped(false); setCards([...cards].sort(() => Math.random() - 0.5)); setIdx(0); };
  const card = cards[idx];

  return (
    <div data-testid="student-flashcards-page" className="space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Fast revision</div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Flashcards · tap to flip</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Micro-review the exact NCERT statements that get tested. 8–9 cards a minute. Do a chapter in the elevator.
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px,1fr] gap-6">
        <Card className="en-card p-5 h-fit">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">Chapters</div>
          <Select value={chapter} onValueChange={setChapter}>
            <SelectTrigger data-testid="flashcards-chapter-select" className="rounded-full">
              <SelectValue placeholder="Pick a chapter" />
            </SelectTrigger>
            <SelectContent>
              {chapters.map((c) => (
                <SelectItem key={`${c.subject}|${c.chapter}`} value={`${c.subject}|${c.chapter}`}>
                  {c.subject} · {c.chapter} <span className="text-muted-foreground">({c.cards})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-6 space-y-1.5">
            {chapters.map((c) => {
              const val = `${c.subject}|${c.chapter}`;
              const active = chapter === val;
              return (
                <button key={val} onClick={() => setChapter(val)}
                  data-testid={`flashcards-chapter-${c.chapter.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                    active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span>{c.chapter}</span>
                    <span className="text-xs text-muted-foreground">{c.cards}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{c.subject}</div>
                </button>
              );
            })}
          </div>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full">{cards.length} cards</Badge>
              {card && <Badge variant="outline" className="rounded-full">{card.subject}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground font-mono">{cards.length ? `${idx + 1} / ${cards.length}` : "—"}</div>
          </div>

          <div
            data-testid="flashcard-flipper"
            onClick={() => setFlipped((f) => !f)}
            className="relative rounded-3xl border-2 border-border bg-card shadow-lg cursor-pointer overflow-hidden aspect-[3/2] max-w-3xl select-none"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${idx}-${flipped}`}
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="absolute inset-0 grid place-items-center p-8"
              >
                <div className="text-center max-w-xl">
                  <div className="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-4">
                    {flipped ? "Answer" : "Prompt · tap to flip"}
                  </div>
                  <div className={`font-display font-bold ${flipped ? "text-lg sm:text-xl leading-relaxed" : "text-2xl sm:text-3xl leading-tight"}`}>
                    {card ? (flipped ? card.back : card.front) : "Pick a chapter to start"}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="absolute bottom-3 right-4 text-xs text-muted-foreground flex items-center gap-1.5">
              <RotateCcw className="h-3 w-3" /> tap card to flip
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button data-testid="flashcards-prev" variant="outline" className="rounded-full" onClick={prev} disabled={!cards.length}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button data-testid="flashcards-next" variant="outline" className="rounded-full" onClick={next} disabled={!cards.length}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button data-testid="flashcards-shuffle" variant="ghost" className="rounded-full" onClick={shuffle} disabled={!cards.length}>
              <Shuffle className="h-4 w-4 mr-1" /> Shuffle
            </Button>
            <div className="ml-auto text-sm text-muted-foreground flex items-center gap-2 whitespace-nowrap">
              <BookMarked className="h-4 w-4" /> {cards.length} cards in this chapter
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
