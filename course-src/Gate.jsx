import { useState } from "react";
import { T } from "./SilverTongue.jsx";

/* ————————————————————————————————————————————————
   A CASUAL SPEED BUMP — not real security.
   The password is right here in the bundle for anyone
   who opens dev tools and reads it — that's fine, that's
   the joke. Poke the wrong way in and you get a wink
   instead of a stack trace.
   ———————————————————————————————————————————————— */

const GATE_KEY = "silver_tongue_gate_v1";
const SECRET = "silvertongue";

function checkStored() {
  try {
    const raw = window.localStorage.getItem(GATE_KEY);
    if (raw === null) return "locked";
    return raw === SECRET ? "unlocked" : "backdoor";
  } catch (e) {
    return "locked";
  }
}

function unlock() {
  try { window.localStorage.setItem(GATE_KEY, SECRET); } catch (e) { /* non-fatal */ }
}

function Shell({ children }) {
  return (
    <div style={{
      maxWidth: 420, width: "100%", margin: "0 auto", textAlign: "center",
      padding: "56px 0", boxSizing: "border-box",
    }}>
      {children}
    </div>
  );
}

function PasswordGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [miss, setMiss] = useState(0);

  const submit = () => {
    if (value.trim().toLowerCase() === SECRET) {
      unlock();
      onUnlock();
    } else {
      setMiss((m) => m + 1);
      setValue("");
    }
  };

  return (
    <Shell>
      <div style={{
        fontFamily: T.serif, fontSize: 11, letterSpacing: "0.22em",
        textTransform: "uppercase", color: T.muted, marginBottom: 18,
      }}>Members only, sort of</div>
      <h1 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 26, margin: "0 0 14px", color: T.ink }}>
        The Silver Tongue
      </h1>
      <p style={{ fontFamily: T.serif, fontSize: 15.5, color: T.ink, lineHeight: 1.6, margin: "0 0 28px" }}>
        I've received enough requests over the years on how I approach sales
        and presentations, so I've created a course to share everything I've
        learned. I update it monthly — hope it's helpful!
      </p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="password"
        autoFocus
        style={{
          fontFamily: T.serif, fontSize: 16, padding: "10px 14px", width: "100%",
          maxWidth: 240, border: `1px solid ${T.line}`, borderRadius: 2,
          background: T.paper, color: T.ink, textAlign: "center", outline: "none",
          boxSizing: "border-box",
        }}
      />
      <div style={{ marginTop: 20 }}>
        <button
          onClick={submit}
          style={{
            fontFamily: T.serif, fontSize: 15, cursor: "pointer",
            padding: "10px 26px", borderRadius: 2, border: `1px solid ${T.accent}`,
            background: T.accent, color: T.paper,
          }}
        >Enter</button>
      </div>
      {miss > 0 && (
        <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 13.5, color: T.muted, marginTop: 20 }}>
          {miss < 3
            ? "Not quite."
            : "Still not it. This is a very casual lock, by the way — a resourceful person could find another way in."}
        </p>
      )}
    </Shell>
  );
}

function BackdoorFound({ onEnter }) {
  return (
    <Shell>
      <div style={{ fontSize: 34, marginBottom: 10 }}>🕵️</div>
      <h1 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 24, margin: "0 0 14px", color: T.ink }}>
        Congrats, you found the back door.
      </h1>
      <p style={{ fontFamily: T.serif, fontSize: 15.5, color: T.ink, lineHeight: 1.65, margin: "0 0 28px" }}>
        You didn't guess the password — you went and poked at the storage
        directly. Respect the initiative. This gate was only ever a speed
        bump, not a wall, and you just proved it. Come on in.
      </p>
      <button
        onClick={onEnter}
        style={{
          fontFamily: T.serif, fontSize: 15, cursor: "pointer",
          padding: "10px 26px", borderRadius: 2, border: `1px solid ${T.accent}`,
          background: T.accent, color: T.paper,
        }}
      >Take me in</button>
    </Shell>
  );
}

export default function Gate({ children }) {
  const [status, setStatus] = useState(checkStored);

  if (status === "unlocked") return children;
  if (status === "backdoor") {
    return <BackdoorFound onEnter={() => { unlock(); setStatus("unlocked"); }} />;
  }
  return <PasswordGate onUnlock={() => setStatus("unlocked")} />;
}
