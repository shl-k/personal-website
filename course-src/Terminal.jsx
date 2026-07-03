import { useEffect, useState } from "react";

/* ————————————————————————————————————————————————
   Mirrors the retro Mac terminal chrome from the
   homepage (style.css: .terminal / .terminal-header),
   so /course reads as part of the same site.
   ———————————————————————————————————————————————— */

const MONO = "'Monaco', 'Menlo', 'Consolas', 'Chicago', 'Geneva', 'Arial', monospace";
const VT = "'VT323', 'IBM Plex Mono', 'Monaco', 'Menlo', 'Consolas', 'Chicago', 'Geneva', 'Arial', monospace";

const PIXEL_GRID =
  "repeating-linear-gradient(0deg, #b0b0b0 0px, #b0b0b0 1px, transparent 1px, transparent 4px)," +
  "repeating-linear-gradient(90deg, #b0b0b0 0px, #b0b0b0 1px, transparent 1px, transparent 4px)";

function formatClock(d) {
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${hour12}:${minutes}${ampm} - ${dateStr}`;
}

export default function TerminalShell({ title, children }) {
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: "100vh", margin: 0, background: "#131313",
      display: "flex", justifyContent: "center", alignItems: "center",
      boxSizing: "border-box",
    }}>
      <div style={{
        width: 700, maxWidth: "98vw", minWidth: 260,
        background: "#a0a0a0", border: "2px solid #888", borderRadius: 12,
        boxShadow: "0 0 24px #0008", minHeight: 500,
        padding: "0 0 24px 0", position: "relative", margin: "24px 0",
        backgroundImage: PIXEL_GRID,
        fontFamily: MONO,
      }}>
        <div style={{
          background: "#c0c0c0", borderBottom: "1px solid #888",
          padding: "4px 8px", borderRadius: "10px 10px 0 0",
          margin: "0 0 16px 0", display: "flex",
          justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a
              href="/"
              title="Back to the main site"
              style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "#b0b0b0", border: "1.5px solid #888",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#444", textDecoration: "none", boxShadow: "0 1px 2px #8882",
                fontFamily: VT, fontSize: 13, lineHeight: 1,
              }}
            ><span style={{ transform: "translateY(-1px)" }}>←</span></a>
            <span style={{ fontFamily: VT, fontSize: 16, fontWeight: "bold", color: "#222", letterSpacing: 1 }}>
              {title}
            </span>
          </div>
          <span style={{ fontFamily: VT, fontSize: 14, color: "#444" }}>{clock}</span>
        </div>
        <div style={{ padding: "0 32px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
