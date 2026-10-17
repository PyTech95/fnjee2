import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crop, RotateCcw } from "lucide-react";

/**
 * Drag a box on the screenshot to keep only one question. Works with mouse and touch.
 * onDone(file) gets a new PNG File (or the original file for "Use whole image").
 */
export default function ImageCropDialog({ open, file, url, onCancel, onDone }) {
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
    if (!img || !rect || rect.w < 8 || rect.h < 8) return onDone(file);
    const sx = img.naturalWidth / img.clientWidth;
    const sy = img.naturalHeight / img.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.w * sx);
    canvas.height = Math.round(rect.h * sy);
    canvas.getContext("2d").drawImage(img, rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    if (!blob) return onDone(file);
    const name = (file?.name || "screenshot.png").replace(/\.[a-z0-9]+$/i, "") + "-crop.png";
    onDone(new File([blob], name, { type: "image/png" }));
  };

  const ok = rect && rect.w >= 8 && rect.h >= 8;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent data-testid="crop-dialog" className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crop className="h-5 w-5" /> Crop the question</DialogTitle>
          <DialogDescription>Drag a box around the one question you want (include its options and figure).</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-auto rounded-lg border bg-muted/30 flex justify-center">
          <div ref={boxRef} className="relative inline-block select-none touch-none cursor-crosshair"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="crop-area">
            {url && <img ref={imgRef} src={url} alt="Screenshot to crop" draggable={false} className="block max-w-full max-h-[62vh]" />}
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
          <Button type="button" variant="outline" className="rounded-full" data-testid="crop-skip" onClick={() => onDone(file)}>Use whole image</Button>
          <Button type="button" className="rounded-full" data-testid="crop-apply" disabled={!ok} onClick={apply}>
            <Crop className="h-4 w-4 mr-1.5" /> Crop &amp; use
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
