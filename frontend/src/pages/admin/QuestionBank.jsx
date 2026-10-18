import { useEffect, useState } from "react";
import { questionsApi, importApi, downloadBlob } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Trash2, AlertTriangle, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { QuestionContent, QuestionImage } from "@/components/QuestionContent";
import MathText from "@/components/MathText";
import AiFixPanel from "@/components/admin/AiFixPanel";

const ISSUE_LABEL = { "no-answer": "Answer nahi hai", "picture-missing": "Picture missing", "ai-unsure": "AI ko yakeen nahi",
  "ai-answered": "AI answer — check karein", "options-missing": "Options missing" };
const DIFF_COLOR = { easy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", medium: "bg-amber-500/10 text-amber-600 border-amber-500/20", hard: "bg-red-500/10 text-red-600 border-red-500/20" };

export default function QuestionBank() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ subject: "", difficulty: "", q_type: "", search: "", issue: "" });
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkEdit, setBulkEdit] = useState({ difficulty: "", status: "", chapter: "", topic: "", tags: "" });

  // The bank can hold tens of thousands of questions: load one page at a time
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  useEffect(() => {          // debounce typing in the search box
    const t = setTimeout(() => setFilters((f) => (f.search === search ? f : { ...f, search })), 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [filters, pageSize]);

  const load = () => {
    setLoading(true);
    const params = { page, page_size: pageSize };
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== "all") params[k] = v; });
    questionsApi.page(params).then((d) => {
      setRows(d.items || []); setTotal(d.total || 0); setPages(d.pages || 1); setSel(new Set());
    }).catch(() => toast.error("Could not load questions")).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters, page, pageSize]);
  const go = (p) => { setPage(Math.min(Math.max(1, p), pages)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  const pager = (
    <div data-testid="bank-pager" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="text-muted-foreground">Showing <b>{from.toLocaleString()}–{to.toLocaleString()}</b> of <b>{total.toLocaleString()}</b> questions</div>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger data-testid="page-size" className="w-[110px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[30, 40, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="rounded-full" data-testid="page-first" disabled={page <= 1 || loading} onClick={() => go(1)}>« First</Button>
        <Button size="sm" variant="outline" className="rounded-full" data-testid="page-prev" disabled={page <= 1 || loading} onClick={() => go(page - 1)}>‹ Prev</Button>
        <span className="px-2">Page <b>{page}</b> of <b>{pages.toLocaleString()}</b></span>
        <Button size="sm" variant="outline" className="rounded-full" data-testid="page-next" disabled={page >= pages || loading} onClick={() => go(page + 1)}>Next ›</Button>
        <Button size="sm" variant="outline" className="rounded-full" data-testid="page-last" disabled={page >= pages || loading} onClick={() => go(pages)}>Last »</Button>
      </div>
    </div>
  );

  const remove = async (id) => {
    if (!confirm("Delete this question?")) return;
    await questionsApi.remove(id); toast.success("Deleted"); load();
  };

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggleAll = () => setSel((s) => {
    if (allOnPage) return new Set();
    return new Set(rows.map((r) => r.id));
  });

  const ids = [...sel];

  const doBulkDelete = async () => {
    setDeleting(true);
    try {
      const r = await questionsApi.bulkDelete(ids);
      toast.success(`Deleted ${r.deleted} question(s)`);
      setConfirmBulk(false); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk delete failed");
    } finally { setDeleting(false); }
  };

  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.subject && filters.subject !== "all") params.subject = filters.subject;
      const blob = await importApi.exportBank(params);
      downloadBlob(blob, `FNJEE_Questions_${params.subject || "All"}.xlsx`);
      toast.success("Excel downloaded — edit it and upload again via Bulk import");
    } catch (e) {
      toast.error("Export failed");
    } finally { setExporting(false); }
  };

  const doBulkEdit = async () => {
    const patch = {};
    ["difficulty", "status", "chapter", "topic"].forEach((k) => { if (bulkEdit[k]) patch[k] = bulkEdit[k]; });
    const add_tags = bulkEdit.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (!Object.keys(patch).length && !add_tags.length) return toast.error("Choose at least one field to change");
    try {
      const r = await questionsApi.bulkUpdate(ids, patch, add_tags);
      toast.success(`Updated ${r.modified} question(s)`);
      setBulkEdit({ difficulty: "", status: "", chapter: "", topic: "", tags: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk update failed");
    }
  };

  return (
    <div data-testid="question-bank-page" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Content</div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Question Bank</h1>
          <p className="text-muted-foreground mt-1">Every question, tagged and ready to build a test.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/questions/new"><Button data-testid="new-question-btn" className="rounded-full">+ New question</Button></Link>
          <Link to="/admin/import"><Button data-testid="go-import-btn" variant="outline" className="rounded-full">Bulk import</Button></Link>
          <Button data-testid="export-excel-btn" variant="outline" className="rounded-full" onClick={exportExcel} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />{exporting ? "Exporting…" : "Export to Excel"}
          </Button>
        </div>
      </div>

      <AiFixPanel onFinished={load} onShowIssue={(issue) => setFilters((f) => ({ ...f, issue }))} />

      <Card className="en-card p-4">
        {filters.issue && (
          <div className="mb-3 flex items-center gap-2 text-sm" data-testid="issue-filter">
            <Badge variant="secondary">Showing: {ISSUE_LABEL[filters.issue] || filters.issue}</Badge>
            <Button size="sm" variant="ghost" onClick={() => setFilters((f) => ({ ...f, issue: "" }))}>Clear ✕</Button>
          </div>
        )}
        <div className="grid md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input data-testid="search-question" placeholder="Search text…" className="pl-9" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filters.subject || "all"} onValueChange={(v) => setFilters({...filters, subject: v === "all" ? "" : v})}>
            <SelectTrigger data-testid="filter-subject"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              <SelectItem value="Physics">Physics</SelectItem>
              <SelectItem value="Chemistry">Chemistry</SelectItem>
              <SelectItem value="Mathematics">Mathematics</SelectItem>
              <SelectItem value="Biology">Biology</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.difficulty || "all"} onValueChange={(v) => setFilters({...filters, difficulty: v === "all" ? "" : v})}>
            <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.q_type || "all"} onValueChange={(v) => setFilters({...filters, q_type: v === "all" ? "" : v})}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="mcq_single">MCQ (single)</SelectItem>
              <SelectItem value="mcq_multi">MCQ (multi)</SelectItem>
              <SelectItem value="true_false">True/False</SelectItem>
              <SelectItem value="integer">Integer</SelectItem>
              <SelectItem value="assertion_reason">Assertion-Reason</SelectItem>
              <SelectItem value="subjective">Subjective</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Bulk action bar — visible when rows are selected */}
      {sel.size > 0 && (
        <Card data-testid="bulk-action-bar" className="en-card p-3 flex flex-wrap items-center gap-3 border-primary/30 bg-primary/5">
          <span data-testid="bulk-selected-count" className="text-sm font-semibold px-2">{sel.size} selected</span>
          <Select value={bulkEdit.difficulty} onValueChange={(v) => setBulkEdit({ ...bulkEdit, difficulty: v })}>
            <SelectTrigger data-testid="bulk-difficulty" className="w-[140px] h-9"><SelectValue placeholder="Set difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bulkEdit.status} onValueChange={(v) => setBulkEdit({ ...bulkEdit, status: v })}>
            <SelectTrigger data-testid="bulk-status" className="w-[130px] h-9"><SelectValue placeholder="Set status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Input data-testid="bulk-chapter" className="w-[150px] h-9" placeholder="Set chapter" value={bulkEdit.chapter} onChange={(e) => setBulkEdit({ ...bulkEdit, chapter: e.target.value })} />
          <Input data-testid="bulk-tags" className="w-[160px] h-9" placeholder="Add tags (comma)" value={bulkEdit.tags} onChange={(e) => setBulkEdit({ ...bulkEdit, tags: e.target.value })} />
          <Button data-testid="bulk-apply-btn" size="sm" variant="outline" className="rounded-full" onClick={doBulkEdit}>Apply changes</Button>
          <div className="flex-1" />
          <Button data-testid="bulk-delete-btn" size="sm" variant="destructive" className="rounded-full" onClick={() => setConfirmBulk(true)}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete selected
          </Button>
          <Button data-testid="bulk-clear-btn" size="sm" variant="ghost" className="rounded-full" onClick={() => setSel(new Set())}>Clear</Button>
        </Card>
      )}

      {pager}
      <Card className="en-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox data-testid="select-all-questions" checked={allOnPage} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Chapter</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead className="text-right">Marks</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No questions yet. Try the Import Wizard.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id} data-testid={`qrow-${r.id}`} className={sel.has(r.id) ? "bg-primary/5" : ""}>
                <TableCell>
                  <Checkbox data-testid={`select-q-${r.id}`} checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label="Select question" />
                </TableCell>
                <TableCell className="max-w-md min-w-[220px]">
                  <details data-testid={`question-preview-${r.id}`}>
                    <summary data-testid={`question-preview-toggle-${r.id}`} className="cursor-pointer font-medium">
                      <MathText>{r.text.split('\n')[0]}</MathText>
                      {(r.image_url || r.text.includes('| ---')) && <span className="ml-2 text-xs text-primary">{r.image_url ? "Image" : "Table"}</span>}
                    </summary>
                    <div className="mt-4 space-y-3">
                      {r.content_origin === "ai_adapted" && <Badge data-testid={`question-origin-${r.id}`} variant="outline">AI-adapted practice</Badge>}
                      <QuestionContent question={r} testId={`bank-question-${r.id}`} />
                      {r.options?.map((o,i) => <div key={i} data-testid={`bank-option-${r.id}-${i}`}><b>{String.fromCharCode(65+i)}.</b> <MathText>{o}</MathText></div>)}
                      <div data-testid={`bank-answer-${r.id}`} className="text-sm text-emerald-700">Answer: {(r.correct || []).join(', ')}</div>
                      <MathText>{r.explanation}</MathText>
                      <QuestionImage src={r.explanation_image_url} testId={`bank-solution-${r.id}`} alt="Source solution illustration" />
                    </div>
                  </details>
                </TableCell>
                <TableCell><Badge variant="secondary" className="rounded-full">{r.subject}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.chapter || "—"}</TableCell>
                <TableCell className="text-xs">{r.type}</TableCell>
                <TableCell><Badge className={`rounded-full border ${DIFF_COLOR[r.difficulty] || ""}`} variant="outline">{r.difficulty}</Badge></TableCell>
                <TableCell className="text-right font-medium">{r.marks}</TableCell>
                <TableCell className="text-right">
                  <Button data-testid={`delete-q-${r.id}`} size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {total > pageSize && pager}

      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent data-testid="bulk-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete {sel.size} question(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected questions from the bank. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="bulk-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="bulk-delete-confirm-btn" disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); doBulkDelete(); }}>
              {deleting ? "Deleting…" : `Delete ${sel.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
