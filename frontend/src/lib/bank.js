import { useCallback, useEffect, useRef, useState } from "react";
import { questionsApi } from "@/lib/api";

// Filter value meaning "this field is empty" (backend: NOT_SET)
export const NOT_SET = "__none__";
export const ANY = "all";
export const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"];

export const EMPTY_FILTERS = {
  subject: "", student_class: "", chapter: "", topic: "",
  difficulty: "", q_type: "", status_f: "", search: "", untagged: false,
};

export const labelOf = (name) => (name ? name : "Not set");
export const classLabel = (c) => (!c ? "Not set" : /^\d+$/.test(c) ? `Class ${c}` : c);

/** Query params for /questions/page (and bulk-update by filter) from a filters object. */
export function toParams(filters) {
  const p = {};
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (k === "untagged") { if (v) p.untagged = true; return; }
    if (v && v !== ANY) p[k] = v;
  });
  return p;
}

/** Options for the dependent Class / Chapter / Topic dropdowns, with counts. */
export function taxonomyOptions(tax, { subject, student_class, chapter } = {}) {
  const subjects = tax?.subjects || [];
  const inSubject = subject ? subjects.filter((s) => s.name === subject) : subjects;
  const merge = (lists) => {
    const m = new Map();
    lists.flat().forEach((n) => {
      const cur = m.get(n.name) || { name: n.name, count: 0, children: [] };
      cur.count += n.count;
      cur.children.push(n);
      m.set(n.name, cur);
    });
    return [...m.values()];
  };
  const classes = merge(inSubject.map((s) => s.classes));
  const cls = student_class
    ? classes.filter((c) => c.name === (student_class === NOT_SET ? "" : student_class))
    : classes;
  const chapters = merge(cls.flatMap((c) => c.children.map((x) => x.chapters)));
  const ch = chapter ? chapters.filter((c) => c.name === (chapter === NOT_SET ? "" : chapter)) : [];
  const topics = merge(ch.flatMap((c) => c.children.map((x) => x.topics)));
  const strip = (arr) => arr.map(({ name, count }) => ({ name, count }));
  return { classes: strip(classes), chapters: strip(chapters), topics: strip(topics) };
}

/** Loads the taxonomy tree; `reload()` after any change to tags. */
export function useTaxonomy(params) {
  const [tax, setTax] = useState(null);
  const key = JSON.stringify(params || {});
  const reload = useCallback(() => {
    questionsApi.taxonomy(params).then(setTax).catch(() => setTax((t) => t || { subjects: [], total: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { reload(); }, [reload]);
  return { tax, reload };
}

/** One server-side page of the question bank for the given filters. */
export function useQuestionPage(filters, initialPageSize = 50) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const key = JSON.stringify(toParams(filters));
  const prevKey = useRef(key);
  const reqId = useRef(0);

  // new filters or page size → back to page 1
  useEffect(() => {
    if (prevKey.current !== key) { prevKey.current = key; setPage(1); }
  }, [key]);
  useEffect(() => { setPage(1); }, [pageSize]);

  const load = useCallback(() => {
    const id = ++reqId.current;
    setLoading(true); setError(null);
    questionsApi.page({ ...JSON.parse(key), page, page_size: pageSize })
      .then((d) => {
        if (id !== reqId.current) return;     // a newer request already started
        setRows(d.items || []); setTotal(d.total || 0); setPages(d.pages || 1);
        if (page > (d.pages || 1)) setPage(d.pages || 1);
      })
      .catch((e) => { if (id === reqId.current) setError(e); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [key, page, pageSize]);
  useEffect(() => { load(); }, [load]);

  return { rows, setRows, page, setPage, pageSize, setPageSize, total, pages, loading, error, reload: load };
}

/** Page numbers with gaps: [1, "…", 4, 5, 6, "…", 20] */
export function pageWindow(page, pages, radius = 2) {
  const out = [];
  const lo = Math.max(2, page - radius);
  const hi = Math.min(pages - 1, page + radius);
  out.push(1);
  if (lo > 2) out.push("gap-l");
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < pages - 1) out.push("gap-r");
  if (pages > 1) out.push(pages);
  return out;
}

export const STATUS_STYLE = {
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  review: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  draft: "bg-slate-500/10 text-slate-600 border-slate-400/30",
  archived: "bg-slate-500/10 text-slate-500 border-slate-400/30",
};
