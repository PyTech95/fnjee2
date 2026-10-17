import { useId } from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

// Inline pictures inside any question text / option / solution: ![alt](https://… or data:image/…)
// Used for diagram-only options (e.g. organic structures) imported from Word/Excel.
const IMG_TOKEN = /(!\[[^\]]*\]\((?:https?:\/\/|\/api\/media\/|data:image\/(?:png|jpe?g|webp|gif);base64,)[^)\s]+\))/g;
const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const mediaSrc = (src) => (src.startsWith("/api/media/") ? `${BACKEND}${src}` : src);
const IMG_PARTS = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

const renderMath = (text, block, keyPrefix) => {
  const normalised = text.replace(/\\\[(.+?)\\\]/gs, (_, m) => `$$${m}$$`).replace(/\\\((.+?)\\\)/gs, (_, m) => `$${m}$`);
  const parts = normalised.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  return parts.map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("$$") && p.endsWith("$$")) return <BlockMath key={key} math={p.slice(2, -2)} />;
    if (p.startsWith("$") && p.endsWith("$") && p.length > 1) return block ? <BlockMath key={key} math={p.slice(1, -1)} /> : <InlineMath key={key} math={p.slice(1, -1)} />;
    return <span key={key}>{p}</span>;
  });
};

export const InlineFormula = ({ children, className = "", block = false, testId }) => {
  const uid = useId().replace(/:/g, "");
  const text = children == null ? "" : String(children);
  if (!text) return null;
  const chunks = text.includes("![") ? text.split(IMG_TOKEN) : [text];
  return <span data-testid={testId || `formula-${uid}`} className={`whitespace-pre-wrap break-words ${className}`}>
    {chunks.map((c, ci) => {
      const m = c.match(IMG_PARTS);
      if (m) {
        // ![](…) with no alt = small equation/symbol picture from Word → sized like text;
        // ![option](…) / ![figure](…) = real diagram → boxed, larger
        const isEquation = !m[1];
        return <img key={`img-${ci}`} src={mediaSrc(m[2])} alt={m[1] || "formula"} loading="lazy"
          className={isEquation
            ? "inline-block align-middle h-auto max-h-[2.4em] w-auto max-w-full mx-0.5 dark:bg-white dark:rounded"
            : "inline-block align-middle max-h-40 max-w-full bg-white rounded border border-border p-1 my-1"} />;
      }
      return renderMath(c, block, `t${ci}`);
    })}
  </span>;
};
