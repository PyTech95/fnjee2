import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { toast } from "sonner";

// Same order as backend/question_sheet.py STANDARD_COLUMNS (the "Download sample Excel" file).
const COLUMNS = ["S.No", "Subject", "Class", "Exam", "Chapter", "Topic", "Question Type", "Difficulty", "Question",
  "Option A", "Option B", "Option C", "Option D", "Option E", "Correct Answer", "Solution", "Question Image",
  "Solution Image", "Marks", "Negative Marks", "Year", "Source", "Tags", "Language", "Status"];

export const AI_EXCEL_PROMPT = `Convert the question paper I attach into the FNJEE question upload format.

Give me ONE downloadable Excel file (.xlsx). If you cannot create files, give a CSV inside one code block instead.
Use exactly these columns, in this order, with this header row:
${COLUMNS.join(" | ")}

Rules
1. One question per row. Copy every question and its options word-for-word — do not skip, merge or shorten any question.
2. Subject: Physics, Chemistry, Mathematics or Biology. Class: 11, 12 or Dropper. Exam: NEET, JEE Main, JEE Advanced, Board or Olympiad.
3. Chapter: the NCERT chapter name (for example "Laws of Motion", "Chemical Bonding and Molecular Structure", "Human Health and Disease"). Topic: the sub-topic inside that chapter.
4. Question Type: MCQ Single, MCQ Multiple, Integer, True/False, Assertion-Reason, Match or Subjective.
5. Write every formula in LaTeX between $ signs, e.g. $v = u + at$, $H_2SO_4$, $\\frac{1}{2}mv^2$.
6. Correct Answer: A, B, C or D (multiple correct: A,C). Integer type: the number. Use the answer key if the paper has one; otherwise solve the question.
7. Solution: a short step-by-step explanation (2–5 lines).
8. Difficulty: Easy, Medium or Hard. Marks 4 and Negative Marks 1 unless the paper says otherwise. Language: English or Hindi. Status: Approved.
9. If a question needs a diagram/figure, write DIAGRAM in the Question Image cell and set its Status to Review (it stays hidden from students until the picture is attached).
10. Leave a cell empty when you don't know it — never invent a PYQ year or source.

The paper is attached (or pasted below):`;

/** Admin import: a copy-ready prompt so any operator can turn a PDF/Word paper into the standard Excel with ChatGPT / Claude. */
export default function AiExcelPrompt() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(AI_EXCEL_PROMPT);
      setCopied(true); toast.success("Prompt copied — paste it in ChatGPT or Claude with your paper");
      setTimeout(() => setCopied(false), 2500);
    } catch { toast.error("Could not copy — select the text and copy it"); }
  };
  return (
    <div data-testid="ai-excel-prompt" className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 text-left">
        <Bot className="h-7 w-7 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Make the Excel with ChatGPT / Claude</div>
          <div className="text-xs text-muted-foreground mt-0.5">For operators: turn any PDF / Word paper into the standard format in 3 steps.</div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Copy the prompt below and open ChatGPT or Claude.</li>
            <li>Paste the prompt and attach the question paper (PDF / Word / photos). For big papers send 25–50 questions at a time.</li>
            <li>Download the Excel it gives you, check a few rows, then upload it here with <b>Upload file</b>. Questions with a diagram: add the picture in the Question Bank after upload.</li>
          </ol>
          <pre className="max-h-56 overflow-auto en-scroll whitespace-pre-wrap rounded-xl border bg-background p-3 text-xs leading-relaxed">{AI_EXCEL_PROMPT}</pre>
          <Button type="button" data-testid="copy-ai-prompt" onClick={copy} className="rounded-full">
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}{copied ? "Copied" : "Copy prompt"}
          </Button>
        </div>
      )}
    </div>
  );
}
