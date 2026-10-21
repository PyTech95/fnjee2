import { useMemo, useState } from "react";
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
import { Trash2, AlertTriangle, Download, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { QuestionContent, QuestionImage } from "@/components/QuestionContent";
import MathText from "@/components/MathText";
import NumberedPager from "@/components/bank/NumberedPager";
import BankFilters from "@/components/bank/BankFilters";
import TaxonomyTree from "@/components/bank/TaxonomyTree";
import MappingTools from "@/components/bank/MappingTools";
import {
  EMPTY_FILTERS, SUBJECTS, NOT_SET, STATUS_STYLE, toParams, useQuestionPage, useTaxonomy, classLabel,
} from "@/lib/bank";

const DIFF_COLOR = { easy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", medium: "bg-amber-500/10 text-amber-600 border-amber-500/20", hard: "bg-red-500/10 text-red-600 border-red-500/20" };
const EMPTY_BULK = { subject: "", student_class: "", chapter: "", topic: "", difficulty: "", status: "", tags: "" };

export default function QuestionBank() {
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const { tax, reload: reloadTax } = useTaxonomy();
  const pg = useQuestionPage(filters, 50);
  const { rows } = pg;

  const [sel, setSel] = useState(new Set());
  const [allMatching, setAllMatching] = useState(false);   // bulk-edit every question matching the filters
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkEdit, setBulkEdit] = useState({ ...EMPTY_BULK });

  const refresh = () => { pg.reload(); reloadTax(); setSel(new Set()); setAllMatching(false); };
  const applyFilters = (f) => { setFilters(f); setSel(new Set()); setAllMatching(false); };
  const setFiltersFn = (updater) => {
    setFilters((f) => (typeof updater === "function" ? updater(f) : updater));
    setSel(new Set()); setAllMatching(false);
  };
  const go = (p) => { pg.setPage(p); setAllMatching(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const remove = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    await questionsApi.remove(id); toast.success("Deleted"); refresh();
  };

  const toggle = (id) => { setAllMatching(false); setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggleAll = () => { setAllMatching(false); setSel(allOnPage ? new Set() : new Set(rows.map((r) => r.id))); };
  const ids = [...sel];
  const selCount = allMatching ? pg.total : sel.size;

  const doBulkDelete = async () => {
    setDeleting(true);
    try {
      const r = await questionsApi.bulkDelete(ids);
      toast.success(`Deleted ${r.deleted} question(s)`);
      setConfirmBulk(false); refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk delete failed");
    } finally { setDeleting(false); }
  };

  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      ["subject", "chapter", "student_class", "status_f"].forEach((k) => {
        if (filters[k] && filters[k] !== NOT_SET) params[k] = filters[k];
      });
      const blob = await importApi.exportBank(params);
      downloadBlob(blob, `FNJEE_Questions_${params.subject || "All"}${params.chapter ? "_" + params.chapter.replace(/\W+/g, "_") : ""}.xlsx`);
      toast.success("Excel downloaded — edit it and upload again via Bulk import");
    } catch (e) {
      toast.error("Export failed");
    } finally { setExporting(false); }
  };

  const doBulkEdit = async () => {
    const patch = {};
    ["subject", "student_class", "chapter", "topic", "difficulty", "status"].forEach((k) => { if (bulkEdit[k]) patch[k] = bulkEdit[k]; });
    const add_tags = bulkEdit.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (!Object.keys(patch).length && !add_tags.length) return toast.error("Choose at least one field to change");
    try {
      const r = allMatching
        ? await questionsApi.bulkUpdateByFilter(toParams(filters), patch, add_tags)
        : await questionsApi.bulkUpdate(ids, patch, add_tags);
      toast.success(`Updated ${r.modified} question(s)`);
      setBulkEdit({ ...EMPTY_BULK });
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk update failed");
    }
  };

  const [tagging, setTagging] = useState(false);
  const [tagJob, setTagJob] = useState(null);
  const aiTagSelected = async () => {
    setTagging(true);
    try {
      const r = await questionsApi.autoTagStart({ ids });
      if (!r.job_id) { toast.success(r.message || "Nothing to tag"); return; }
      toast.success(`AI is tagging ${r.count} question(s)`);
      setTagJob(r.job_id);          // MappingTools shows progress and refreshes when done
      setSel(new Set());
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not start auto-tag");
    } finally { setTagging(false); }
  };

  // chapter suggestions for the bulk "Set chapter" box: NCERT list for the chosen subject
  const chapterSuggestions = useMemo(() => {
    const syl = tax?.syllabus || {};
    const subj = bulkEdit.subject || (filters.subject && filters.subject !== NOT_SET ? filters.subject : "");
    const lists = subj ? [syl[subj] || {}] : Object.values(syl);
    const cls = bulkEdit.student_class || "";
    return [...new Set(lists.flatMap((byClass) => Object.entries(byClass)
      .filter(([c]) => !cls || c === cls).flatMap(([, chs]) => chs)))];
  }, [tax, bulkEdit.subject, bulkEdit.student_class, filters.subject]);

  const tagCell = (val, label) => val
    ? <span>{label ? label(val) : val}</span>
    : <span className="text-amber-600 italic">Not set</span>;

  return (
    <div data-testid="question-bank-page" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Content</div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Question Bank</h1>
          <p className="text-muted-foreground mt-1">
            {tax ? <><b>{(tax.total || 0).toLocaleString()}</b> questions · browse by subject → class → chapter → topic.</> : "Every question, tagged and ready to build a test."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/questions/new"><Button data-testid="new-question-btn" className="rounded-full">+ New question</Button></Link>
          <Link to="/admin/import"><Button data-testid="go-import-btn" variant="outline" className="rounded-full">Bulk import</Button></Link>
          <Button data-testid="export-excel-btn" variant="outline" className="rounded-full" onClick={exportExcel} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />{exporting ? "Exporting…" : "Export to Excel"}
          </Button>
        </div>
      </div>

      <MappingTools tax={tax} onChanged={refresh} jobId={tagJob}
        onShowUntagged={() => applyFilters({ ...EMPTY_FILTERS, untagged: true })}
        onShowReview={() => applyFilters({ ...EMPTY_FILTERS, status_f: "review" })} />

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* left: subject → class → chapter → topic */}
        <Card className="en-card p-3 h-fit lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] overflow-y-auto en-scroll" data-testid="bank-tree-card">
          <div className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Browse</div>
          <TaxonomyTree tax={tax} value={filters}
            onSelect={(s) => applyFilters({ ...EMPTY_FILTERS, ...s })} />
        </Card>

        {/* right: filters + list */}
        <div className="space-y-4 min-w-0">
          <Card className="en-card p-4">
            <BankFilters filters={filters} setFilters={setFiltersFn} tax={tax} />
            {filters.untagged && (
              <div className="mt-3 text-sm flex items-center gap-2" data-testid="untagged-filter-on">
                <Badge variant="outline" className="rounded-full border-amber-500/40 text-amber-700">Showing: missing class / chapter / topic</Badge>
                <Button size="sm" variant="link" className="h-auto p-0" onClick={() => applyFilters({ ...EMPTY_FILTERS })}>Show all</Button>
              </div>
            )}
          </Card>

          {/* Bulk action bar — visible when rows are selected */}
          {selCount > 0 && (
            <Card data-testid="bulk-action-bar" className="en-card p-3 space-y-3 border-primary/30 bg-primary/5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span data-testid="bulk-selected-count" className="font-semibold px-1">{selCount.toLocaleString()} selected</span>
                {allOnPage && !allMatching && pg.total > rows.length && (
                  <Button size="sm" variant="link" className="h-auto p-0" data-testid="select-all-matching" onClick={() => setAllMatching(true)}>
                    Select all {pg.total.toLocaleString()} matching these filters
                  </Button>
                )}
                {allMatching && <span className="text-muted-foreground">(every question matching the current filters, on all pages)</span>}
                <div className="flex-1" />
                {!allMatching && (
                  <Button data-testid="bulk-ai-tag-btn" size="sm" variant="outline" className="rounded-full" disabled={tagging} onClick={aiTagSelected}>
                    <Sparkles className="h-4 w-4 mr-1.5" /> AI-tag selected
                  </Button>
                )}
                {!allMatching && (
                  <Button data-testid="bulk-delete-btn" size="sm" variant="destructive" className="rounded-full" onClick={() => setConfirmBulk(true)}>
                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete selected
                  </Button>
                )}
                <Button data-testid="bulk-clear-btn" size="sm" variant="ghost" className="rounded-full" onClick={() => { setSel(new Set()); setAllMatching(false); }}>Clear</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={bulkEdit.subject} onValueChange={(v) => setBulkEdit({ ...bulkEdit, subject: v })}>
                  <SelectTrigger data-testid="bulk-subject" className="w-[140px] h-9"><SelectValue placeholder="Set subject" /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={bulkEdit.student_class} onValueChange={(v) => setBulkEdit({ ...bulkEdit, student_class: v })}>
                  <SelectTrigger data-testid="bulk-class" className="w-[120px] h-9"><SelectValue placeholder="Set class" /></SelectTrigger>
                  <SelectContent>
                    {["11", "12", "Dropper"].map((c) => <SelectItem key={c} value={c}>{classLabel(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input data-testid="bulk-chapter" list="bank-chapter-list" className="w-[220px] h-9" placeholder="Set chapter"
                  value={bulkEdit.chapter} onChange={(e) => setBulkEdit({ ...bulkEdit, chapter: e.target.value })} />
                <datalist id="bank-chapter-list">{chapterSuggestions.map((c) => <option key={c} value={c} />)}</datalist>
                <Input data-testid="bulk-topic" className="w-[160px] h-9" placeholder="Set topic" value={bulkEdit.topic}
                  onChange={(e) => setBulkEdit({ ...bulkEdit, topic: e.target.value })} />
                <Select value={bulkEdit.difficulty} onValueChange={(v) => setBulkEdit({ ...bulkEdit, difficulty: v })}>
                  <SelectTrigger data-testid="bulk-difficulty" className="w-[130px] h-9"><SelectValue placeholder="Set difficulty" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bulkEdit.status} onValueChange={(v) => setBulkEdit({ ...bulkEdit, status: v })}>
                  <SelectTrigger data-testid="bulk-status" className="w-[125px] h-9"><SelectValue placeholder="Set status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Input data-testid="bulk-tags" className="w-[150px] h-9" placeholder="Add tags (comma)" value={bulkEdit.tags} onChange={(e) => setBulkEdit({ ...bulkEdit, tags: e.target.value })} />
                <Button data-testid="bulk-apply-btn" size="sm" className="rounded-full" onClick={doBulkEdit}>
                  Apply to {selCount.toLocaleString()}
                </Button>
              </div>
            </Card>
          )}

          <NumberedPager page={pg.page} pages={pg.pages} total={pg.total} pageSize={pg.pageSize}
            onPage={go} onPageSize={(n) => { pg.setPageSize(n); setAllMatching(false); }} loading={pg.loading} />

          <Card className="en-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox data-testid="select-all-questions" checked={allOnPage} onCheckedChange={toggleAll} aria-label="Select all on this page" />
                  </TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Chapter / Topic</TableHead>
                  <TableHead>Level / Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Marks</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.loading && rows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
                {!pg.loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {pg.total === 0 && tax?.total ? "No questions match these filters." : "No questions yet. Try the Import Wizard."}
                  </TableCell></TableRow>
                )}
                {rows.map((r, i) => (
                  <TableRow key={r.id} data-testid={`qrow-${r.id}`} className={`${sel.has(r.id) || allMatching ? "bg-primary/5" : ""} ${pg.loading ? "opacity-60" : ""}`}>
                    <TableCell>
                      <Checkbox data-testid={`select-q-${r.id}`} checked={allMatching || sel.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label="Select question" />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">{((pg.page - 1) * pg.pageSize + i + 1).toLocaleString()}</TableCell>
                    <TableCell className="max-w-md min-w-[200px]">
                      <details data-testid={`question-preview-${r.id}`}>
                        <summary data-testid={`question-preview-toggle-${r.id}`} className="cursor-pointer font-medium">
                          <MathText>{(r.text || "").split('\n')[0]}</MathText>
                          {(r.image_url || (r.text || "").includes('| ---')) && <span className="ml-2 text-xs text-primary">{r.image_url ? "Image" : "Table"}</span>}
                        </summary>
                        <div className="mt-4 space-y-3">
                          {r.content_origin === "ai_adapted" && <Badge data-testid={`question-origin-${r.id}`} variant="outline">AI-adapted practice</Badge>}
                          <QuestionContent question={r} testId={`bank-question-${r.id}`} />
                          {r.options?.map((o, j) => <div key={j} data-testid={`bank-option-${r.id}-${j}`}><b>{String.fromCharCode(65 + j)}.</b> <MathText>{o}</MathText></div>)}
                          <div data-testid={`bank-answer-${r.id}`} className="text-sm text-emerald-700">Answer: {(r.correct || []).join(', ') || "—"}</div>
                          <MathText>{r.explanation}</MathText>
                          <QuestionImage src={r.explanation_image_url} testId={`bank-solution-${r.id}`} alt="Source solution illustration" />
                        </div>
                      </details>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="rounded-full whitespace-nowrap">{r.subject}</Badge></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{tagCell(r.student_class, classLabel)}</TableCell>
                    <TableCell className="text-sm min-w-[160px] max-w-[240px]">
                      <div>{tagCell(r.chapter)}</div>
                      <div className="text-xs text-muted-foreground">{r.topic ? r.topic : <span className="text-amber-600 italic">topic not set</span>}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-full border ${DIFF_COLOR[r.difficulty] || ""}`} variant="outline">{r.difficulty}</Badge>
                      <div className="mt-1 text-[11px] text-muted-foreground whitespace-nowrap">{(r.type || "").replace("_", " ")}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={`rounded-full border ${STATUS_STYLE[r.status] || ""}`}>{r.status || "approved"}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{r.marks}</TableCell>
                    <TableCell className="text-right">
                      <Button data-testid={`delete-q-${r.id}`} size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {pg.total > pg.pageSize && (
            <NumberedPager testId="bank-pager-bottom" page={pg.page} pages={pg.pages} total={pg.total} pageSize={pg.pageSize}
              onPage={go} loading={pg.loading} />
          )}
        </div>
      </div>

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
