// Question palette with DigiALM/NTA-exact status shapes + legend.
// status values: "not-visited" | "not-answered" | "answered" | "marked" | "answered-marked"

// Clip-path shapes that match the official NTA interface:
//  - answered       : green pentagon pointing DOWN
//  - not-answered   : red   pentagon pointing UP
//  - marked / a-m   : purple circle (a-m carries a small green tick)
//  - not-visited    : grey rounded square
const SHAPE = {
  answered: "polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)",
  "not-answered": "polygon(50% 0, 100% 38%, 100% 100%, 0 100%, 0 38%)",
};

function cellStyle(status) {
  if (status === "answered" || status === "not-answered") return { clipPath: SHAPE[status] };
  return {};
}

function cellClass(status, active) {
  const base = "relative h-10 w-10 grid place-items-center text-sm font-bold transition-transform duration-150 hover:scale-110";
  const ring = active ? " ring-2 ring-offset-1 ring-[#0b3d6b] z-10" : "";
  switch (status) {
    case "answered":
      return base + ring + " bg-[#19a463] text-white";
    case "not-answered":
      return base + ring + " bg-[#e2452f] text-white";
    case "marked":
    case "answered-marked":
      return base + ring + " bg-[#6a3fb5] text-white rounded-full";
    default: // not-visited
      return base + ring + " bg-white text-slate-700 border border-slate-400 rounded";
  }
}

export function PaletteCell({ number, status, active, onClick, testid }) {
  return (
    <button type="button" data-testid={testid} onClick={onClick}
      style={cellStyle(status)} className={cellClass(status, active)}>
      <span className={status === "answered" ? "-translate-y-0.5" : status === "not-answered" ? "translate-y-0.5" : ""}>{number}</span>
      {status === "answered-marked" && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#19a463] border-2 border-white grid place-items-center">
          <svg viewBox="0 0 24 24" className="h-2 w-2 text-white" fill="none" stroke="currentColor" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>
        </span>
      )}
    </button>
  );
}

// Small shaped swatch used in the legend (mirrors the exact cell shapes).
function Swatch({ status }) {
  if (status === "marked" || status === "answered-marked") {
    return (
      <span className="relative inline-block h-5 w-5 rounded-full bg-[#6a3fb5] shrink-0">
        {status === "answered-marked" && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#19a463] border-2 border-white" />
        )}
      </span>
    );
  }
  if (status === "not-visited") return <span className="inline-block h-5 w-5 rounded bg-white border border-slate-400 shrink-0" />;
  return (
    <span className="inline-block h-5 w-5 shrink-0"
      style={{ clipPath: SHAPE[status], background: status === "answered" ? "#19a463" : "#e2452f" }} />
  );
}

export function PaletteLegend({ counts, compact = false }) {
  const items = [
    { key: "answered", label: "Answered" },
    { key: "not-answered", label: "Not Answered" },
    { key: "not-visited", label: "Not Visited" },
    { key: "marked", label: "Marked for Review" },
    { key: "answered-marked", label: "Answered & Marked for Review (will be considered for evaluation)" },
  ];
  return (
    <div className={`grid ${compact ? "grid-cols-2 gap-x-2 gap-y-1.5" : "grid-cols-1 gap-2"} text-xs text-slate-700`}>
      {items.map((it) => (
        <div key={it.key} className={`flex items-center gap-2 ${compact && it.key === "answered-marked" ? "col-span-2" : ""}`} data-testid={`legend-${it.key}`}>
          <span className="relative grid place-items-center h-6 w-7 shrink-0">
            <Swatch status={it.key} />
            {counts && (
              <span className={`absolute inset-0 grid place-items-center font-bold ${it.key === "not-visited" ? "text-slate-700" : "text-white"} ${it.key === "not-answered" ? "translate-y-0.5" : it.key === "answered" ? "-translate-y-0.5" : ""}`} style={{ fontSize: "10px" }}>
                {counts[it.key] ?? 0}
              </span>
            )}
          </span>
          <span className="leading-tight">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
