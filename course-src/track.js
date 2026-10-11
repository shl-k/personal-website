// Anonymous usage tracking for the course → Supabase table `course_events`.
// Each browser gets a random visitor id; no names, emails, or typed text are sent.
// Insert-only: visitors can add events but never read them (see supabase/schema.sql).

const CFG = window.SUPABASE_CONFIG || null;
const VISITOR_KEY = "st_visitor_id";
const START = Date.now();
const SESSION = uuid();

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) { id = uuid(); localStorage.setItem(VISITOR_KEY, id); }
    return id;
  } catch (e) {
    return SESSION; // storage blocked: count as a one-off visitor
  }
}

const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop";
let referrer = null;
try {
  const r = document.referrer && new URL(document.referrer);
  if (r && r.host !== location.host) referrer = r.host.slice(0, 200);
} catch (e) { /* ignore */ }

export function track(event, detail = null, extra = {}) {
  if (!CFG) return;
  const body = {
    visitor_id: visitorId(),
    session_id: SESSION,
    event,
    detail: detail == null ? null : String(detail).slice(0, 40),
    device,
    referrer,
    ...extra,
  };
  try {
    fetch(`${CFG.url}/rest/v1/course_events`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: CFG.anonKey, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch (e) { /* tracking must never break the course */ }
}

// One 'visit' per page load, and one 'leave' with time spent when the tab is hidden/closed.
let left = false;
function reportLeave() {
  if (left) return;
  left = true;
  track("leave", null, { seconds: Math.min(86400, Math.round((Date.now() - START) / 1000)) });
}
export function startSession() {
  track("visit");
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") reportLeave();
    else left = false; // came back; the next hide reports total time again
  });
  window.addEventListener("pagehide", reportLeave);
}
