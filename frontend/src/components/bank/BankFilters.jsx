import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { ANY, NOT_SET, SUBJECTS, SORTS, taxonomyOptions, labelOf, classLabel } from "@/lib/bank";
import { MoreFilters, FilterChips } from "@/components/bank/MoreFilters";

const MORE_KEYS = ["exam", "year", "source", "tag", "language", "answer", "solution", "image", "added", "duplicates", "issue"];

const TYPES = [
  ["mcq_single", "MCQ (single)"], ["mcq_multi", "MCQ (multi)"], ["integer", "Integer"],
  ["true_false", "True/False"], ["assertion_reason", "Assertion-Reason"], ["match", "Match"],
  ["subjective", "Subjective"],
];

/**
 * Subject → Class → Chapter → Topic dropdowns (each list only shows what exists under the
 * level above, with counts) + difficulty / type / status / text search.
 * `show` picks extra filters: ["difficulty", "type", "status"].
 */
export default function BankFilters({ filters, setFilters, tax, show = ["difficulty", "type", "status"], compact = false,
  testId = "bank-filters", facets = null, sort = null, setSort = null }) {
  const [search, setSearch] = useState(filters.search || "");
  const moreActive = MORE_KEYS.filter((k) => filters[k]).length;
  const [moreOpen, setMoreOpen] = useState(moreActive > 0);
  useEffect(() => { setSearch(filters.search || ""); }, [filters.search]);
  useEffect(() => {          // debounce typing
    const t = setTimeout(() => {
      if ((filters.search || "") !== search) setFilters((f) => ({ ...f, search }));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const opts = useMemo(() => taxonomyOptions(tax, filters), [tax, filters]);
  const subjectNames = useMemo(() => {
    const fromTax = (tax?.subjects || []).map((s) => s.name).filter(Boolean);
    return [...new Set([...SUBJECTS, ...fromTax])];
  }, [tax]);
  const subjectCount = (name) => (tax?.subjects || []).find((s) => s.name === name)?.count || 0;

  const set = (patch) => setFilters((f) => ({ ...f, ...patch, untagged: patch.untagged ?? false }));
  const v = (x) => x || ANY;
  const pick = (x) => (x === ANY ? "" : x);
  const optVal = (name) => (name ? name : NOT_SET);

  const cell = compact ? "h-9 text-xs" : "";
  return (
    <div data-testid={testId} className={compact ? "grid grid-cols-2 gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
      <div className={`relative ${compact ? "col-span-2" : "sm:col-span-2 lg:col-span-4"}`}>
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input data-testid={`${testId}-search`} placeholder="Search question text…" className={`pl-9 ${cell}`}
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Select value={v(filters.subject)} onValueChange={(x) => set({ subject: pick(x), student_class: "", chapter: "", topic: "" })}>
        <SelectTrigger data-testid={`${testId}-subject`} className={cell}><SelectValue placeholder="Subject" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All subjects</SelectItem>
          {subjectNames.map((s) => <SelectItem key={s} value={s}>{s} ({subjectCount(s)})</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={v(filters.student_class)} onValueChange={(x) => set({ student_class: pick(x), chapter: "", topic: "" })}>
        <SelectTrigger data-testid={`${testId}-class`} className={cell}><SelectValue placeholder="Class" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All classes</SelectItem>
          {opts.classes.map((c) => <SelectItem key={c.name || NOT_SET} value={optVal(c.name)}>{classLabel(c.name)} ({c.count})</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={v(filters.chapter)} onValueChange={(x) => set({ chapter: pick(x), topic: "" })}>
        <SelectTrigger data-testid={`${testId}-chapter`} className={cell}><SelectValue placeholder="Chapter" /></SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={ANY}>All chapters</SelectItem>
          {opts.chapters.map((c) => <SelectItem key={c.name || NOT_SET} value={optVal(c.name)}>{labelOf(c.name)} ({c.count})</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={v(filters.topic)} disabled={!filters.chapter} onValueChange={(x) => set({ topic: pick(x) })}>
        <SelectTrigger data-testid={`${testId}-topic`} className={cell}>
          <SelectValue placeholder={filters.chapter ? "Topic" : "Topic (pick a chapter)"} />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={ANY}>All topics</SelectItem>
          {opts.topics.map((t) => <SelectItem key={t.name || NOT_SET} value={optVal(t.name)}>{labelOf(t.name)} ({t.count})</SelectItem>)}
        </SelectContent>
      </Select>

      {show.includes("difficulty") && (
        <Select value={v(filters.difficulty)} onValueChange={(x) => set({ difficulty: pick(x) })}>
          <SelectTrigger data-testid={`${testId}-difficulty`} className={cell}><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All levels</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      )}
      {show.includes("type") && (
        <Select value={v(filters.q_type)} onValueChange={(x) => set({ q_type: pick(x) })}>
          <SelectTrigger data-testid={`${testId}-type`} className={cell}><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All types</SelectItem>
            {TYPES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {show.includes("status") && (
        <Select value={v(filters.status_f)} onValueChange={(x) => set({ status_f: pick(x) })}>
          <SelectTrigger data-testid={`${testId}-status`} className={cell}><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All statuses</SelectItem>
            <SelectItem value="approved">Approved{tax?.status?.approved != null ? ` (${tax.status.approved})` : ""}</SelectItem>
            <SelectItem value="review">Review{tax?.status?.review != null ? ` (${tax.status.review})` : ""}</SelectItem>
            <SelectItem value="draft">Draft{tax?.status?.draft != null ? ` (${tax.status.draft})` : ""}</SelectItem>
            <SelectItem value="archived">Archived{tax?.status?.archived != null ? ` (${tax.status.archived})` : ""}</SelectItem>
          </SelectContent>
        </Select>
      )}
      {(facets || setSort) && (
        <div className={`flex flex-wrap items-center gap-2 ${compact ? "col-span-2" : "sm:col-span-2 lg:col-span-4"}`}>
          {facets && (
            <Button type="button" variant={moreOpen ? "secondary" : "outline"} size="sm" className="rounded-full h-8"
              data-testid={`${testId}-more`} onClick={() => setMoreOpen((o) => !o)}>
              <SlidersHorizontal className="h-4 w-4 mr-1.5" /> More filters{moreActive ? ` (${moreActive})` : ""}
            </Button>
          )}
          {setSort && (
            <Select value={sort || "newest"} onValueChange={setSort}>
              <SelectTrigger data-testid={`${testId}-sort`} className="h-8 w-auto min-w-[190px] rounded-full text-sm">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 opacity-60" /><SelectValue />
              </SelectTrigger>
              <SelectContent>{SORTS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      )}
      {facets && moreOpen && (
        <div className={compact ? "col-span-2" : "sm:col-span-2 lg:col-span-4"}>
          <MoreFilters filters={filters} setFilters={setFilters} facets={facets} testId={`${testId}-more-panel`} />
        </div>
      )}
      <div className={compact ? "col-span-2" : "sm:col-span-2 lg:col-span-4"}>
        <FilterChips filters={filters} setFilters={(f) => { setFilters(f); if (typeof f === "object" && !f.search) setSearch(""); }}
          testId={`${testId}-chips`} />
      </div>
    </div>
  );
}
