import { useEffect, useState } from "react";
import { ChevronRight, Layers } from "lucide-react";
import { NOT_SET, labelOf, classLabel } from "@/lib/bank";

/**
 * Clickable Subject → Class → Chapter → Topic tree with question counts.
 * Clicking a row filters the bank to it; the arrow only opens/closes.
 * value: current filters; onSelect({subject, student_class, chapter, topic}).
 */
export default function TaxonomyTree({ tax, value, onSelect, testId = "tax-tree" }) {
  const [open, setOpen] = useState({});
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // keep the selected path expanded
  useEffect(() => {
    if (!value?.subject) return;
    const s = `s:${value.subject}`;
    const c = `${s}|c:${value.student_class === NOT_SET ? "" : value.student_class || ""}`;
    const ch = `${c}|ch:${value.chapter === NOT_SET ? "" : value.chapter || ""}`;
    setOpen((o) => ({ ...o, [s]: true, ...(value.student_class ? { [c]: true } : {}), ...(value.chapter ? { [ch]: true } : {}) }));
  }, [value?.subject, value?.student_class, value?.chapter]);

  if (!tax) return <div className="text-sm text-muted-foreground p-3">Loading…</div>;
  const subjects = tax.subjects || [];
  const enc = (x) => (x ? x : NOT_SET);
  const isSel = (sel) => ["subject", "student_class", "chapter", "topic"].every((k) => (value?.[k] || "") === (sel[k] || ""))
    && !value?.untagged;

  const Row = ({ depth, k, label, count, approved, hasKids, sel, muted }) => {
    const selected = isSel(sel);
    return (
      <div className={`group flex items-start rounded-md text-sm ${selected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/70"}`}
        style={{ paddingLeft: depth * 12 }}>
        <button type="button" aria-label={open[k] ? "Collapse" : "Expand"} onClick={() => hasKids && toggle(k)}
          className={`h-8 w-6 shrink-0 grid place-items-center ${hasKids ? "text-muted-foreground" : "opacity-0 pointer-events-none"}`}>
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open[k] ? "rotate-90" : ""}`} />
        </button>
        <button type="button" data-testid={`${testId}-${k}`} onClick={() => { onSelect(sel); if (hasKids && !open[k]) toggle(k); }}
          className={`flex-1 min-w-0 flex items-center gap-2 py-1.5 pr-2 text-left ${muted ? "italic text-muted-foreground" : ""}`}
          title={approved < count ? `${approved} approved · ${count - approved} not approved yet` : `${count} approved`}>
          <span className="min-w-0 break-words leading-snug">{label}</span>
          <span className="ml-auto shrink-0 pl-1 tabular-nums text-xs text-muted-foreground">
            {count.toLocaleString()}
            {approved < count && <span className="text-amber-600"> · {(count - approved).toLocaleString()}</span>}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div data-testid={testId} className="space-y-0.5">
      <button type="button" data-testid={`${testId}-all`} onClick={() => onSelect({})}
        className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${isSel({}) ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/70"}`}>
        <Layers className="h-4 w-4" /> All questions
        <span className="ml-auto tabular-nums text-xs text-muted-foreground">{(tax.total || 0).toLocaleString()}</span>
      </button>
      {subjects.map((s) => {
        const sk = `s:${s.name}`;
        return (
          <div key={sk}>
            <Row depth={0} k={sk} label={labelOf(s.name)} count={s.count} approved={s.approved} hasKids muted={!s.name}
              sel={{ subject: s.name }} />
            {open[sk] && s.classes.map((c) => {
              const ck = `${sk}|c:${c.name}`;
              return (
                <div key={ck}>
                  <Row depth={1} k={ck} label={classLabel(c.name)} count={c.count} approved={c.approved} hasKids muted={!c.name}
                    sel={{ subject: s.name, student_class: enc(c.name) }} />
                  {open[ck] && c.chapters.map((ch) => {
                    const chk = `${ck}|ch:${ch.name}`;
                    const onlyEmptyTopic = ch.topics.length === 1 && !ch.topics[0].name;
                    return (
                      <div key={chk}>
                        <Row depth={2} k={chk} label={labelOf(ch.name)} count={ch.count} approved={ch.approved}
                          hasKids={!onlyEmptyTopic} muted={!ch.name}
                          sel={{ subject: s.name, student_class: enc(c.name), chapter: enc(ch.name) }} />
                        {open[chk] && !onlyEmptyTopic && ch.topics.map((t) => (
                          <Row key={`${chk}|t:${t.name}`} depth={3} k={`${chk}|t:${t.name}`} label={labelOf(t.name)}
                            count={t.count} approved={t.approved} hasKids={false} muted={!t.name}
                            sel={{ subject: s.name, student_class: enc(c.name), chapter: enc(ch.name), topic: enc(t.name) }} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
      {subjects.length === 0 && <div className="text-sm text-muted-foreground px-2 py-3">No questions yet.</div>}
      {subjects.length > 0 && (
        <p className="px-2 pt-3 text-[11px] leading-snug text-muted-foreground">
          Number = questions. <span className="text-amber-600">Amber</span> = not approved yet; students and
          auto-pick only use approved questions. <i>Not set</i> = tag missing.
        </p>
      )}
    </div>
  );
}
