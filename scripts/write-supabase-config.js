// Writes /supabase-config.js (public URL + publishable key) from .env.
// Only public values go into it; the database URL never leaves .env.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const url = new URL(env.SUPABASE_URL).origin; // drops any /rest/v1/ suffix
const key = env.SUPABASE_ANON_KEY;
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !key) throw new Error("Check SUPABASE_URL / SUPABASE_ANON_KEY in .env");
fs.writeFileSync(
  path.join(root, "supabase-config.js"),
  `// Public Supabase settings (safe to publish; Row Level Security protects the data).\nwindow.SUPABASE_CONFIG = ${JSON.stringify({ url, anonKey: key, owner: "shlokdhavalpatel@gmail.com" })};\n`
);
console.log("wrote supabase-config.js");
