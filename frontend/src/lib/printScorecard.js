// Opens a clean printable scorecard in a new window (Print -> Save as PDF).
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export function printScorecard({ test, attempt, qmap = {}, student = "Student", institution = "FNJEE.com", brandColor = "#0A66C2", logoText = "F" }) {
  const score = attempt.score ?? 0;
  const total = attempt.total_marks ?? 0;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const correct = attempt.correct ?? 0;
  const wrong = attempt.wrong ?? 0;
  const unatt = attempt.unattempted ?? 0;
  const when = attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "";

  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  const optText = (o) => (o && typeof o === "object" ? (o.text ?? o.label ?? "") : o);
  // "A" / "a" / "1" -> "A · <option text>" so the student sees which choice it was (meeting 9 Nov).
  const fmt = (vals, q) => {
    const list = (vals || []).map((v) => String(v).trim()).filter(Boolean);
    if (!list.length) return "—";
    return list.map((v) => {
      const up = v.toUpperCase();
      const idx = LETTERS.indexOf(up);
      const opts = q.options || [];
      if (idx >= 0 && opts[idx] != null) {
        const t = String(optText(opts[idx]) || "").replace(/\s+/g, " ").trim();
        return `<b>${up}</b>${t ? ` <span class="opt">${esc(t.length > 38 ? t.slice(0, 37) + "…" : t)}</span>` : ""}`;
      }
      return `<b>${esc(idx >= 0 ? up : v)}</b>`;
    }).join("<br>");
  };

  const rows = (attempt.detailed || []).map((d, i) => {
    const q = qmap[d.question_id] || {};
    const res = d.result || "";
    const color = res === "correct" ? "#16a34a" : res === "wrong" ? "#dc2626" : "#64748b";
    const ua = res === "unattempted" ? "Not answered" : fmt(d.user_answer, q);
    const ca = fmt(d.correct, q);
    const marks = d.marks_awarded ?? 0;
    return `<tr>
      <td class="c">${i + 1}</td>
      <td>${esc(String(q.text || "").slice(0, 180))}</td>
      <td class="a">${ua}</td>
      <td class="a">${ca}</td>
      <td class="c" style="text-transform:capitalize;color:${color};font-weight:600">${esc(res)}</td>
      <td class="c" style="font-weight:700;color:${color}">${marks > 0 ? "+" : ""}${marks}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Scorecard — ${esc(test.title)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;max-width:820px;margin:0 auto;padding:28px 26px;color:#0f172a}
    .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${brandColor};padding-bottom:14px}
    .hd h1{margin:0;font-size:22px;color:${brandColor};letter-spacing:.3px}
    .hd .sub{font-size:12px;color:#64748b;margin-top:2px}
    .logo{width:40px;height:40px;border-radius:11px;background:${brandColor};color:#fff;display:grid;place-items:center;font-weight:800;font-size:21px}
    .meta{display:flex;justify-content:space-between;font-size:13px;color:#475569;margin:14px 0 20px}
    .score{display:flex;align-items:center;gap:18px;background:${brandColor};color:#fff;border-radius:14px;padding:20px 24px}
    .score .big{font-size:44px;font-weight:800;line-height:1}
    .score .of{font-size:18px;opacity:.8}
    .score .pct{margin-left:auto;text-align:right}
    .stats{display:flex;gap:12px;margin:18px 0 8px}
    .stat{flex:1;text-align:center;border-radius:12px;padding:12px}
    .stat .n{font-size:22px;font-weight:800}
    .stat .l{font-size:12px;color:#64748b}
    h2{font-size:15px;margin:24px 0 8px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f1f5f9;text-align:left;padding:8px;color:#475569;font-size:12px}
    td{padding:8px;border-bottom:1px solid #eee;vertical-align:top}
    td.c{text-align:center;white-space:nowrap}
    td.a{min-width:110px}
    .opt{color:#64748b;font-size:12px}
    tr{page-break-inside:avoid}
    .foot{margin-top:22px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:11px;color:#94a3b8;text-align:center}
    @media print{button{display:none}}
  </style></head><body>
  <div class="hd"><div style="display:flex;align-items:center;gap:12px">
    <div class="logo">${esc(logoText)}</div>
    <div><h1>${esc(institution)}</h1><div class="sub">Official Scorecard</div></div></div>
    <div style="text-align:right;font-size:13px"><b>${esc(student)}</b><br><span style="color:#64748b">${esc(when)}</span></div></div>
  <div class="meta"><span><b>Test:</b> ${esc(test.title)}</span><span><b>Predicted %:</b> ${pct}%</span></div>
  <div class="score"><div><div class="big">${score}<span class="of"> / ${total}</span></div></div>
    <div class="pct"><div style="font-size:26px;font-weight:800">${pct}%</div><div style="font-size:12px;opacity:.85">Overall</div></div></div>
  <div class="stats">
    <div class="stat" style="background:#f0fdf4"><div class="n" style="color:#16a34a">${correct}</div><div class="l">Correct</div></div>
    <div class="stat" style="background:#fef2f2"><div class="n" style="color:#dc2626">${wrong}</div><div class="l">Wrong</div></div>
    <div class="stat" style="background:#f8fafc"><div class="n" style="color:#64748b">${unatt}</div><div class="l">Skipped</div></div>
  </div>
  <h2>Question breakdown</h2>
  <table><thead><tr><th>#</th><th>Question</th><th>Your answer</th><th>Correct</th><th>Result</th><th>Marks</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="foot">Generated by ${esc(institution)} — serious CBT practice.</div>
  <div style="text-align:center;margin-top:16px"><button onclick="window.print()">Print / Save as PDF</button></div>
  </body></html>`;

  const inApp = /FNJEE-App/i.test(navigator.userAgent || "");
  const w = inApp ? null : window.open("", "_blank");
  if (w) { w.document.open(); w.document.write(html); w.document.close(); return; }
  // Android/iOS app (or pop-ups blocked): show it full-screen inside the page.
  const wrap = document.createElement("div");
  wrap.setAttribute("data-testid", "scorecard-overlay");
  wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#fff;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:8px;justify-content:flex-end;padding:10px 12px;border-bottom:1px solid #e2e8f0";
  const mk = (label, fn) => { const b = document.createElement("button"); b.textContent = label;
    b.style.cssText = "border:1px solid #cbd5e1;border-radius:999px;padding:8px 16px;font:600 14px sans-serif;background:#fff"; b.onclick = fn; return b; };
  const frame = document.createElement("iframe");
  frame.style.cssText = "flex:1;border:0;width:100%";
  bar.appendChild(mk("Print / Save PDF", () => { try { frame.contentWindow.print(); } catch { /* not supported */ } }));
  bar.appendChild(mk("Close", () => wrap.remove()));
  wrap.appendChild(bar); wrap.appendChild(frame);
  document.body.appendChild(wrap);
  frame.srcdoc = html;
}
