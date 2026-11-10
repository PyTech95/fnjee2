import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crop, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { safeImageUrl } from "@/components/QuestionContent";

/**
 * Drag a box on the picture to keep only that part. Works with mouse and touch.
 * onDone(file) gets the cropped File, or the original `file` for "Use whole image"
 * (null when only a url was given — i.e. keep the picture as it is).
 */
export default function ImageCropDialog({ open, file, url, onCancel, onDone,
  title = "Crop the question", description = "Drag a box around the one question you want (include its options and figure)." }) {
  const imgRef = useRef(null);
  const boxRef = useRef(null);
  const [rect, setRect] = useState(null);          // {x, y, w, h} in displayed px
  const [drag, setDrag] = useState(null);          // start point while dragging

  useEffect(() => { if (open) { setRect(null); setDrag(null); } }, [open, url]);

  const point = (e) => {
    const b = boxRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - b.left, 0), b.width);
    const y = Math.min(Math.max(e.clientY - b.top, 0), b.height);
    return { x, y };
  };
  const down = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = point(e);
    setDrag(p);
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const move = (e) => {
    if (!drag) return;
    const p = point(e);
    setRect({ x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) });
  };
  const up = () => setDrag(null);

  const apply = async () => {
    const img = imgRef.current;
    if (!img || !rect || rect.w < 8 || rect.h < 8) return onDone(file || null);
    const sx = img.naturalWidth / img.clientWidth;
    const sy = img.naturalHeight / img.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.w * sx);
    canvas.height = Math.round(rect.h * sy);
    const type = /jpe?g/i.test(file?.type || url || "") ? "image/jpeg" : "image/png";
    let blob = null;
    try {
      canvas.getContext("2d").drawImage(img, rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy, 0, 0, canvas.width, canvas.height);
      blob = await new Promise((res) => canvas.toBlob(res, type, 0.92));
    } catch {
      toast.error("This picture can't be cropped here — download it and upload it again.");
      return;
    }
    if (!blob) return onDone(file || null);
    const ext = type === "image/jpeg" ? "jpg" : "png";
    const name = (file?.name || "image").replace(/\.[a-z0-9]+$/i, "") + `-crop.${ext}`;
    onDone(new File([blob], name, { type }));
  };

  const src = url && (url.startsWith("blob:") ? url : safeImageUrl(url));
  const remote = /^https?:/i.test(src || "");
  const ok = rect && rect.w >= 8 && rect.h >= 8;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent data-testid="crop-dialog" className="max-w-4xl w-[calc(100%-1.5rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crop className="h-5 w-5" /> {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-auto rounded-lg border bg-muted/30 flex justify-center">
          <div ref={boxRef} className="relative inline-block select-none touch-none cursor-crosshair"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="crop-area">
            {src && <img ref={imgRef} src={src} alt="Picture to crop" draggable={false} {...(remote ? { crossOrigin: "anonymous" } : {})}
              className="block max-w-full max-h-[62vh]" />}
            {rect && (
              <>
                <div className="absolute inset-0 bg-black/40 pointer-events-none"
                  style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${rect.x}px ${rect.y}px,${rect.x}px ${rect.y + rect.h}px,${rect.x + rect.w}px ${rect.y + rect.h}px,${rect.x + rect.w}px ${rect.y}px,${rect.x}px ${rect.y}px)` }} />
                <div className="absolute border-2 border-primary pointer-events-none"
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {rect && <Button type="button" variant="ghost" className="rounded-full" onClick={() => setRect(null)}><RotateCcw className="h-4 w-4 mr-1.5" /> Reset</Button>}
          <Button type="button" variant="outline" className="rounded-full" data-testid="crop-skip" onClick={() => onDone(file || null)}>Use whole image</Button>
          <Button type="button" className="rounded-full" data-testid="crop-apply" disabled={!ok} onClick={apply}>
            <Crop className="h-4 w-4 mr-1.5" /> Crop &amp; use
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * const [cropImage, cropDialog] = useImageCrop();
 * const f = await cropImage(fileOrUrl);   // File (cropped / whole) — or null if cancelled / kept as is
 * Render {cropDialog} once in the component.
 */
export function useImageCrop(opts = {}) {
  const [state, setState] = useState(null);   // {file, url, own, resolve}
  const cropImage = (src) => new Promise((resolve) => {
    if (src instanceof File) setState({ file: src, url: URL.createObjectURL(src), own: true, resolve });
    else setState({ file: null, url: src, own: false, resolve });
  });
  const close = (result) => {
    if (!state) return;
    state.resolve(result || null);
    if (state.own) URL.revokeObjectURL(state.url);
    setState(null);
  };
  const dialog = (
    <ImageCropDialog open={!!state} file={state?.file} url={state?.url}
      title={opts.title || "Crop the picture"}
      description={opts.description || "Drag a box around the part to keep, then Crop & use. Or use the whole image."}
      onCancel={() => close(null)} onDone={(f) => close(f)} />
  );
  return [cropImage, dialog];
}

export const fileToDataUrl = (f) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(f);
});
