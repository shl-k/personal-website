// Bible reader: loads a chapter (BSB live from YouVersion, or the bundled WEB),
// shows an "Ask" toolbar over selections, and streams answers into the right-hand chat.
// The same page runs locally (http://localhost:4317) and hosted (shlokdhavalpatel.com/bible).
// AI answers always come from the companion server on this Mac, so they only work where
// it's running; elsewhere the page is a reading-only Bible.

const $ = (id) => document.getElementById(id);
const app = $("app");
const chapterEl = $("chapter");
const chatLog = $("chatLog");
const input = $("input");
const selPop = $("selPop");

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const CFG = window.BIBLE_CONFIG || {};
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname) && location.port === "4317"; // served by the companion
const AI_BASE = IS_LOCAL ? "" : "http://localhost:4317";
const YV_IDS = { BSB: 3034 }; // YouVersion ids (bible.com/bible/<id>). NIV (111) skipped: its license bars AI use.
const BOOKS = { LUK: { name: "Luke", chapters: 24 } };
const yvMeta = {};
let versions = ["WEB"];
let aiOn = false;
let ref = "LUK.3";
let version = "WEB";
let chapter = null;       // {ref, title, book, chapter, chapters, version, versionName, html, copyright}
let messages = [];        // {role, content, quote?, ref?, chapterRef?, verses?}
let pendingSel = null;
let composerSel = null;
let busy = false;

// ---------- Routing: #LUK.3 ----------
function readHash() {
  const m = /^#([A-Z0-9]{3}\.\d{1,3})$/.exec(location.hash);
  return m ? m[1] : null;
}
window.addEventListener("hashchange", () => {
  const r = readHash();
  if (r && r !== ref) { ref = r; loadChapter(); }
});
function goTo(newRef, verse) {
  app.classList.remove("sidebar-open-mobile");
  if (newRef === ref) { if (verse) goToVerse(verse); return; }
  ref = newRef;
  history.pushState(null, "", "#" + ref);
  loadChapter(verse);
}

// ---------- Where the text comes from ----------
async function yv(pathname) {
  const res = await fetch(`https://api.youversion.com/v1${pathname}`, {
    headers: { "X-YVP-App-Key": CFG.youversionKey, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`YouVersion returned ${res.status}`);
  return res.json();
}

// Which YouVersion translations this key can open.
async function probeVersions() {
  if (!CFG.youversionKey) return ["WEB"];
  const ok = await Promise.all(
    Object.entries(YV_IDS).map(([abbr, id]) =>
      yv(`/bibles/${id}`).then((m) => ((yvMeta[abbr] = m), abbr)).catch(() => null)
    )
  );
  return [...ok.filter(Boolean), "WEB"];
}

async function fetchChapter(r, v) {
  const [bookCode, n] = r.split(".");
  const book = BOOKS[bookCode];
  const base = { ref: r, title: `${book.name} ${n}`, chapter: Number(n), chapters: book.chapters };
  if (v !== "WEB") {
    try {
      const p = await yv(`/bibles/${YV_IDS[v]}/passages/${r}?format=html&include_headings=true`);
      const m = yvMeta[v] || {};
      const name = m.localized_title || m.title || v;
      let copy = String(m.copyright?.text || m.copyright || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!copy || /^public domain$/i.test(copy)) copy = `${name} (${v}). ${copy || "Used by permission"}`;
      return { ...base, version: v, versionName: name, html: String(p.content || ""), copyright: copy.replace(/\.?\s*$/, ".") + " Text provided by YouVersion." };
    } catch (err) {
      const web = await fetchChapter(r, "WEB");
      return { ...web, notice: `Couldn't load the ${v} (${err.message}). Showing the World English Bible instead.` };
    }
  }
  const data = await fetch(`data/web/${r}.json`).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
  const html = data.sections
    .map((sec) =>
      (sec.heading ? `<div class="s1">${esc(sec.heading)}</div>` : "") +
      `<div class="p">${sec.verses.map((x) => `<span class="yv-vlbl">${x.n}</span>${esc(x.text)} `).join("")}</div>`
    )
    .join("");
  return {
    ...base, version: "WEB", versionName: "World English Bible", html,
    copyright: "World English Bible (WEB). Public domain." + (data.sections.some((x) => x.heading) ? " Section headings added for this reader." : ""),
  };
}

// The open chapter as plain text with verse numbers, sent to Claude as context.
function chapterPlainText() {
  const clone = chapterEl.cloneNode(true);
  clone.querySelectorAll("h1, .notice, .yv-n, .note, .r, [data-verse-footnote]").forEach((n) => n.remove());
  clone.querySelectorAll(".yv-vlbl").forEach((n) => (n.textContent = ` ${n.textContent} `));
  clone.querySelectorAll(".s1, .s2, .s, .yv-h, .heading").forEach((n) => (n.textContent = `\n\n[${n.textContent}]\n`));
  clone.querySelectorAll("div, p").forEach((n) => n.append("\n"));
  return clone.textContent.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

// AI is available on the local page, and on the hosted page only on a device that opted in
// (visit /bible/?me once). That way visitors never get a "local network" prompt.
async function detectAi() {
  const params = new URLSearchParams(location.search);
  if (params.has("me")) store.set("localAI", true);
  if (params.has("notme")) store.set("localAI", false);
  if (!IS_LOCAL && !store.get("localAI", false)) return false;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${AI_BASE}/api/config`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- Rendering the chapter ----------
async function loadChapter(verse) {
  hidePop();
  chapterEl.innerHTML = '<p class="loading">Loading…</p>';
  let data;
  try {
    data = await fetchChapter(ref, version);
  } catch (err) {
    chapterEl.innerHTML = `<p class="loading">Couldn't load this chapter (${esc(err.message)}).</p>`;
    return;
  }
  chapter = data;
  store.set("ref", ref);
  document.title = `${chapter.title} | ${chapter.version} Bible`;
  $("search").value = chapter.title;
  $("versionBtn").textContent = chapter.version;
  renderSidebar();
  $("prevBtn").disabled = chapter.chapter <= 1;
  $("nextBtn").disabled = chapter.chapter >= chapter.chapters;

  chapterEl.innerHTML =
    `<h1>${esc(chapter.title)}</h1>` +
    (chapter.notice ? `<p class="notice">${esc(chapter.notice)}</p>` : "") +
    chapter.html;
  tagVerses();
  $("copyright").textContent = chapter.copyright;
  markDiscussed();

  const scroller = $("readerScroll");
  scroller.style.scrollBehavior = "auto";
  scroller.scrollTop = 0;
  scroller.style.scrollBehavior = "";
  if (verse) setTimeout(() => goToVerse(verse), 50);
}

// Sidebar: book card, chapter grid, recently read chapters.
function renderSidebar() {
  $("bookSub").textContent = `Chapter ${chapter.chapter} · ${chapter.versionName}`;
  const grid = $("chapterGrid");
  if (grid.childElementCount !== chapter.chapters) {
    grid.innerHTML = "";
    for (let c = 1; c <= chapter.chapters; c++) {
      const b = document.createElement("button");
      b.textContent = c;
      b.dataset.c = c;
      b.addEventListener("click", () => goTo(`LUK.${c}`));
      grid.appendChild(b);
    }
  }
  grid.querySelectorAll("button").forEach((b) => b.classList.toggle("active", Number(b.dataset.c) === chapter.chapter));

  const recents = [chapter.ref, ...store.get("recents", []).filter((r) => r !== chapter.ref)].slice(0, 5);
  store.set("recents", recents);
  $("recents").innerHTML = recents
    .map((r) => {
      const c = r.split(".")[1];
      return `<button class="recent-item${r === chapter.ref ? " active" : ""}" data-ref="${r}">
        <span class="recent-num">${c}</span><span>Luke ${c}</span></button>`;
    })
    .join("");
  $("recents").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.ref)));
}

// Wrap every run of scripture text in <span class="content" data-v="N">, tracking
// the current verse from the verse-number labels, so selections map to verses.
function tagVerses() {
  const SKIP = ".yv-vlbl, .label, .yv-n, .note, .r, .s1, .s, .s2, .yv-h, .heading, .ms, .c, .cl, h1, .notice, [data-verse-footnote]";
  let current = 0;
  const walker = document.createTreeWalker(chapterEl, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const textNodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 1) {
      if (n.matches(".yv-vlbl, .verse > .label")) {
        const v = parseInt(n.textContent, 10);
        if (v) current = v;
      } else if (n.matches(".yv-v[v], .verse[data-usfm]")) {
        const v = parseInt(n.getAttribute("v") || (n.dataset.usfm || "").split(".").pop(), 10);
        if (v) current = v;
      }
      continue;
    }
    if (!n.nodeValue.trim() || !current) continue;
    if (n.parentElement.closest(SKIP)) continue;
    textNodes.push([n, current]);
  }
  for (const [node, v] of textNodes) {
    const span = document.createElement("span");
    span.className = "content";
    span.dataset.v = v;
    node.parentNode.insertBefore(span, node);
    span.appendChild(node);
  }
}

// ---------- Selection toolbar ----------
function readSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const inChapter = chapterEl.contains(range.commonAncestorContainer);
  const inChat = chatLog.contains(range.commonAncestorContainer);
  if (!inChapter && !inChat) return null;

  const frag = range.cloneContents();
  frag.querySelectorAll(".yv-vlbl, .label, .yv-n, .note, .r, [data-verse-footnote]").forEach((n) => n.remove());
  frag.querySelectorAll("div, p").forEach((d) => d.append(" ")); // keep poetry lines apart
  const text = frag.textContent.replace(/\s+/g, " ").trim();
  if (!text) return null;

  let verses = [];
  if (inChapter) {
    verses = [...new Set(
      [...chapterEl.querySelectorAll(".content")]
        .filter((c) => range.intersectsNode(c))
        .map((c) => Number(c.dataset.v))
    )].sort((a, b) => a - b);
  }
  return { text, verses, ref: refFor(verses), rect: range.getBoundingClientRect() };
}

function refFor(verses) {
  if (!verses.length) return null;
  const a = verses[0], b = verses[verses.length - 1];
  return `${chapter.title}:${a}${b !== a ? "–" + b : ""}`;
}

function showPop() {
  if (!aiOn) return;
  const s = readSelection();
  if (!s) return hidePop();
  pendingSel = s;
  selPop.hidden = false;
  const w = selPop.offsetWidth;
  const x = Math.min(Math.max(s.rect.left + s.rect.width / 2, w / 2 + 8), innerWidth - w / 2 - 8);
  const above = s.rect.top > 80;
  selPop.style.left = x + "px";
  selPop.style.top = (above ? s.rect.top - 10 : s.rect.bottom + 10 + selPop.offsetHeight) + "px";
}
function hidePop() { selPop.hidden = true; }

document.addEventListener("mouseup", (e) => { if (!selPop.contains(e.target)) setTimeout(showPop, 0); });
document.addEventListener("keyup", (e) => { if (e.shiftKey || e.key === "Shift") showPop(); });
document.addEventListener("selectionchange", () => {
  clearTimeout(showPop.t);
  showPop.t = setTimeout(() => { if (window.getSelection().isCollapsed) hidePop(); else if ("ontouchstart" in window) showPop(); }, 250);
});
document.addEventListener("mousedown", (e) => { if (!selPop.contains(e.target)) hidePop(); });
$("readerScroll").addEventListener("scroll", hidePop, { passive: true });
chatLog.addEventListener("scroll", hidePop, { passive: true });
selPop.addEventListener("mousedown", (e) => e.preventDefault()); // keep the selection alive

$("whatBtn").addEventListener("click", () => {
  if (!pendingSel) return;
  const s = pendingSel;
  hidePop();
  window.getSelection().removeAllRanges();
  openChat();
  send({ content: "What is this?", quote: s.text, ref: s.ref, chapterRef: s.verses.length ? ref : null, verses: s.verses });
});

$("simpleBtn").addEventListener("click", () => {
  if (!pendingSel) return;
  const s = pendingSel;
  hidePop();
  window.getSelection().removeAllRanges();
  openChat();
  send({ content: "Say it simply", quote: s.text, ref: s.ref, chapterRef: s.verses.length ? ref : null, verses: s.verses });
});

$("askBtn").addEventListener("click", () => {
  if (!pendingSel) return;
  setComposerSel(pendingSel);
  hidePop();
  window.getSelection().removeAllRanges();
  openChat();
  input.focus();
});

function setComposerSel(s) {
  composerSel = s ? { ...s, chapterRef: s.verses.length ? ref : null } : null;
  $("composerQuote").hidden = !s;
  $("composerQuoteText").textContent = s ? `“${s.text}”${s.ref ? " — " + s.ref : ""}` : "";
}
$("composerQuoteClear").addEventListener("click", () => setComposerSel(null));

// ---------- Chat ----------
function openChat() {
  if (!app.classList.contains("chat-open") && innerWidth < 1440 && innerWidth > 760) {
    app.classList.add("sidebar-collapsed");
  }
  app.classList.add("chat-open");
  store.set("chatOpen", true);
}
function closeChat() {
  app.classList.remove("chat-open");
  store.set("chatOpen", false);
}
$("chatToggle").addEventListener("click", () => { openChat(); input.focus(); });
$("closeChatBtn").addEventListener("click", closeChat);
$("newChatBtn").addEventListener("click", () => {
  if (busy) return;
  messages = [];
  store.set("messages", messages);
  renderLog();
  markDiscussed();
});

$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const content = input.value.trim();
  if (!content && !composerSel) return;
  const s = composerSel;
  send({ content: content || "What is this?", quote: s?.text, ref: s?.ref, chapterRef: s?.chapterRef, verses: s?.verses || [] });
  input.value = "";
  autosize();
  setComposerSel(null);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("composer").requestSubmit(); }
});
input.addEventListener("input", autosize);
function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; }

async function send(userMsg) {
  if (busy || !chapter) return;
  busy = true;
  $("sendBtn").disabled = true;
  messages.push({ role: "user", ...userMsg });
  const reply = { role: "assistant", content: "" };
  messages.push(reply);
  renderLog();
  markDiscussed();

  const aiEl = chatLog.lastElementChild;
  try {
    const res = await fetch(`${AI_BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: chapter.title,
        versionName: chapter.versionName,
        context: chapterPlainText(),
        messages: messages.slice(0, -1).map(({ role, content, quote, ref }) => ({ role, content, quote, ref })),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      reply.content += dec.decode(value, { stream: true });
      aiEl.innerHTML = md(reply.content);
      scrollChat();
    }
  } catch (err) {
    reply.content += `\n\n⚠️ Couldn't reach the Bible companion on this Mac (${err.message}). Double-click Start Bible.command, then ask again.`;
  }
  if (!reply.content.trim()) reply.content = "⚠️ No reply came back. Try asking again.";
  aiEl.innerHTML = md(reply.content);
  busy = false;
  $("sendBtn").disabled = false;
  store.set("messages", messages);
  scrollChat();
}

function renderLog() {
  $("chatEmpty").hidden = messages.length > 0;
  chatLog.querySelectorAll(".msg-user, .msg-ai").forEach((n) => n.remove());
  for (const m of messages) {
    const el = document.createElement("div");
    if (m.role === "user") {
      el.className = "msg-user";
      if (m.quote) {
        const q = document.createElement("button");
        q.className = "quote-card";
        q.innerHTML = `“${esc(m.quote)}”` + (m.ref ? `<span class="ref">${esc(m.ref)}</span>` : "");
        if (m.verses?.length && m.chapterRef) {
          q.addEventListener("click", () => {
            if (m.chapterRef === ref) goToVerse(m.verses[0], m.verses);
            else goTo(m.chapterRef, m.verses[0]);
          });
        }
        el.appendChild(q);
      }
      const b = document.createElement("div");
      b.className = "bubble";
      b.textContent = m.content;
      el.appendChild(b);
    } else {
      el.className = "msg-ai";
      el.innerHTML = m.content ? md(m.content) : '<span class="typing"><i></i><i></i><i></i></span>';
    }
    chatLog.appendChild(el);
  }
  scrollChat();
}
function scrollChat() { chatLog.scrollTop = chatLog.scrollHeight; }

// Underline every verse in this chapter the conversation has asked about.
function markDiscussed() {
  const set = new Set(messages.filter((m) => m.chapterRef === ref).flatMap((m) => m.verses || []));
  chapterEl.querySelectorAll(".content").forEach((c) => c.classList.toggle("discussed", set.has(Number(c.dataset.v))));
}

function goToVerse(n, flash = [n]) {
  const el = chapterEl.querySelector(`.content[data-v="${n}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  for (const v of flash) {
    chapterEl.querySelectorAll(`.content[data-v="${v}"]`).forEach((f) => {
      f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash");
    });
  }
}
chatLog.addEventListener("click", (e) => {
  const x = e.target.closest(".xref");
  if (x) goTo(`LUK.${x.dataset.c}`, Number(x.dataset.v));
});

// ---------- Minimal, safe markdown ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function inline(s) {
  s = esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  // References into Luke are clickable (e.g. "Luke 4:18" or "Luke 4:18–19").
  return s.replace(/\b(Luke\s+(\d{1,2}):(\d{1,3})(?:[–-]\d+)?)/g, (m, full, c, v) =>
    Number(c) >= 1 && Number(c) <= 24 ? `<span class="xref" data-c="${c}" data-v="${v}">${full}</span>` : full
  );
}
function md(src) {
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of src.split("\n")) {
    const line = raw.trimEnd();
    let m;
    if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
      if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^#{1,6}\s+(.*)/))) {
      close(); out.push(`<h4>${inline(m[1])}</h4>`);
    } else if (!line.trim()) {
      close();
    } else {
      close(); out.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  return out.join("");
}

// ---------- Header controls ----------
const SIZES = [18, 20, 22, 24, 26];
let sizeIdx = store.get("sizeIdx", 1);
function applySize() { document.documentElement.style.setProperty("--verse-size", SIZES[sizeIdx] + "px"); }
$("fontBtn").addEventListener("click", () => {
  sizeIdx = (sizeIdx + 1) % SIZES.length;
  store.set("sizeIdx", sizeIdx);
  applySize();
  toast(`Text size ${SIZES[sizeIdx]}px`);
});

$("versionBtn").addEventListener("click", () => {
  const vs = versions;
  if (vs.length < 2) return toast("Only one version is available");
  version = vs[(vs.indexOf(version) + 1) % vs.length];
  toast(version);
  store.set("version", version);
  loadChapter();
});

$("collapseBtn").addEventListener("click", () => app.classList.add("sidebar-collapsed"));
$("expandBtn").addEventListener("click", () => {
  if (innerWidth <= 760) app.classList.toggle("sidebar-open-mobile");
  else app.classList.remove("sidebar-collapsed");
});
$("prevBtn").addEventListener("click", () => chapter && goTo(`LUK.${chapter.chapter - 1}`));
$("nextBtn").addEventListener("click", () => chapter && goTo(`LUK.${chapter.chapter + 1}`));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hidePop();
  if (e.target.closest("input, textarea") || !chapter) return;
  if (e.key === "ArrowLeft" && chapter.chapter > 1) goTo(`LUK.${chapter.chapter - 1}`);
  if (e.key === "ArrowRight" && chapter.chapter < chapter.chapters) goTo(`LUK.${chapter.chapter + 1}`);
});

// Search: "Luke 4", "4", "4:16", "luke 5:12"
$("search").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const m = e.target.value.trim().match(/^(?:luke|luk|lk)?\.?\s*(\d{1,2})(?:\s*:\s*(\d{1,3}))?$/i);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 24) return toast("Try “Luke 4” or “4:16”");
  e.target.blur();
  goTo(`LUK.${Number(m[1])}`, m[2] ? Number(m[2]) : undefined);
});
$("search").addEventListener("focus", (e) => e.target.select());

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 2200);
}

// ---------- Boot ----------
(async function init() {
  applySize();
  [versions, aiOn] = await Promise.all([probeVersions(), detectAi()]);
  app.classList.toggle("no-ai", !aiOn);
  const saved = store.get("version", null);
  version = versions.includes(saved) ? saved : versions[0];
  ref = readHash() || store.get("ref", "LUK.3");
  history.replaceState(null, "", "#" + ref);
  messages = store.get("messages", []).filter((m) => m.role !== "assistant" || m.content);
  renderLog();
  await loadChapter();
  if (aiOn && store.get("chatOpen", false) && messages.length) openChat();
})();
