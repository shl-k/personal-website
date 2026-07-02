import { createRoot } from "react-dom/client";
import Gate from "./Gate.jsx";
import SilverTongue from "./SilverTongue.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  <Gate>
    <SilverTongue />
  </Gate>
);
