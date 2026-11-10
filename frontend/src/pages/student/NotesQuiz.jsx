import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notesQuizApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wand2, Upload, FileText, Loader2, PlayCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Mathematics"];

export default function NotesQuiz() {
  const nav = useNavigate();
  const [tab, setTab] = useState("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [subject, setSubject] = useState("Physics");
  const [count, setCount] = useState(10);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]);

  const loadMine = () => notesQuizApi.myQuizzes().then(setMine).catch(() => {});
  useEffect(() => { loadMine(); }, []);

  const generate = async () => {
    if (tab === "paste" && text.trim().length < 40) { toast.error("Paste at least a few lines of notes"); return; }
    if (tab === "upload" && !file) { toast.error("Choose a PDF, DOCX or TXT file"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      if (tab === "paste") fd.append("raw_text", text.trim());
      else fd.append("file", file);
      fd.append("subject_default", subject);
      fd.append("num_questions", String(count));
      if (title.trim()) fd.append("title", title.trim());
      const res = await notesQuizApi.fromDocument(fd);
      toast.success(`Quiz ready: ${res.count} questions!`);
      nav(`/student/cbt/${res.test_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not build a quiz from this material.");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="notes-quiz-page" className="space-y-6 max-w-4xl">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
          <Wand2 className="h-3.5 w-3.5" /> Notes → Quiz
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">Turn your notes into a practice quiz</h1>
        <p className="text-muted-foreground mt-1">Upload a chapter PDF or paste your notes — our AI writes fresh MCQs you can attempt instantly.</p>
      </div>

      <Card className="en-card p-6 space-y-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList data-testid="notes-quiz-tabs">
            <TabsTrigger value="paste" data-testid="tab-paste"><FileText className="h-4 w-4 mr-1.5" /> Paste text</TabsTrigger>
            <TabsTrigger value="upload" data-testid="tab-upload"><Upload className="h-4 w-4 mr-1.5" /> Upload file</TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="mt-4">
            <Textarea data-testid="notes-text" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Paste your chapter notes, summary, or textbook section here…"
              className="min-h-[160px] resize-y" />
          </TabsContent>
          <TabsContent value="upload" className="mt-4">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-8 cursor-pointer hover:border-primary/40 transition-colors" data-testid="notes-dropzone">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <div className="text-sm font-medium">{file ? file.name : "Click to choose a PDF, DOCX or TXT"}</div>
              <div className="text-xs text-muted-foreground mt-1">Text-based files work best (not scanned images)</div>
              <input data-testid="notes-file" type="file" accept=".pdf,.docx,.txt" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </TabsContent>
        </Tabs>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <div className="text-sm font-medium mb-2">Subject</div>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger data-testid="notes-subject"><SelectValue /></SelectTrigger>
              <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Questions</div>
            <Input data-testid="notes-count" type="number" min={3} max={25} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Title (optional)</div>
            <Input data-testid="notes-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thermodynamics revision" />
          </div>
        </div>

        <Button data-testid="notes-generate" onClick={generate} disabled={busy} className="rounded-full">
          {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating quiz…</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate quiz</>}
        </Button>
      </Card>

      {mine.length > 0 && (
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-3">Your generated quizzes</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {mine.map((q) => (
              <div key={q.id} data-testid={`my-quiz-${q.id}`} className="en-card p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{q.title}</div>
                  <div className="text-xs text-muted-foreground">{q.count} questions · {(q.subjects || []).join(", ")}</div>
                </div>
                <Button size="sm" variant="outline" className="rounded-full shrink-0" onClick={() => nav(`/student/cbt/${q.id}`)}>
                  <PlayCircle className="h-4 w-4 mr-1.5" /> Attempt
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
