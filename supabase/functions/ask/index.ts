// Supabase Edge Function: answers Bible-reader questions with Claude.
//
// Who may ask:
//   - the owner, signed in to the site (Supabase session token in `x-user-token`), or
//   - anyone with the chat password (in `x-chat-password`), checked here, never shipped to browsers.
// Guests are capped per visitor and in total per day; every call is logged to `ai_usage`.
//
// Secrets (Supabase Dashboard -> Edge Functions -> Secrets): ANTHROPIC_API_KEY, CHAT_PASSWORD
// (also accepted under the names they were first saved as: anthropic-bible-key, bible-chat-password).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Deploy: npx supabase functions deploy ask --project-ref <ref> --no-verify-jwt
// (--no-verify-jwt because the site uses a publishable key, not a JWT; auth is checked below.)

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const OWNER_EMAIL = "shlokdhavalpatel@gmail.com";
const MODEL = "claude-haiku-5-5"; // cheapest current model; short pastoral answers don't need more
const GUEST_DAILY_LIMIT = 30; // questions per visitor per day
const TOTAL_DAILY_LIMIT = 300; // all guests combined, per day
const ALLOWED_ORIGINS = new Set([
  "https://shlokdhavalpatel.com",
  "https://www.shlokdhavalpatel.com",
  "http://localhost:8734", // local copy of the site
]);

const secret = (...names: string[]) => names.map((n) => Deno.env.get(n)).find((v) => v && v.trim())?.trim() || "";
const anthropic = new Anthropic({ apiKey: secret("ANTHROPIC_API_KEY", "anthropic-bible-key") });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info, x-user-token, x-chat-password",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Constant-time string comparison so the password can't be guessed by timing.
function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

async function isOwner(token: string | null) {
  if (!token) return false;
  const { data, error } = await admin.auth.getUser(token);
  return !error && data.user?.email === OWNER_EMAIL;
}

function systemPrompt(title: string, versionName: string, chapterText: string) {
  return `You are a wise, warm pastor sitting beside someone reading ${title} (${versionName}) to grow closer to God. They highlight words or passages and ask what they are or what they mean.

Answer the way a good minister would in conversation:
- Be concise: usually 2–4 sentences (about 40–90 words). Plain, gentle, confident words.
- Say plainly what it is or means first. Add only the one piece of background that matters most (who, where, a Greek word, an Old Testament echo).
- When it fits naturally, close with a brief line on what it reveals about God or what it means for the reader's walk with Him. Don't preach or moralize, and skip it if it would feel forced.
- No headings and no bullet lists. Cite a cross-reference only if it truly helps (as Book Chapter:Verse, e.g. Luke 4:18).
- If they ask to go deeper, give more, still in this voice. Where Christians genuinely differ, say so briefly and kindly.
- Earlier questions in the conversation may be about other chapters.
- When the message is exactly "Say it simply": rewrite the selected text in plain, natural modern English (about as easy to read as the NLT or NIV), keeping its meaning faithful. Put the rewrite first, in italics, as its own paragraph. Then add one short sentence on what it means. Nothing else.

Full text of the chapter the reader currently has open:

${chapterText}`;
}

type InMessage = { role: "user" | "assistant"; content: string; quote?: string; ref?: string };

function toApiMessages(messages: InMessage[]): Anthropic.MessageParam[] {
  return messages.slice(-20).map((m) => {
    const text = String(m.content || "").slice(0, 4000);
    if (m.role === "assistant") return { role: "assistant", content: text || "…" };
    const quote = m.quote ? `Selected text${m.ref ? ` (${String(m.ref).slice(0, 60)})` : ""}: "${String(m.quote).slice(0, 2000)}"\n\n` : "";
    return { role: "user", content: quote + text };
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "method" }, cors);

  let body: { messages?: InMessage[]; title?: string; versionName?: string; context?: string; visitorId?: string };
  try { body = await req.json(); } catch { return json(400, { error: "bad_json" }, cors); }
  const messages = Array.isArray(body.messages) ? body.messages.filter((m) => m && (m.role === "user" || m.role === "assistant")) : [];
  if (!messages.length || messages[messages.length - 1].role !== "user") return json(400, { error: "no_question" }, cors);

  // ---- who is asking ----
  const owner = await isOwner(req.headers.get("x-user-token"));
  const visitorId = String(body.visitorId || "unknown").slice(0, 64);
  if (!owner) {
    const expected = secret("CHAT_PASSWORD", "bible-chat-password");
    const given = req.headers.get("x-chat-password") || "";
    if (!expected || !safeEqual(given.trim().toLowerCase(), expected.trim().toLowerCase())) {
      await new Promise((r) => setTimeout(r, 400)); // slow down guessing
      return json(401, { error: "password" }, cors);
    }
    const since = new Date(Date.now() - 864e5).toISOString();
    const [mine, all] = await Promise.all([
      admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("visitor_id", visitorId).eq("who", "guest").gte("created_at", since),
      admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("who", "guest").gte("created_at", since),
    ]);
    if ((mine.count ?? 0) >= GUEST_DAILY_LIMIT || (all.count ?? 0) >= TOTAL_DAILY_LIMIT) return json(429, { error: "limit" }, cors);
  }

  const { data: usageRow } = await admin.from("ai_usage").insert({ visitor_id: visitorId, who: owner ? "owner" : "guest" }).select("id").single();

  // ---- ask Claude, streaming plain text back ----
  const system = systemPrompt(
    String(body.title || "the Bible").slice(0, 80),
    String(body.versionName || "").slice(0, 80),
    String(body.context || "").slice(0, 60_000),
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let wrote = false;
      try {
        const claude = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 2000, // answers are short; also a per-question cost cap
          output_config: { effort: "low" }, // conversational answers; keeps them quick
          // The chapter text is the stable prefix: cache it so follow-ups in the same chapter are cheap.
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: toApiMessages(messages),
        });
        for await (const event of claude) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
            wrote = true;
          }
        }
        const final = await claude.finalMessage();
        if (final.stop_reason === "refusal" && !wrote) {
          controller.enqueue(encoder.encode("I'm not able to answer that one. Try asking about the passage in a different way."));
        }
        if (usageRow) {
          await admin.from("ai_usage").update({
            input_tokens: final.usage.input_tokens,
            output_tokens: final.usage.output_tokens,
            cache_read_tokens: final.usage.cache_read_input_tokens ?? 0,
          }).eq("id", usageRow.id);
        }
      } catch (err) {
        console.error(err);
        const status = err instanceof Anthropic.APIError ? err.status : 0;
        const outOfCredit = status === 400 && /credit balance/i.test(String((err as Error).message));
        const msg = outOfCredit
          ? "The AI helper is resting for now (its prepaid credit has run out). The Bible is still here to read. 🙏"
          : status === 401
          ? "⚠️ The AI isn't set up yet (the Anthropic API key is missing or invalid)."
          : status === 429 || status === 529
          ? "⚠️ The AI is busy right now. Please try again in a minute."
          : "⚠️ Something went wrong reaching the AI. Please try again.";
        controller.enqueue(encoder.encode((wrote ? "\n\n" : "") + msg));
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
});
