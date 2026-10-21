import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { testsApi } from "@/lib/api";
import NumberedPager from "@/components/bank/NumberedPager";
import BankFilters from "@/components/bank/BankFilters";
import { EMPTY_FILTERS, useQuestionPage, useTaxonomy, classLabel } from "@/lib/bank";
import { cbtApi } from "@/lib/cbtApi";
import { BilingualQuestionModal } from "@/components/admin/BilingualQuestionModal";
import { CbtQuestionView, toCbtQuestionShape } from "@/components/exam/CbtQuestionView";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Eye, ArrowUp, ArrowDown, Save, Layers, FileQuestion } from "lucide-react";

const ALL_SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"];

const emptySubject = (name) => ({ name, sections: [{ name: "Section 1", question_ids: [] }] });

export default function CbtExamBuilder() {
  const { testId } = useParams();           // present => edit mode
  const nav = useNavigate();
  const [meta, setMeta] = useState({
    title: "", duration_minutes: 60, negative_marking: true,
    instructions_en: "", instructions_hi: "",
  });
  const [subjects, setSubjects] = useState([emptySubject("Physics")]);
  // bank panel: one server page at a time; `known` remembers every question seen (for the section lists)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const { tax } = useTaxonomy();
  const pg = useQuestionPage(filters, 20);
  const [known, setKnown] = useState({});
  const remember = (qs) => setKnown((k) => { const n = { ...k }; (qs || []).forEach((q) => { n[q.id] = q; }); return n; });
  const [target, setTarget] = useState({ s: 0, sec: 0 });
  const [showNewQ, setShowNewQ] = useState(false);
  const [preview, setPreview] = useState(null); // raw question doc
  const [previewLang, setPreviewLang] = useState("en");
  const [busy, setBusy] = useState(false);

  const qById = known;
  useEffect(() => { remember(pg.rows); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pg.rows]);
  useEffect(() => { if (pg.error) toast.error("Could not load question bank"); }, [pg.error]);

  // ---- load existing exam for edit ----
  useEffect(() => {
    if (!testId) return;
    (async () => {
      try {
        const t = await testsApi.get(testId, true);
        const qs = t.questions || [];
        remember(qs);
        setMeta({
          title: t.title || "", duration_minutes: t.duration_minutes || 60,
          negative_marking: t.negative_marking !== false,
          instructions_en: t.instructions_en || t.description || "",
          instructions_hi: t.instructions_hi || "",
        });
        const subjMap = new Map();
        const pushQ = (secName, qid) => {
          const q = qs.find((x) => x.id === qid);
          const subj = (q && q.subject) || "General";
          if (!subjMap.has(subj)) subjMap.set(subj, { name: subj, sections: [] });
          const s = subjMap.get(subj);
          let sec = s.sections.find((x) => x.name === secName);
          if (!sec) { sec = { name: secName, question_ids: [] }; s.sections.push(sec); }
          sec.question_ids.push(qid);
        };
        if (t.sections && t.sections.length) {
          t.sections.forEach((sec) => (sec.question_ids || []).forEach((qid) => pushQ(sec.name || "Section 1", qid)));
          // include any question not referenced by a section
          (t.question_ids || []).forEach((qid) => {
            const inSec = (t.sections || []).some((sec) => (sec.question_ids || []).includes(qid));
            if (!inSec) pushQ("Section 1", qid);
          });
        } else {
          (t.question_ids || []).forEach((qid) => pushQ("Section 1", qid));
        }
        const arr = Array.from(subjMap.values());
        if (arr.length) setSubjects(arr);
      } catch { toast.error("Could not load exam"); }
    })();
    // eslint-disable-next-line
  }, [testId]);

  const updMeta = (k, v) => setMeta((m) => ({ ...m, [k]: v }));
  const updSubjects = (fn) => setSubjects((prev) => fn(prev.map((s) => ({ ...s, sections: s.sections.map((x) => ({ ...x, question_ids: [...x.question_ids] })) }))));

  const addSubject = (name) => {
    if (subjects.some((s) => s.name === name)) return toast.error("Subject already added");
    updSubjects((p) => [...p, emptySubject(name)]);
  };
  const removeSubject = (si) => updSubjects((p) => p.filter((_, i) => i !== si));
  const addSection = (si) => updSubjects((p) => { p[si].sections.push({ name: `Section ${p[si].sections.length + 1}`, question_ids: [] }); return p; });
  const removeSection = (si, seci) => updSubjects((p) => { p[si].sections = p[si].sections.filter((_, i) => i !== seci); return p; });
  const renameSection = (si, seci, name) => updSubjects((p) => { p[si].sections[seci].name = name; return p; });
  const removeQ = (si, seci, qid) => updSubjects((p) => { p[si].sections[seci].question_ids = p[si].sections[seci].question_ids.filter((x) => x !== qid); return p; });
  const moveQ = (si, seci, idx, dir) => updSubjects((p) => {
    const arr = p[si].sections[seci].question_ids;
    const j = idx + dir; if (j < 0 || j >= arr.length) return p;
    [arr[idx], arr[j]] = [arr[j], arr[idx]]; return p;
  });

  const addQToTarget = (qid) => {
    if (!subjects.length || !subjects[target.s]) return toast.error("Add a subject/section first");
    updSubjects((p) => {
      const sec = p[target.s].sections[target.sec];
      if (!sec.question_ids.includes(qid)) sec.question_ids.push(qid);
      return p;
    });
  };

  const totalQuestions = subjects.reduce((a, s) => a + s.sections.reduce((b, sec) => b + sec.question_ids.length, 0), 0);
  const totalMarks = subjects.reduce((a, s) => a + s.sections.reduce((b, sec) => b + sec.question_ids.reduce((c, qid) => c + (qById[qid]?.marks || 4), 0), 0), 0);

  const filteredBank = pg.rows;

  const save = async () => {
    if (!meta.title.trim()) return toast.error("Exam title is required");
    if (totalQuestions === 0) return toast.error("Add at least one question to a section");
    setBusy(true);
    const sections = [];
    subjects.forEach((s) => s.sections.forEach((sec) => { if (sec.question_ids.length) sections.push({ name: sec.name, question_ids: sec.question_ids }); }));
    const question_ids = sections.flatMap((s) => s.question_ids);
    try {
      if (testId) {
        await cbtApi.adminUpdateExam(testId, {
          title: meta.title, duration_minutes: Number(meta.duration_minutes),
          negative_marking: meta.negative_marking, instructions_en: meta.instructions_en,
          instructions_hi: meta.instructions_hi, subjects: subjects.map((s) => s.name),
          sections, question_ids,
        });
        toast.success("Exam updated");
      } else {
        await testsApi.create({
          title: meta.title, exam_type: "full_mock", description: meta.instructions_en,
          subjects: subjects.map((s) => s.name), duration_minutes: Number(meta.duration_minutes),
          negative_marking: meta.negative_marking, instructions_en: meta.instructions_en,
          instructions_hi: meta.instructions_hi, sections, question_ids,
          shuffle_questions: false, published: false,
        });
        toast.success("Exam created as a draft — validate & publish it from CBT Exams");
      }
      nav("/admin/cbt-exams");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="cbt-builder-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">CBT</div>
          <h1 className="font-display font-bold text-3xl tracking-tight mt-1">{testId ? "Edit CBT exam" : "New CBT exam"}</h1>
        </div>
        <Button data-testid="cbt-save-exam" onClick={save} disabled={busy} className="rounded-full"><Save className="h-4 w-4 mr-2" />{busy ? "Saving…" : testId ? "Update exam" : "Create exam"}</Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* details */}
          <Card className="en-card p-6 space-y-4">
            <h3 className="font-display font-semibold text-lg">Exam details</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Title</Label><Input data-testid="cbt-title" value={meta.title} onChange={(e) => updMeta("title", e.target.value)} placeholder="NEET Full Mock #3" /></div>
              <div><Label>Duration (min)</Label><Input data-testid="cbt-duration" type="number" value={meta.duration_minutes} onChange={(e) => updMeta("duration_minutes", e.target.value)} /></div>
            </div>
            <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
              <Label>Negative marking</Label>
              <Switch checked={meta.negative_marking} onCheckedChange={(v) => updMeta("negative_marking", v)} data-testid="cbt-negative" />
            </div>
            <div><Label>Instructions (English)</Label><Textarea data-testid="cbt-instr-en" rows={2} value={meta.instructions_en} onChange={(e) => updMeta("instructions_en", e.target.value)} /></div>
            <div><Label>Instructions (Hindi)</Label><Textarea data-testid="cbt-instr-hi" rows={2} value={meta.instructions_hi} onChange={(e) => updMeta("instructions_hi", e.target.value)} placeholder="हिंदी निर्देश" /></div>
          </Card>

          {/* structure */}
          <Card className="en-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-lg flex items-center gap-2"><Layers className="h-4 w-4" /> Subjects &amp; Sections</h3>
              <div className="flex gap-1.5">
                {ALL_SUBJECTS.map((s) => (
                  <Button key={s} type="button" variant="outline" size="sm" className="rounded-full" data-testid={`cbt-add-subject-${s}`} onClick={() => addSubject(s)} disabled={subjects.some((x) => x.name === s)}>+ {s}</Button>
                ))}
              </div>
            </div>
            {subjects.map((subj, si) => (
              <div key={si} className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className="rounded-full bg-[#0b2e59]">{subj.name}</Badge>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => addSection(si)} data-testid={`cbt-add-section-${si}`}><Plus className="h-4 w-4 mr-1" />Section</Button>
                    {subjects.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeSubject(si)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                  </div>
                </div>
                {subj.sections.map((sec, seci) => {
                  const isTarget = target.s === si && target.sec === seci;
                  return (
                    <div key={seci} className={`rounded-lg border p-3 ${isTarget ? "border-primary bg-primary/5" : "border-slate-200"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Input value={sec.name} onChange={(e) => renameSection(si, seci, e.target.value)} className="h-8 max-w-[180px]" data-testid={`cbt-section-name-${si}-${seci}`} />
                        <span className="text-xs text-slate-500">{sec.question_ids.length} question(s)</span>
                        <div className="ml-auto flex gap-1">
                          <Button type="button" variant={isTarget ? "default" : "outline"} size="sm" onClick={() => setTarget({ s: si, sec: seci })} data-testid={`cbt-target-${si}-${seci}`}>
                            {isTarget ? "Drop target ✓" : "Set as target"}
                          </Button>
                          {subj.sections.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeSection(si, seci)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {sec.question_ids.map((qid, idx) => {
                          const qq = qById[qid];
                          return (
                            <div key={qid} className="flex items-center gap-2 bg-white rounded border border-slate-200 px-2.5 py-1.5 text-sm">
                              <span className="text-slate-400 font-mono text-xs w-6">{idx + 1}.</span>
                              <span className="flex-1 truncate">{qq ? qq.text : qid}</span>
                              <span className="text-xs text-slate-400 shrink-0">{qq ? `${qq.marks}mk` : ""}</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(qq)} data-testid={`cbt-preview-${qid}`}><Eye className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => moveQ(si, seci, idx, -1)} disabled={idx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => moveQ(si, seci, idx, 1)} disabled={idx === sec.question_ids.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeQ(si, seci, qid)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            </div>
                          );
                        })}
                        {sec.question_ids.length === 0 && <p className="text-xs text-slate-400 italic py-2">No questions yet — set as target and add from the bank.</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </Card>
        </div>

        {/* question bank */}
        <div className="space-y-4 lg:sticky lg:top-24 h-fit">
          <Card className="en-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-base flex items-center gap-2"><FileQuestion className="h-4 w-4" /> Question bank</h3>
              <Button type="button" size="sm" className="rounded-full" onClick={() => setShowNewQ(true)} data-testid="cbt-new-question"><Plus className="h-4 w-4 mr-1" />New</Button>
            </div>
            <div className="mb-3">
              <BankFilters compact filters={filters} setFilters={setFilters} tax={tax} show={["difficulty", "type"]} testId="cbt-bank" />
            </div>
            <div className="mb-2">
              <NumberedPager compact testId="cbt-bank-pager" page={pg.page} pages={pg.pages} total={pg.total} pageSize={pg.pageSize}
                onPage={pg.setPage} loading={pg.loading} />
            </div>
            <div className="text-xs text-slate-500 mb-2">Adding to: <b>{subjects[target.s]?.name} · {subjects[target.s]?.sections[target.sec]?.name}</b></div>
            <div className="max-h-[52vh] overflow-y-auto en-scroll space-y-1.5">
              {filteredBank.map((q) => (
                <div key={q.id} className="flex items-start gap-2 p-2 rounded border border-slate-200 hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs line-clamp-2">{q.text}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="secondary" className="rounded-full text-[10px]">{q.subject}</Badge>
                      {q.student_class && <Badge variant="outline" className="rounded-full text-[10px]">{classLabel(q.student_class)}</Badge>}
                      {q.chapter && <Badge variant="outline" className="rounded-full text-[10px] max-w-[150px] truncate">{q.chapter}</Badge>}
                      <Badge variant="outline" className="rounded-full text-[10px]">{q.type === "mcq_multi" ? "MSQ" : q.type === "integer" || q.type === "numerical" ? "NUM" : "SCM"}</Badge>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(q)} data-testid={`bank-preview-${q.id}`}><Eye className="h-4 w-4" /></Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addQToTarget(q.id)} data-testid={`bank-add-${q.id}`}><Plus className="h-4 w-4" /></Button>
                </div>
              ))}
              {!pg.loading && filteredBank.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No questions match.</p>}
            </div>
          </Card>
          <Card className="en-card p-5">
            <h3 className="font-display font-semibold text-base mb-2">Summary</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subjects</span><b>{subjects.length}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Questions</span><b>{totalQuestions}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Total marks</span><b>{totalMarks}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Duration</span><b>{meta.duration_minutes} min</b></div>
            </div>
          </Card>
        </div>
      </div>

      <BilingualQuestionModal
        open={showNewQ}
        onOpenChange={setShowNewQ}
        defaultSubject={subjects[target.s]?.name}
        onCreated={(created) => { remember([created]); addQToTarget(created.id); pg.reload(); }}
      />

      {/* live preview modal — SAME renderer as student exam */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question preview</DialogTitle>
            <DialogDescription>This uses the exact renderer candidates see in the CBT exam.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <div className="flex rounded overflow-hidden border border-slate-300 text-xs">
              <button type="button" onClick={() => setPreviewLang("en")} className={`px-2.5 py-1 ${previewLang === "en" ? "bg-[#0b2e59] text-white" : "bg-white"}`} data-testid="prev-en">EN</button>
              <button type="button" onClick={() => setPreviewLang("hi")} className={`px-2.5 py-1 ${previewLang === "hi" ? "bg-[#0b2e59] text-white" : "bg-white"}`} data-testid="prev-hi">हिं</button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
            <div className="bg-white rounded border border-slate-200 p-4" data-testid="cbt-preview-body">
              {preview && <CbtQuestionView question={toCbtQuestionShape(preview)} lang={previewLang} readOnly showMeta />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
