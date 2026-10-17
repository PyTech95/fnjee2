import { useId, useState } from "react";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import MathText from "./MathText";

// Pictures saved by imports live at /api/media/<hash>.png on the backend; when the frontend is
// served from another origin (preview / app wrapper) prefix the backend URL.
const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
export const resolveMediaUrl = (url) => (typeof url === "string" && url.startsWith("/api/media/") ? `${BACKEND}${url}` : url);
export const safeImageUrl = (url) => typeof url === "string" && /^(https?:\/\/|data:image\/(png|jpe?g|webp|gif);base64,|\/(?!\/))/.test(url) ? resolveMediaUrl(url) : "";

export const QuestionImage = ({ src, alt = "Question diagram", testId }) => {
  const uid = useId().replace(/:/g, "");
  const id = testId || `question-image-${uid}`;
  const [open, setOpen] = useState(false);
  const [failedSrc, setFailedSrc] = useState("");
  const image = safeImageUrl(src);
  if (!image) return null;
  if (failedSrc === src) return <p role="alert" data-testid={`${id}-error`} className="text-sm text-destructive">Question image could not be loaded.</p>;
  return <>
    <button type="button" data-testid={`${id}-expand`} aria-label="Enlarge question image" title="Enlarge image"
      onClick={() => setOpen(true)} className="relative block max-w-full mt-4 border border-border rounded-lg bg-white p-2 hover:border-primary transition-colors">
      <img data-testid={id} src={image} alt={alt} className="question-image max-h-[26rem]" loading="lazy" onError={() => setFailedSrc(src)} />
      <span className="absolute right-2 bottom-2 bg-white/95 rounded p-1 text-black"><ZoomIn size={18} /></span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-testid={`${id}-dialog`} className="w-[calc(100%-2rem)] max-w-5xl max-h-[90dvh] overflow-auto">
        <DialogTitle data-testid={`${id}-title`}>Question image</DialogTitle>
        <DialogDescription className="sr-only">{alt}</DialogDescription>
        <img data-testid={`${id}-full`} src={image} alt={alt} className="question-image mx-auto max-h-[72dvh] bg-white" />
      </DialogContent>
    </Dialog>
  </>;
};

export const QuestionContent = ({ question, testId, className = "" }) => <div className={`min-w-0 ${className}`}>
  <MathText testId={testId ? `${testId}-text` : undefined}>{question?.text}</MathText>
  <QuestionImage src={question?.image_url} alt={question?.image_alt || "Question diagram"} testId={testId ? `${testId}-image` : undefined} />
</div>;