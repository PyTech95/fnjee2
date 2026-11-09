import { useEffect, useMemo, useState } from "react";
import { practiceApi } from "@/lib/api";
import { classLabel } from "@/lib/bank";
import { Check, Search } from "lucide-react";

/**
 * Optional chapter (and topic) picker for students' practice / DPP and parents' "assign a test".
 * A scrolling list of chapter names per subject (grouped by class) with a search box.
 * Question counts are an admin concern, so they are hidden unless showCounts is set.
 * value: {chapters: [], topics: []}; onChange(next).
 */
export default function ChapterPicker({ subjects, value, onChange, testId = "chapter-picker", showCounts = false, showTopics = true }) {
  const [all, setAll] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { practiceApi.chapters().then(setAll).catch(() => setAll([])); }, []);

  const rows = useMemo(() => (all || []).filter((r) => !subjects?.length || subjects.includes(r.subject)), [all, subjects]);
  const chapters = value?.chapters || [];
  const topics = value?.topics || [];

  // drop picks that no longer belong to the chosen subjects
  useEffect(() => {
    if (!all) return;
    const ok = new Set(rows.map((r) => r.chapter));
    const keep = chapters.filter((c) => ok.has(c));
    if (keep.length !== chapters.length) onChange({ chapters: keep, topics: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const topicRows = useMemo(() => {
    const m = new Map();
    rows.filter((r) => chapters.includes(r.chapter)).forEach((r) => r.topics.forEach((t) => m.set(t.name, (m.get(t.name) || 0) + t.count)));
    return [...m.entries()].map(([name, count]) => ({ name, count }));
  }, [rows, chapters]);

  const toggle = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const chip = (on) => `px-3 py-1.5 rounded-full text-xs border transition-colors text-left ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`;
  const n = (c) => (showCounts ? <span className="opacity-60 ml-1">({c})</span> : null);

  if (all === null) return <div className="text-xs text-muted-foreground">Loading chapters…</div>;
  if (!rows.length) return <div className="text-xs text-muted-foreground">No chapter-wise questions for these subjects yet — the paper will mix all chapters.</div>;

  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => r.chapter.toLowerCase().includes(needle)) : rows;
  // subject -> class -> rows
  const groups = shown.reduce((acc, r) => {
    const s = (acc[r.subject] = acc[r.subject] || {});
    const k = r.student_class ? classLabel(r.student_class) : "Other chapters";
    (s[k] = s[k] || []).push(r);
    return acc;
  }, {});
  const multiSubject = Object.keys(groups).length > 1;

  return (
    <div data-testid={testId} className="space-y-3">
      {rows.length > 10 && (
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input data-testid={`${testId}-search`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a chapter…"
            className="w-full h-9 rounded-full border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto en-scroll rounded-xl border divide-y" data-testid={`${testId}-list`}>
        {Object.entries(groups).map(([subj, byClass]) => (
          <div key={subj}>
            {multiSubject && <div className="sticky top-0 z-10 bg-muted/90 backdrop-blur px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider">{subj}</div>}
            {Object.entries(byClass).map(([cls, list]) => (
              <div key={cls}>
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground">{cls}</div>
                {list.map((r) => {
                  const on = chapters.includes(r.chapter);
                  return (
                    <button key={`${subj}-${r.chapter}`} type="button" data-testid={`${testId}-ch-${r.chapter}`}
                      onClick={() => onChange({ chapters: toggle(chapters, r.chapter), topics: [] })}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${on ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                      <span className={`h-4 w-4 rounded border grid place-items-center shrink-0 ${on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 break-anywhere">{r.chapter}{n(r.count)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
        {!shown.length && <div className="px-3 py-4 text-xs text-muted-foreground">No chapter matches “{q}”.</div>}
      </div>
      {chapters.length > 0 && <div className="text-xs text-muted-foreground">{chapters.length} chapter{chapters.length > 1 ? "s" : ""} selected</div>}
      {showTopics && topicRows.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1.5">Topics (optional)</div>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto en-scroll">
            {topicRows.map((t) => (
              <button key={t.name} type="button" data-testid={`${testId}-t-${t.name}`} className={chip(topics.includes(t.name))}
                onClick={() => onChange({ chapters, topics: toggle(topics, t.name) })}>
                {t.name}{n(t.count)}
              </button>
            ))}
          </div>
        </div>
      )}
      {(chapters.length > 0 || topics.length > 0) && (
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange({ chapters: [], topics: [] })}>
          Clear — use all chapters
        </button>
      )}
    </div>
  );
}
