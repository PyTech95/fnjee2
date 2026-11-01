import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ANY, NOT_SET, EMPTY_FILTERS, VALUE_LABELS, activeChips } from "@/lib/bank";

const n = (x) => (x || 0).toLocaleString("en-IN");

function FacetSelect({ label, value, onChange, items, allowNotSet = true, testId }) {
  const rows = (items || []).filter((r) => r.name);
  const unset = (items || []).find((r) => !r.name);
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <Select value={value || ANY} onValueChange={(v) => onChange(v === ANY ? "" : v)}>
        <SelectTrigger data-testid={testId} className="h-9"><SelectValue placeholder={`Any ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={ANY}>Any {label.toLowerCase()}</SelectItem>
          {rows.map((r) => <SelectItem key={r.name} value={r.name}>{r.name} ({n(r.count)})</SelectItem>)}
          {allowNotSet && unset && <SelectItem value={NOT_SET}>Not set ({n(unset.count)})</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChoiceSelect({ label, field, value, onChange, counts = {}, testId }) {
  const opts = VALUE_LABELS[field] || {};
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <Select value={value || ANY} onValueChange={(v) => onChange(v === ANY ? "" : v)}>
        <SelectTrigger data-testid={testId} className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any</SelectItem>
          {Object.entries(opts).map(([k, l]) => (
            <SelectItem key={k} value={k}>{l}{counts[k] != null ? ` (${n(counts[k])})` : ""}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Exam, year, source, tag, language, answer/solution/picture present, date added, duplicates, problems. */
export function MoreFilters({ filters, setFilters, facets, testId = "more-filters" }) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const c = facets?.checks || {};
  return (
    <div data-testid={testId} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-3 border-t border-border">
      <FacetSelect label="Exam" value={filters.exam} items={facets?.exams} onChange={(v) => set({ exam: v })} testId={`${testId}-exam`} />
      <FacetSelect label="Year" value={filters.year} items={facets?.years} onChange={(v) => set({ year: v })} testId={`${testId}-year`} />
      <FacetSelect label="Source" value={filters.source} items={facets?.sources} onChange={(v) => set({ source: v })} testId={`${testId}-source`} />
      <FacetSelect label="Tag" value={filters.tag} items={facets?.tags} allowNotSet={false} onChange={(v) => set({ tag: v })} testId={`${testId}-tag`} />
      <FacetSelect label="Language" value={filters.language} items={facets?.languages} allowNotSet={false} onChange={(v) => set({ language: v })} testId={`${testId}-language`} />
      <ChoiceSelect label="Answer" field="answer" value={filters.answer} onChange={(v) => set({ answer: v })}
        counts={{ missing: c.no_answer }} testId={`${testId}-answer`} />
      <ChoiceSelect label="Solution" field="solution" value={filters.solution} onChange={(v) => set({ solution: v })}
        counts={{ missing: c.no_solution }} testId={`${testId}-solution`} />
      <ChoiceSelect label="Picture" field="image" value={filters.image} onChange={(v) => set({ image: v })}
        counts={{ with: c.with_image }} testId={`${testId}-image`} />
      <ChoiceSelect label="Added" field="added" value={filters.added} onChange={(v) => set({ added: v })}
        counts={{ today: c.added_today, "7d": c.added_7d, "30d": c.added_30d }} testId={`${testId}-added`} />
      <ChoiceSelect label="Problem" field="issue" value={filters.issue} onChange={(v) => set({ issue: v })}
        counts={{ "no-answer": c.no_answer, "picture-missing": c.picture_missing, "ai-unsure": c.ai_unsure,
          "ai-answered": c.ai_answered, "answer-review": c.answer_review }} testId={`${testId}-issue`} />
      <label className="flex items-center gap-2 text-sm self-end h-9 cursor-pointer">
        <Checkbox checked={!!filters.duplicates} onCheckedChange={(v) => set({ duplicates: !!v })} data-testid={`${testId}-duplicates`} />
        Only duplicates{c.duplicates != null ? <span className="text-muted-foreground">({n(c.duplicates)})</span> : null}
      </label>
    </div>
  );
}

/** Removable chips for every active filter + "Clear all". */
export function FilterChips({ filters, setFilters, testId = "filter-chips" }) {
  const chips = activeChips(filters);
  if (!chips.length) return null;
  const clear = (k) => setFilters((f) => {
    const n = { ...f, [k]: EMPTY_FILTERS[k] ?? "" };
    if (k === "subject") Object.assign(n, { student_class: "", chapter: "", topic: "" });
    if (k === "student_class") Object.assign(n, { chapter: "", topic: "" });
    if (k === "chapter") n.topic = "";
    return n;
  });
  return (
    <div data-testid={testId} className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button key={c.key} type="button" onClick={() => clear(c.key)} data-testid={`${testId}-${c.key}`}
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary hover:bg-primary/10">
          <span className="max-w-[260px] truncate">{c.label}</span><X className="h-3 w-3" />
        </button>
      ))}
      <Button type="button" size="sm" variant="ghost" className="h-7 rounded-full text-xs" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
        Clear all
      </Button>
    </div>
  );
}
