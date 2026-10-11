import { createRoot } from "react-dom/client";
import TerminalShell from "./Terminal.jsx";
import Gate from "./Gate.jsx";
import SilverTongue from "./SilverTongue.jsx";
import { startSession } from "./track.js";

startSession();

const root = createRoot(document.getElementById("root"));
root.render(
  <TerminalShell title="the-silver-tongue">
    <Gate>
      <SilverTongue />
    </Gate>
  </TerminalShell>
);
