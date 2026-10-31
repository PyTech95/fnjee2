import { useEffect, useMemo, useState } from "react";
import { practiceApi } from "@/lib/api";
import { classLabel } from "@/lib/bank";

/**
 * Optional chapter (and topic) chips for students' practice and parents' "assign a test".
 * Lists only chapters of the chosen subjects that have approved questions, with counts.
 * value: {chapters: [], topics: []}; onChange(next).
 */
export default function ChapterPicker({ subjects, value, onChange, testId = "chapter-picker" }) {
  const [all, setAll] = useState(null);
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

  if (all === null) return <div className="text-xs text-muted-foreground">Loading chapters…</div>;
  if (!rows.length) return <div className="text-xs text-muted-foreground">No chapter-wise questions for these subjects yet — the paper will mix all chapters.</div>;

  const bySubject = rows.reduce((acc, r) => { (acc[r.subject] = acc[r.subject] || []).push(r); return acc; }, {});
  return (
    <div data-testid={testId} className="space-y-3">
      {Object.entries(bySubject).map(([subj, list]) => (
        <div key={subj}>
          {Object.keys(bySubject).length > 1 && <div className="text-xs font-semibold text-muted-foreground mb-1.5">{subj}</div>}
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto en-scroll pr-1">
            {list.map((r) => (
              <button key={`${subj}-${r.chapter}`} type="button" data-testid={`${testId}-ch-${r.chapter}`}
                className={chip(chapters.includes(r.chapter))}
                onClick={() => onChange({ chapters: toggle(chapters, r.chapter), topics: [] })}>
                {r.chapter}{r.student_class ? ` · ${classLabel(r.student_class)}` : ""} <span className="opacity-70">({r.count})</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {topicRows.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1.5">Topics (optional)</div>
          <div className="flex flex-wrap gap-1.5">
            {topicRows.map((t) => (
              <button key={t.name} type="button" data-testid={`${testId}-t-${t.name}`} className={chip(topics.includes(t.name))}
                onClick={() => onChange({ chapters, topics: toggle(topics, t.name) })}>
                {t.name} <span className="opacity-70">({t.count})</span>
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
