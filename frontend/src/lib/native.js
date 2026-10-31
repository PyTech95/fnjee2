// Helpers for the FNJEE Android / iOS app (Capacitor shell that loads this website).
// Outside the app every helper falls back to the normal browser behaviour.

export function isNativeApp() {
  try {
    if (typeof window === "undefined") return false;
    if (window.Capacitor?.isNativePlatform?.()) return true;
    return /FNJEE-App/i.test(navigator.userAgent || "");
  } catch { return false; }
}

export function nativePlatform() {
  try {
    const p = window.Capacitor?.getPlatform?.();
    if (p && p !== "web") return p;
  } catch { /* ignore */ }
  const ua = navigator.userAgent || "";
  if (!/FNJEE-App/i.test(ua)) return "web";
  return /iPhone|iPad|iPod/i.test(ua) ? "ios" : "android";
}

function callPlugin(plugin, method, options) {
  const cap = window.Capacitor;
  if (!cap) return null;
  const p = cap.Plugins?.[plugin];
  if (p && typeof p[method] === "function") return p[method](options);
  if (typeof cap.nativePromise === "function") return cap.nativePromise(plugin, method, options);
  return null;
}

/** Share text/link: native share sheet in the app, Web Share API in browsers. Returns true if shared. */
export async function shareContent({ title, text, url }) {
  if (isNativeApp()) {
    try {
      const r = callPlugin("Share", "share", { title, text, url, dialogTitle: title });
      if (r) { await r; return true; }
    } catch (e) {
      if (/cancel/i.test(String(e?.message || e))) return true;
    }
  }
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return true; }
    catch (e) { if (e?.name === "AbortError") return true; }
  }
  return false;
}

/** Short vibration on answer select etc. (no-op on the web). */
export function haptic(style = "LIGHT") {
  if (!isNativeApp()) return;
  try { callPlugin("Haptics", "impact", { style })?.catch?.(() => {}); } catch { /* ignore */ }
}

export const dashboardFor = (role) =>
  role === "admin" ? "/admin" : role === "parent" ? "/parent" : role === "teacher" ? "/teacher" : "/student";
