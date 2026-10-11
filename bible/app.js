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
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
    if (SYNC_KEYS.includes(k)) { try { localStorage.setItem("localUpdatedAt", String(Date.now())); } catch {} scheduleSync(); }
  },
};

const CFG = window.BIBLE_CONFIG || {};
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname) && location.port === "4317"; // served by the companion
const AI_BASE = IS_LOCAL ? "" : "http://localhost:4317";
const YV_IDS = { BSB: 3034 }; // YouVersion ids (bible.com/bible/<id>). NIV (111) skipped: its license bars AI use.
const BOOK_LIST = (window.BIBLE_BOOKS || []).map(([code, name, chapters, testament]) => ({ code, name, chapters, testament }));
const BOOKS = Object.fromEntries(BOOK_LIST.map((b) => [b.code, b]));
const WEB_BOOKS = new Set(["LUK"]); // the World English Bible is bundled for Luke only
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
  if (r && r !== ref && BOOKS[r.split(".")[0]]) { ref = r; loadChapter(); }
});
function goTo(newRef, verse, flash) {
  app.classList.remove("sidebar-open-mobile");
  if (newRef === ref) { if (verse) goToVerse(verse, flash || [verse]); return; }
  ref = newRef;
  history.pushState(null, "", "#" + ref);
  loadChapter(verse, flash);
}

// ---------- "Back to where I was" ----------
// Jumping from the chat or the notes list remembers your reading spot; a button brings you back.
let backSpot = null;
function rememberSpot() {
  if (!chapter) return;
  const sc = $("readerScroll"), top = sc.getBoundingClientRect().top;
  const first = [...chapterEl.querySelectorAll(".content")].find((c) => c.getBoundingClientRect().bottom > top + 12);
  backSpot = { ref, scrollTop: sc.scrollTop, label: first ? `${chapter.title}:${first.dataset.v}` : chapter.title };
  $("backLabel").textContent = backSpot.label;
  $("backWrap").hidden = false;
}
function jumpTo(r, verses) {
  rememberSpot();
  goTo(r, verses[0], verses);
}
$("backBtn").addEventListener("click", async () => {
  const spot = backSpot;
  $("backWrap").hidden = true;
  backSpot = null;
  if (!spot) return;
  if (spot.ref !== ref) {
    ref = spot.ref;
    history.pushState(null, "", "#" + ref);
    await loadChapter();
  }
  const sc = $("readerScroll");
  sc.style.scrollBehavior = "auto";
  sc.scrollTop = spot.scrollTop;
  sc.style.scrollBehavior = "";
});
$("backClose").addEventListener("click", () => { $("backWrap").hidden = true; backSpot = null; });

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

// Versions that can show a book (WEB is only bundled for Luke).
const versionsFor = (bookCode) => versions.filter((v) => v !== "WEB" || WEB_BOOKS.has(bookCode));

async function fetchChapter(r, v) {
  const [bookCode, n] = r.split(".");
  const book = BOOKS[bookCode];
  if (!book) throw new Error("Unknown book");
  if (v === "WEB" && !WEB_BOOKS.has(bookCode)) {
    if (!versions.includes("BSB")) throw new Error("only Luke is available offline; add a YouVersion key for the full Bible");
    v = "BSB";
  }
  const title = `${bookCode === "PSA" ? "Psalm" : book.name} ${n}`; // "Psalm 23", like bible.com
  const base = { ref: r, title, chapter: Number(n), chapters: book.chapters };
  if (v !== "WEB") {
    try {
      const p = await yv(`/bibles/${YV_IDS[v]}/passages/${r}?format=html&include_headings=true`);
      const m = yvMeta[v] || {};
      const name = m.localized_title || m.title || v;
      let copy = String(m.copyright?.text || m.copyright || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!copy || /^public domain$/i.test(copy)) copy = `${name} (${v}). ${copy || "Used by permission"}`;
      return { ...base, version: v, versionName: name, html: String(p.content || ""), copyright: copy.replace(/\.?\s*$/, ".") + " Text provided by YouVersion." };
    } catch (err) {
      if (!WEB_BOOKS.has(bookCode)) throw err;
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
  clone.querySelectorAll("h1, .notice, .yv-n, .note, .r, [data-verse-footnote], .note-mark").forEach((n) => n.remove());
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
  if (!IS_LOCAL) return !!SBC; // hosted: the `ask` function (owner sign-in or chat password)
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${AI_BASE}/api/config`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  }
}

// New visitors open at Luke 9, "The Cost of Discipleship" (verse 57 in the BSB).
const START_REF = "LUK.9";
const START_VERSE = 57;
function scrollToSectionOf(v) {
  const content = chapterEl.querySelector(`.content[data-v="${v}"]`);
  if (!content) return;
  const block = content.closest(".p, .m, .q1, .q2, .pi, .nb") || content;
  const head = block.previousElementSibling;
  const target = head && head.matches(".s1, .s, .s2, .yv-h, .heading") ? head : block;
  const scroller = $("readerScroll");
  scroller.style.scrollBehavior = "auto";
  scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 20;
  scroller.style.scrollBehavior = "";
}

// Previous / next chapter, crossing into neighboring books.
function stepRef(r, dir) {
  const [code, n] = r.split(".");
  const i = BOOK_LIST.findIndex((b) => b.code === code);
  const c = Number(n) + dir;
  if (c >= 1 && c <= BOOKS[code].chapters) return `${code}.${c}`;
  const nb = BOOK_LIST[i + dir];
  if (!nb) return null;
  return `${nb.code}.${dir > 0 ? 1 : nb.chapters}`;
}

// "John 3:16", "jn 3", "1 cor 13:4", "ps 23", "4:16" (current book) → { ref, verse }
function parseReference(text, currentBook) {
  const m = text.trim().toLowerCase().match(/^([1-3]?\s*[a-z][a-z .]*?)?\.?\s*(\d{1,3})(?:\s*:\s*(\d{1,3}))?$/);
  if (!m) return null;
  let code = currentBook;
  if (m[1]) {
    const key = m[1].replace(/[\s.]/g, "");
    code = (window.BIBLE_ALIASES || {})[key] || BOOK_LIST.find((b) => b.code.toLowerCase() === key)?.code ||
      BOOK_LIST.find((b) => b.name.toLowerCase().replace(/\s/g, "").startsWith(key) && key.length >= 2)?.code;
  }
  const book = BOOKS[code];
  const ch = Number(m[2]);
  if (!book || ch < 1 || ch > book.chapters) return null;
  return { ref: `${code}.${ch}`, verse: m[3] ? Number(m[3]) : undefined };
}

// ---------- Rendering the chapter ----------
async function loadChapter(verse, flash) {
  hidePop();
  if (typeof closeNote === "function" && !$("noteCard").hidden) closeNote();
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
  $("prevBtn").disabled = !stepRef(ref, -1);
  $("nextBtn").disabled = !stepRef(ref, 1);

  chapterEl.innerHTML =
    `<h1>${esc(chapter.title)}</h1>` +
    (chapter.notice ? `<p class="notice">${esc(chapter.notice)}</p>` : "") +
    chapter.html;
  fixSpacing(chapterEl);
  tagVerses();
  tagHeadings();
  renderAnnotations();
  track("chapter_open", ref);
  $("copyright").textContent = chapter.copyright;
  markDiscussed();

  const scroller = $("readerScroll");
  scroller.style.scrollBehavior = "auto";
  scroller.scrollTop = 0;
  scroller.style.scrollBehavior = "";
  if (verse) setTimeout(() => goToVerse(verse, flash || [verse], false), 50); // new chapter: land on the verse instantly
}

// Sidebar: book card, chapter grid, recently read chapters.
function renderSidebar() {
  const code = ref.split(".")[0];
  $("bookTitle").textContent = BOOKS[code].name;
  $("bookSub").textContent = `Chapter ${chapter.chapter} · ${chapter.versionName}`;
  const grid = $("chapterGrid");
  if (grid.dataset.book !== code) {
    grid.dataset.book = code;
    grid.innerHTML = "";
    for (let c = 1; c <= chapter.chapters; c++) {
      const b = document.createElement("button");
      b.textContent = c;
      b.dataset.c = c;
      b.addEventListener("click", () => goTo(`${code}.${c}`));
      grid.appendChild(b);
    }
  }
  grid.querySelectorAll("button").forEach((b) => b.classList.toggle("active", Number(b.dataset.c) === chapter.chapter));

  const recents = [chapter.ref, ...store.get("recents", []).filter((r) => r !== chapter.ref)].slice(0, 5);
  store.set("recents", recents);
  $("recents").innerHTML = recents
    .map((r) => {
      const [bc, c] = r.split(".");
      if (!BOOKS[bc]) return "";
      return `<button class="recent-item${r === chapter.ref ? " active" : ""}" data-ref="${r}">
        <span class="recent-num">${c}</span><span>${esc(BOOKS[bc].name)} ${c}</span></button>`;
    })
    .join("");
  $("recents").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.ref)));
}

// Book picker: tap the "Now reading" card to choose any of the 66 books.
function renderBookList() {
  const cur = ref.split(".")[0];
  const section = (t, label) =>
    `<div class="book-group">${label}</div><div class="book-names">` +
    BOOK_LIST.filter((b) => b.testament === t)
      .map((b) => `<button data-code="${b.code}" class="${b.code === cur ? "active" : ""}">${esc(b.name)}</button>`)
      .join("") + "</div>";
  $("bookList").innerHTML = section("OT", "Old Testament") + section("NT", "New Testament");
}
function toggleBookList(open = $("bookList").hidden) {
  if (open) renderBookList();
  $("bookList").hidden = !open;
  $("chapterSection").hidden = open;
  $("bookCard").setAttribute("aria-expanded", String(open));
  if (open) $("bookList").querySelector(".active")?.scrollIntoView({ block: "center" });
}
$("bookCard").addEventListener("click", () => toggleBookList());
// The book icon in the top bar opens the same picker (showing the sidebar if it's collapsed).
$("booksBtn").addEventListener("click", () => {
  app.classList.remove("sidebar-collapsed");
  toggleBookList(true);
});
$("bookList").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-code]");
  if (!b) return;
  toggleBookList(false);
  goTo(`${b.dataset.code}.1`);
});

// Display-only spacing fixes for a few typos in the source text (e.g. "Alvan,Manahath", "sonof" in
// 1 Chronicles 1). Only adds missing spaces; never changes words.
const SPACING_FIXES = [[/([,;])(?=[A-Za-z\u2018\u201C])/g, "$1 "], [/\bsonof\b/g, "son of"]];
function fixSpacing(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let t = n.nodeValue;
    for (const [re, rep] of SPACING_FIXES) t = t.replace(re, rep);
    if (t !== n.nodeValue) n.nodeValue = t;
  }
}

// ---------- Highlights & notes ----------
// Stored per chapter and key: annotations["JHN.3"]["16"] for verse 16, ["h1"] for the heading
// that starts at verse 1. Each is { color?, note?, snip, at }: snip = a short text preview for
// the sidebar list, at = last change. Saved in this browser; synced with the account when signed in.
const HL_COLORS = ["honey", "sage", "sky", "rose"];
const HEADING_SEL = ".s1, .s, .s2, .yv-h, .heading, .ms";
const isHeadingKey = (k) => String(k).startsWith("h");
function annotationFor(k, r = ref) { return (store.get("annotations", {})[r] || {})[k] || {}; }
// A note covering several verses is stored once on its first key ("anchor") with `with: [other keys]`;
// the other keys carry `noteOf: anchor` so they're underlined but don't repeat the note.
const anchorOf = (k, r = ref) => annotationFor(k, r).noteOf || String(k);
const noteKeys = (k, r = ref) => { const a = anchorOf(k, r); return [a, ...(annotationFor(a, r).with || [])]; };

// One-time cleanup: older saves copied a range's note onto every verse. Merge runs of
// consecutive verses that carry the identical note into one anchored note.
function mergeDuplicateNotes() {
  const all = store.get("annotations", {});
  let changed = false;
  for (const ch of Object.values(all)) {
    const verseKeys = Object.keys(ch).filter((k) => !isHeadingKey(k) && ch[k].note && !ch[k].with && !ch[k].noteOf).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < verseKeys.length; ) {
      let j = i;
      while (j + 1 < verseKeys.length && verseKeys[j + 1] === verseKeys[j] + 1 && ch[verseKeys[j + 1]].note === ch[verseKeys[i]].note) j++;
      if (j > i) {
        const anchor = String(verseKeys[i]);
        const members = verseKeys.slice(i + 1, j + 1).map(String);
        ch[anchor].with = members;
        for (const m of members) { delete ch[m].note; ch[m].noteOf = anchor; }
        changed = true;
      }
      i = j + 1;
    }
  }
  if (changed) store.set("annotations", all);
}

// Give each section heading a stable key ("h" + the first verse after it) and wrap its text,
// so it can be highlighted and noted like a verse.
function tagHeadings() {
  chapterEl.querySelectorAll(HEADING_SEL).forEach((h, i) => {
    if (h.closest(".note")) return;
    let next = h.nextElementSibling, v = null;
    while (next && !v) { v = next.querySelector?.(".content")?.dataset.v; next = next.nextElementSibling; }
    const span = document.createElement("span");
    span.className = "hk-text";
    span.dataset.k = v ? `h${v}` : `hend${i}`;
    while (h.firstChild) span.appendChild(h.firstChild);
    h.appendChild(span);
  });
}

function snippetFor(k) {
  if (isHeadingKey(k)) return chapterEl.querySelector(`.hk-text[data-k="${k}"]`)?.textContent.trim().slice(0, 90) || "";
  return [...chapterEl.querySelectorAll(`.content[data-v="${k}"]`)].map((c) => c.textContent).join("").replace(/\s+/g, " ").trim().slice(0, 90);
}
function setAnnotation(keys, patch, r = ref) {
  const all = store.get("annotations", {});
  const ch = all[r] || {};
  keys = keys.map(String);
  if ("note" in patch) {
    // Notes are stored once on the first key; the rest of the range points to it.
    const [anchor, ...rest] = keys;
    // detach these keys from any older notes they belonged to
    for (const k of keys) {
      const old = ch[k] || {};
      if (old.noteOf && ch[old.noteOf]?.with) ch[old.noteOf].with = ch[old.noteOf].with.filter((x) => !keys.includes(x));
      if (old.with) for (const m of old.with) if (!keys.includes(m) && ch[m]) delete ch[m].noteOf;
    }
    for (const k of keys) { const a = { ...(ch[k] || {}) }; delete a.note; delete a.with; delete a.noteOf; ch[k] = a; }
    if (patch.note) {
      ch[anchor].note = patch.note;
      if (rest.length) ch[anchor].with = rest;
      for (const m of rest) ch[m].noteOf = anchor;
    }
    const { note, ...others } = patch;
    patch = others;
  }
  for (const key of keys) {
    const next = { ...(ch[key] || {}), ...patch };
    if (!next.color) delete next.color;
    if (!next.note) { delete next.note; delete next.with; }
    if (next.color || next.note || next.noteOf) {
      if (r === ref) next.snip = snippetFor(key) || next.snip || "";
      next.at = Date.now();
      ch[key] = next;
    } else delete ch[key];
  }
  if (Object.keys(ch).length) all[r] = ch; else delete all[r];
  store.set("annotations", all);
  if (r === ref) renderAnnotations();
  renderMarksList();
}
function renderAnnotations() {
  chapterEl.querySelectorAll(".note-mark").forEach((m) => m.remove());
  const ch = store.get("annotations", {})[ref] || {};
  const lastEl = {};
  const apply = (el, key) => {
    const a = ch[key] || {};
    if (a.color && HL_COLORS.includes(a.color)) el.dataset.hl = a.color; else delete el.dataset.hl;
    el.classList.toggle("has-note", !!(a.note || (a.noteOf && ch[a.noteOf]?.note)));
    lastEl[key] = el;
  };
  chapterEl.querySelectorAll(".content").forEach((c) => apply(c, c.dataset.v));
  chapterEl.querySelectorAll(".hk-text").forEach((h) => apply(h, h.dataset.k));
  for (const [key, a] of Object.entries(ch)) {
    if (!a.note) continue;
    const range = [key, ...(a.with || [])];
    const endKey = range.filter((k) => lastEl[k]).pop(); // marker goes after the last verse of the range
    if (!endKey) continue;
    const mark = document.createElement("span");
    mark.className = "note-mark";
    mark.dataset.k = key;
    mark.textContent = "✎";
    mark.title = "Note";
    lastEl[endKey].after(mark);
  }
}

// Human label for a set of keys in a chapter: "John 3:16–17" or "John 3 · “Jesus and Nicodemus”"
function labelFor(keys, r = ref, title = null) {
  const [code, n] = r.split(".");
  const chTitle = title || `${code === "PSA" ? "Psalm" : BOOKS[code]?.name || code} ${n}`;
  const verses = keys.filter((k) => !isHeadingKey(k)).map(Number).sort((a, b) => a - b);
  const head = keys.find(isHeadingKey);
  if (!verses.length && head) {
    const text = annotationFor(head, r).snip || (r === ref ? snippetFor(head) : "");
    return `${chTitle} · “${text || "heading"}”`;
  }
  const a = verses[0], b = verses[verses.length - 1];
  return `${chTitle}:${a}${b !== a ? "–" + b : ""}`;
}

const selKeys = (s) => [...(s?.headingKeys || []), ...(s?.verses || []).map(String)];
selPop.querySelectorAll(".hl-dot").forEach((d) => d.addEventListener("click", () => {
  const keys = selKeys(pendingSel);
  if (!keys.length) return;
  setAnnotation(keys, { color: d.dataset.color });
  hidePop();
  window.getSelection().removeAllRanges();
}));
$("hlClear").addEventListener("click", () => {
  const keys = selKeys(pendingSel);
  if (!keys.length) return;
  setAnnotation(keys, { color: null });
  hidePop();
  window.getSelection().removeAllRanges();
});
$("saveSelBtn").addEventListener("click", () => {
  const s = pendingSel;
  if (!s?.noteTarget) return;
  hidePop();
  window.getSelection().removeAllRanges();
  saveToNote(s.noteTarget, s.text, null);
});
$("noteBtn").addEventListener("click", () => {
  const keys = selKeys(pendingSel);
  if (!keys.length) return;
  const rect = pendingSel.rect;
  hidePop();
  window.getSelection().removeAllRanges();
  const existing = keys.map((k) => anchorOf(k)).find((a) => annotationFor(a).note);
  if (existing) openNote(existing, rect, { edit: true });
  else openNote(keys[0], rect, { edit: true, keys });
});

// Note card: hover shows it, click pins it (stays until closed), Edit/Delete inside.
let noteState = { k: null, keys: [], pinned: false, hideTimer: null };
function placeCard(rect) {
  const card = $("noteCard");
  const w = card.offsetWidth, h = card.offsetHeight;
  let left = Math.min(Math.max(rect.left, 8), innerWidth - w - 8);
  let top = rect.bottom + 8;
  if (top + h > innerHeight - 8) top = Math.max(8, rect.top - h - 8);
  card.style.left = left + "px";
  card.style.top = top + "px";
}
function openNote(k, rect, { edit = false, pin = false, keys = null } = {}) {
  clearTimeout(noteState.hideTimer);
  k = String(k);
  if (!keys) { keys = noteKeys(k); k = keys[0]; }
  const a = annotationFor(k);
  noteState = { k, keys: keys.map(String), pinned: pin || edit, hideTimer: null };
  $("noteRef").textContent = `Note · ${labelFor(noteState.keys, ref, chapter.title)}`;
  $("noteText").textContent = a.note || "";
  $("noteView").hidden = edit || !a.note;
  $("noteForm").hidden = !(edit || !a.note);
  $("noteInput").value = a.note || "";
  $("noteCard").classList.toggle("pinned", noteState.pinned);
  $("noteCard").hidden = false;
  placeCard(rect);
  chapterEl.querySelectorAll(".note-mark").forEach((m) => m.classList.toggle("active", m.dataset.k === k && noteState.pinned));
  if (edit) $("noteInput").focus();
}
function closeNote() {
  $("noteCard").hidden = true;
  noteState = { k: null, keys: [], pinned: false, hideTimer: null };
  chapterEl.querySelectorAll(".note-mark.active").forEach((m) => m.classList.remove("active"));
}
const noteTarget = (el) => el.closest(".note-mark") || el.closest(".content.has-note, .hk-text.has-note");
const keyOf = (t) => t.dataset.k || t.dataset.v;
chapterEl.addEventListener("mouseover", (e) => {
  const t = noteTarget(e.target);
  if (!t || noteState.pinned) return;
  openNote(keyOf(t), t.getBoundingClientRect());
});
chapterEl.addEventListener("mouseout", (e) => {
  const t = noteTarget(e.target);
  if (!t || noteState.pinned) return;
  noteState.hideTimer = setTimeout(() => { if (!noteState.pinned) closeNote(); }, 250);
});
$("noteCard").addEventListener("mouseenter", () => clearTimeout(noteState.hideTimer));
$("noteCard").addEventListener("mouseleave", () => { if (!noteState.pinned) closeNote(); });
chapterEl.addEventListener("click", (e) => {
  const t = noteTarget(e.target);
  if (!t || !window.getSelection().isCollapsed) return; // don't fight text selection
  openNote(keyOf(t), t.getBoundingClientRect(), { pin: true });
});
document.addEventListener("mousedown", (e) => {
  if (!$("noteCard").hidden && noteState.pinned && !e.target.closest("#noteCard, .note-mark, .content.has-note, .hk-text.has-note")) closeNote();
});
$("noteClose").addEventListener("click", closeNote);
$("noteEdit").addEventListener("click", () => {
  noteState.pinned = true;
  $("noteCard").classList.add("pinned");
  $("noteView").hidden = true;
  $("noteForm").hidden = false;
  $("noteInput").focus();
});
$("noteDelete").addEventListener("click", () => {
  setAnnotation(noteState.keys, { note: null });
  closeNote();
  toast("Note deleted");
});
$("noteCancel").addEventListener("click", () => {
  if (annotationFor(noteState.k).note) { $("noteForm").hidden = true; $("noteView").hidden = false; } else closeNote();
});
$("noteForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("noteInput").value.trim().slice(0, 4000);
  setAnnotation(noteState.keys, { note: text || null });
  closeNote();
  if (text) toast("Note saved");
});
$("readerScroll").addEventListener("scroll", () => { if (!noteState.pinned) closeNote(); }, { passive: true });

// ---------- Sidebar: My notes & highlights ----------
let marksShowAll = false;
function renderMarksList() {
  const all = store.get("annotations", {});
  const items = [];
  for (const [r, ch] of Object.entries(all)) {
    if (!BOOKS[r.split(".")[0]]) continue;
    for (const [k, a] of Object.entries(ch)) if (a.note || a.color) items.push({ r, k, a: { ...a, range: [k, ...(a.with || [])] } });
  }
  items.sort((x, y) => (y.a.at || 0) - (x.a.at || 0));
  $("marksSection").hidden = !items.length;
  const shown = marksShowAll ? items : items.slice(0, 4);
  $("marksList").innerHTML = shown.map(({ r, k, a }) => {
    const icon = a.color ? `<span class="mark-swatch" data-hl="${esc(a.color)}"></span>` : "";
    const pen = a.note ? `<span class="mark-pen">✎</span>` : "";
    const preview = a.note ? a.note.replace(/\s+/g, " ").slice(0, 70) : (a.snip || "");
    return `<button class="mark-item" data-r="${esc(r)}" data-k="${esc(k)}">
      <span class="mark-icons">${icon}${pen}</span>
      <span class="mark-body"><span class="mark-ref">${esc(labelFor(a.note ? a.range : [k], r))}</span><span class="mark-snip">${esc(preview)}</span></span>
    </button>`;
  }).join("") + (items.length > 4 ? `<button class="marks-more" id="marksMore">${marksShowAll ? "show fewer" : `show all (${items.length})`}</button>` : "");
}
$("marksList").addEventListener("click", (e) => {
  if (e.target.closest("#marksMore")) { marksShowAll = !marksShowAll; return renderMarksList(); }
  const b = e.target.closest(".mark-item");
  if (!b) return;
  const { r, k } = b.dataset;
  rememberSpot();
  const jump = () => {
    const el = isHeadingKey(k) ? chapterEl.querySelector(`.hk-text[data-k="${k}"]`) : chapterEl.querySelector(`.content[data-v="${k}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!isHeadingKey(k)) goToVerse(Number(k));
    if (annotationFor(k).note) setTimeout(() => openNote(k, el.getBoundingClientRect(), { pin: true }), 450);
  };
  if (r === ref) jump(); else { goTo(r); setTimeout(jump, 900); }
  if (innerWidth <= 760) app.classList.remove("sidebar-open-mobile");
});

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
  frag.querySelectorAll(".yv-vlbl, .label, .yv-n, .note, .r, [data-verse-footnote], .note-mark").forEach((n) => n.remove());
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
  const headingKeys = inChapter
    ? [...chapterEl.querySelectorAll(".hk-text")].filter((h) => range.intersectsNode(h)).map((h) => h.dataset.k)
    : [];
  let noteTarget = null;
  if (inChat) {
    const ai = (range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement).closest(".msg-ai");
    if (ai) noteTarget = noteTargetFor(Number(ai.dataset.idx));
  }
  return { text, verses, headingKeys, ref: refFor(verses), rect: range.getBoundingClientRect(), noteTarget };
}

function refFor(verses) {
  if (!verses.length) return null;
  const a = verses[0], b = verses[verses.length - 1];
  return `${chapter.title}:${a}${b !== a ? "–" + b : ""}`;
}

function showPop() {
  const s = readSelection();
  if (!s) return hidePop();
  const keys = selKeys(s);
  const canMark = keys.length > 0; // highlights/notes only on Bible text (verses or headings), not chat
  $("saveGroup").hidden = !s.noteTarget;
  if (!aiOn && !canMark && !s.noteTarget) return hidePop();
  pendingSel = s;
  $("markGroup").hidden = !canMark;
  $("aiGroup").hidden = !aiOn;
  $("aiDivider").hidden = !(aiOn && (canMark || s.noteTarget));
  const cur = canMark ? annotationFor(keys[0]).color : null;
  selPop.querySelectorAll(".hl-dot").forEach((d) => d.classList.toggle("current", d.dataset.color === cur));
  $("hlClear").hidden = !keys.some((k) => annotationFor(k).color);
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
  send({ content: "Please explain this", quote: s.text, ref: s.ref, chapterRef: s.verses.length ? ref : null, verses: s.verses });
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
// ---------- Chat history ----------
// "New chat" files the current conversation away instead of deleting it.
function archiveCurrent() {
  const real = messages.filter((m) => m.role !== "assistant" || m.content);
  if (!real.some((m) => m.role === "assistant")) return;
  const firstQ = real.find((m) => m.role === "user") || {};
  const title = (firstQ.quote ? `“${firstQ.quote}”` : firstQ.content || "Chat").slice(0, 80);
  const history = store.get("chatHistory", []);
  history.unshift({ id: Date.now(), at: new Date().toISOString(), title, ref: firstQ.ref || firstQ.chapterRef || "", messages: real });
  store.set("chatHistory", history.slice(0, 50));
}
$("newChatBtn").addEventListener("click", () => {
  if (busy) return;
  archiveCurrent();
  messages = [];
  store.set("messages", messages);
  renderLog();
  markDiscussed();
  showHistory(false);
});
function showHistory(open = $("chatHistory").hidden) {
  $("chatHistory").hidden = !open;
  chatLog.hidden = open;
  $("historyBtn").setAttribute("aria-pressed", String(open));
  if (open) renderHistory();
}
function renderHistory() {
  const history = store.get("chatHistory", []);
  const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  $("historyList").innerHTML = history.length
    ? history.map((h, i) => `
        <div class="history-item" data-i="${i}">
          <button class="history-open" data-i="${i}">
            <span class="history-title">${esc(h.title)}</span>
            <span class="history-meta">${esc(h.ref)}${h.ref ? " · " : ""}${fmt(h.at)} · ${h.messages.filter((m) => m.role === "user").length} question${h.messages.filter((m) => m.role === "user").length === 1 ? "" : "s"}</span>
          </button>
          <button class="history-del" data-i="${i}" title="Delete" aria-label="Delete this chat">×</button>
        </div>`).join("")
    : '<p class="history-empty">No past chats yet. When you start a new chat with +, the old one is saved here.</p>';
}
$("historyBtn").addEventListener("click", () => showHistory());
$("historyList").addEventListener("click", (e) => {
  const history = store.get("chatHistory", []);
  const del = e.target.closest(".history-del");
  const open = e.target.closest(".history-open");
  if (del) {
    history.splice(Number(del.dataset.i), 1);
    store.set("chatHistory", history);
    renderHistory();
  } else if (open && !busy) {
    const [chosen] = history.splice(Number(open.dataset.i), 1);
    store.set("chatHistory", history);
    archiveCurrent(); // keep whatever was open
    messages = chosen.messages;
    store.set("messages", messages);
    showHistory(false);
    renderLog();
    markDiscussed();
  }
});

$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const content = input.value.trim();
  if (!content && !composerSel) return;
  const s = composerSel;
  send({ content: content || "Please explain this", quote: s?.text, ref: s?.ref, chapterRef: s?.chapterRef, verses: s?.verses || [] });
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
    const res = await fetch(await askUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await askHeaders()) },
      body: JSON.stringify({
        title: chapter.title,
        versionName: chapter.versionName,
        context: chapterPlainText(),
        visitorId: visitorId(),
        messages: messages.slice(0, -1).map(({ role, content, quote, ref }) => ({ role, content, quote, ref })),
      }),
    });
    if (res.status === 401 && !IS_LOCAL) {
      // Needs the chat password: take the question back and ask for it.
      messages.splice(-2, 2);
      renderLog();
      markDiscussed();
      busy = false;
      $("sendBtn").disabled = false;
      showPasswordForm(userMsg, !!store.get("chat_pw", ""));
      return;
    }
    if (res.status === 429) throw new Error("limit");
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
    reply.content += err.message === "limit"
      ? "You've reached today's limit for questions. Please come back tomorrow. 🙏"
      : IS_LOCAL
      ? `\n\n⚠️ Couldn't reach the Bible companion on this Mac (${err.message}). Double-click Start Bible.command, then ask again.`
      : `\n\n⚠️ Couldn't reach the AI (${err.message}). Please try again.`;
  }
  if (!reply.content.trim()) reply.content = "⚠️ No reply came back. Try asking again.";
  busy = false;
  $("sendBtn").disabled = false;
  store.set("messages", messages);
  renderLog();
}

// Where questions go: the local companion on the owner's Mac, or the hosted `ask` function.
async function askUrl() {
  return IS_LOCAL ? "/api/ask" : `${SBC.url}/functions/v1/ask`;
}
async function askHeaders() {
  if (IS_LOCAL) return {};
  const h = { apikey: SBC.anonKey };
  const { data } = await sb.auth.getSession(); // refreshes the owner's token if needed
  if (data?.session?.access_token && user) h["x-user-token"] = data.session.access_token;
  const pw = store.get("chat_pw", "");
  if (pw) h["x-chat-password"] = pw;
  return h;
}

// Chat password prompt (guests). The password is checked by the server, never stored in the page code.
let retryAfterPassword = null;
function showPasswordForm(userMsg, wasWrong) {
  retryAfterPassword = userMsg;
  $("pwNote").textContent = wasWrong ? "That password didn't work. Try again." : "";
  $("pwForm").hidden = false;
  $("composer").hidden = true;
  $("pwInput").value = "";
  $("pwInput").focus();
}
$("pwForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = $("pwInput").value.trim();
  if (!pw) return;
  store.set("chat_pw", pw);
  $("pwForm").hidden = true;
  $("composer").hidden = false;
  if (retryAfterPassword) { const m = retryAfterPassword; retryAfterPassword = null; send(m); }
});
$("pwCancel").addEventListener("click", () => {
  retryAfterPassword = null;
  $("pwForm").hidden = true;
  $("composer").hidden = false;
});

function renderLog() {
  $("chatEmpty").hidden = messages.length > 0;
  chatLog.querySelectorAll(".msg-user, .msg-ai").forEach((n) => n.remove());
  messages.forEach((m, i) => {
    const el = document.createElement("div");
    if (m.role === "user") {
      el.className = "msg-user";
      if (m.quote) {
        const q = document.createElement("button");
        q.className = "quote-card";
        q.innerHTML = `“${esc(m.quote)}”` + (m.ref ? `<span class="ref">${esc(m.ref)}</span>` : "");
        if (m.verses?.length && m.chapterRef) {
          q.addEventListener("click", () => jumpTo(m.chapterRef, m.verses));
        }
        el.appendChild(q);
      }
      const b = document.createElement("div");
      b.className = "bubble";
      b.textContent = m.content;
      el.appendChild(b);
    } else {
      el.className = "msg-ai";
      el.dataset.idx = i;
      el.innerHTML = m.content ? md(m.content) : '<span class="typing"><i></i><i></i><i></i></span>';
      const target = noteTargetFor(i);
      if (m.content && target && !(busy && i === messages.length - 1)) {
        const bar = document.createElement("div");
        bar.className = "msg-actions";
        const b = document.createElement("button");
        b.className = "msg-save";
        b.textContent = m.savedToNote ? "Saved to note ✓" : `Save to note (${target.label})`;
        b.disabled = !!m.savedToNote;
        b.addEventListener("click", () => {
          saveToNote(target, stripMd(m.content), messages[i - 1]);
          m.savedToNote = true;
          store.set("messages", messages);
          renderLog();
        });
        bar.appendChild(b);
        el.appendChild(bar);
      }
    }
    chatLog.appendChild(el);
  });
  scrollChat();
}

// Which verse(s) an AI answer is about: the quote in the question just before it.
function noteTargetFor(i) {
  const q = messages[i - 1];
  if (!q || q.role !== "user" || !q.chapterRef || !q.verses?.length) return null;
  return { r: q.chapterRef, verses: q.verses, label: q.ref || q.chapterRef };
}
function stripMd(t) {
  return String(t).replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2").replace(/`([^`]+)`/g, "$1").trim();
}
// Append text to the note on those verses (keeps anything already written there).
function saveToNote(target, text, question) {
  const anchor = anchorOf(target.verses[0], target.r);
  const existing = annotationFor(anchor, target.r).note || "";
  const header = question?.content && !["Please explain this", "What is this?"].includes(question.content) ? `Q: ${question.content}\n` : "";
  const entry = header + text;
  const note = (existing ? existing + "\n\n— " : "") + entry;
  const keys = existing ? noteKeys(anchor, target.r) : target.verses;
  setAnnotation(keys, { note: note.slice(0, 4000) }, target.r);
  toast(`Saved to your note on ${target.label}`);
}
function scrollChat() { chatLog.scrollTop = chatLog.scrollHeight; }

// Underline every verse in this chapter the conversation has asked about.
function markDiscussed() {
  const set = new Set(messages.filter((m) => m.chapterRef === ref).flatMap((m) => m.verses || []));
  chapterEl.querySelectorAll(".content").forEach((c) => c.classList.toggle("discussed", set.has(Number(c.dataset.v))));
}

function goToVerse(n, flash = [n], smooth = true) {
  const el = chapterEl.querySelector(`.content[data-v="${n}"]`);
  if (!el) return;
  const sc = $("readerScroll");
  if (!smooth) sc.style.scrollBehavior = "auto";
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  if (!smooth) sc.style.scrollBehavior = "";
  for (const v of flash) {
    chapterEl.querySelectorAll(`.content[data-v="${v}"]`).forEach((f) => {
      f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash");
    });
  }
}
chatLog.addEventListener("click", (e) => {
  const x = e.target.closest(".xref");
  if (x) jumpTo(x.dataset.ref, [Number(x.dataset.v)]);
});

// ---------- Minimal, safe markdown ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const NAME_TO_CODE = Object.fromEntries(BOOK_LIST.map((b) => [b.name.toLowerCase(), b.code]));
NAME_TO_CODE["psalm"] = "PSA";
NAME_TO_CODE["song of solomon"] = "SNG";
const XREF_RE = new RegExp(
  `\\b(${Object.keys(NAME_TO_CODE).sort((a, b) => b.length - a.length).map((n) => n.replace(/ /g, "\\s+")).join("|")})\\s+(\\d{1,3}):(\\d{1,3})(?:[–-]\\d+)?`,
  "gi"
);

function inline(s) {
  s = esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  // Bible references are clickable (e.g. "Luke 4:18", "1 Corinthians 13:4–7", "Psalm 23:1").
  return s.replace(XREF_RE, (full, name, c, v) => {
    const code = NAME_TO_CODE[name.toLowerCase().replace(/\s+/g, " ")];
    if (!code || Number(c) > BOOKS[code].chapters) return full;
    return `<span class="xref" data-ref="${code}.${c}" data-v="${v}">${full}</span>`;
  });
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
// Text size: the Aa button opens a slider (13–28px, default 17).
const DEFAULT_SIZE = 17;
const clampSize = (n) => Math.min(28, Math.max(13, Math.round(Number(n)) || DEFAULT_SIZE));
let textSize = clampSize(store.get("textSize", DEFAULT_SIZE));
function applySize() {
  document.documentElement.style.setProperty("--verse-size", textSize + "px");
  $("sizeSlider").value = textSize;
  $("sizeValue").textContent = `${textSize}px`;
}
function toggleSizePop(open = $("sizePop").hidden) {
  $("sizePop").hidden = !open;
  $("fontBtn").setAttribute("aria-expanded", String(open));
}
$("fontBtn").addEventListener("click", (e) => { e.stopPropagation(); toggleSizePop(); });
$("sizeSlider").addEventListener("input", (e) => {
  textSize = clampSize(e.target.value);
  applySize();
});
$("sizeSlider").addEventListener("change", () => store.set("textSize", textSize));
$("sizeReset").addEventListener("click", () => {
  textSize = DEFAULT_SIZE;
  applySize();
  store.set("textSize", textSize);
});
document.addEventListener("click", (e) => {
  if (!$("sizePop").hidden && !e.target.closest(".size-wrap")) toggleSizePop(false);
});

$("versionBtn").addEventListener("click", () => {
  const vs = versionsFor(ref.split(".")[0]);
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
$("prevBtn").addEventListener("click", () => { const r = stepRef(ref, -1); if (r) goTo(r); });
$("nextBtn").addEventListener("click", () => { const r = stepRef(ref, 1); if (r) goTo(r); });
// ---------- Keyboard shortcuts ----------
// ⌘B / Ctrl+B: sidebar · ⌘I / Ctrl+I: AI chat · ↓/↑: scroll a little · ←/→: chapters · Esc: close popups
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl+";
function toggleSidebar() {
  if (innerWidth <= 760) app.classList.toggle("sidebar-open-mobile");
  else app.classList.toggle("sidebar-collapsed");
}
function toggleChat() {
  if (app.classList.contains("chat-open")) closeChat();
  else if (aiOn) { openChat(); input.focus(); }
}
// Hover tooltips that include the shortcut (shown instantly, unlike the browser's built-in ones)
document.querySelectorAll("[data-tip]").forEach((b) => {
  b.dataset.tipText = b.dataset.keys ? `${b.dataset.tip}  ${MOD}${b.dataset.keys}` : b.dataset.tip;
});
// Our own easing (the panel's CSS smooth-scroll would cancel itself on rapid presses).
// Time-based: each frame sets an exact position between where the glide started and the target.
let arrowScroll = { target: 0, from: 0, t0: 0, animating: false };
const ARROW_MS = 170;
function animateArrowScroll(sc) {
  arrowScroll.from = sc.scrollTop;
  arrowScroll.t0 = performance.now();
  if (arrowScroll.animating) return; // the running loop picks up the new target
  arrowScroll.animating = true;
  sc.style.scrollBehavior = "auto";
  const tick = (now) => {
    const p = Math.min(1, (now - arrowScroll.t0) / ARROW_MS);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    sc.scrollTop = Math.round(arrowScroll.from + (arrowScroll.target - arrowScroll.from) * eased);
    if (p < 1) return requestAnimationFrame(tick);
    arrowScroll.animating = false;
    sc.style.scrollBehavior = "";
  };
  requestAnimationFrame(tick);
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { hidePop(); toggleSizePop(false); closeNote(); }
  // Toolbar shortcuts: while text is selected and the toolbar is showing, single keys press its buttons
  // (1–4 highlight colors, 0 remove, N note, E explain, S say it simply, A ask).
  if (!selPop.hidden && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest?.("input, textarea")) {
    const k = e.key.toLowerCase();
    const btn = [...selPop.querySelectorAll("[data-key]")].find((b) => b.dataset.key === k && b.offsetParent !== null && !b.closest("[hidden]"));
    if (btn) { e.preventDefault(); btn.click(); return; }
  }
  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  if (mod && !e.shiftKey && !e.altKey && (e.key === "b" || e.key === "B")) { e.preventDefault(); toggleSidebar(); return; }
  if (mod && !e.shiftKey && !e.altKey && (e.key === "i" || e.key === "I")) { e.preventDefault(); toggleChat(); return; }
  if (e.target.closest?.("input, textarea, select, [contenteditable]") || !chapter || !$("gate").hidden) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    // ~3 lines per press; quick repeated presses (or holding the key) add up instead of cancelling
    const sc = $("readerScroll");
    const step = (e.key === "ArrowDown" ? 1 : -1) * Math.round(textSize * 1.75 * 3);
    const base = arrowScroll.animating ? arrowScroll.target : sc.scrollTop;
    arrowScroll.target = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, base + step));
    animateArrowScroll(sc);
    return;
  }
  if (e.key === "ArrowLeft" && stepRef(ref, -1)) goTo(stepRef(ref, -1));
  if (e.key === "ArrowRight" && stepRef(ref, 1)) goTo(stepRef(ref, 1));
});

// Search: "John 3:16", "ps 23", "1 cor 13", or "4:16" in the current book
$("search").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const hit = parseReference(e.target.value, ref.split(".")[0]);
  if (!hit) return toast("Try “John 3:16”, “Psalm 23”, or “4:16”");
  e.target.blur();
  goTo(hit.ref, hit.verse);
});
$("search").addEventListener("focus", (e) => e.target.select());

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 2200);
}

// ---------- Sign-in + sync (Supabase) ----------
// Signed in as the owner, settings and chats sync across devices (table bible_state).
// Signed out, everything stays in this browser only.
const SYNC_KEYS = ["ref", "version", "textSize", "recents", "messages", "bible_name", "annotations", "chatHistory"];
const SBC = window.SUPABASE_CONFIG;
const sb = SBC && window.supabase ? window.supabase.createClient(SBC.url, SBC.anonKey) : null;
const authReady = sb ? sb.auth.getSession() : Promise.resolve({ data: { session: null } }); // also reads a sign-in link's #access_token
let user = null;
let syncTimer = null;

function scheduleSync() {
  if (!user) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushSync, 1200);
}

async function pushSync() {
  if (!user) return;
  const { error } = await sb.from("bible_state").upsert({
    user_id: user.id,
    state: { ref: store.get("ref", ref), version: store.get("version", version), textSize: store.get("textSize", DEFAULT_SIZE), name: store.get("bible_name", ""), annotations: store.get("annotations", {}), chatHistory: store.get("chatHistory", []), recents: store.get("recents", []) },
    messages: store.get("messages", []),
    updated_at: new Date(Number(store.get("localUpdatedAt", Date.now()))).toISOString(),
  });
  if (error) console.warn("Sync failed:", error.message);
}

// Newer side wins: pull the cloud copy if it's newer than this browser's, otherwise push ours.
async function pullSync() {
  if (!user) return false;
  const { data, error } = await sb.from("bible_state").select("state, messages, updated_at").eq("user_id", user.id).maybeSingle();
  if (error) { console.warn("Sync failed:", error.message); return false; }
  const localAt = Number(store.get("localUpdatedAt", 0));
  if (!data || new Date(data.updated_at).getTime() <= localAt) { await pushSync(); return false; }
  const st = data.state || {};
  try {
    if (st.ref) localStorage.setItem("ref", JSON.stringify(st.ref));
    if (st.version) localStorage.setItem("version", JSON.stringify(st.version));
    if (st.textSize != null) localStorage.setItem("textSize", JSON.stringify(clampSize(st.textSize)));
    if (st.name) localStorage.setItem("bible_name", JSON.stringify(String(st.name).slice(0, 40)));
    if (st.annotations && typeof st.annotations === "object") localStorage.setItem("annotations", JSON.stringify(st.annotations));
    if (Array.isArray(st.chatHistory)) localStorage.setItem("chatHistory", JSON.stringify(st.chatHistory));
    if (st.recents) localStorage.setItem("recents", JSON.stringify(st.recents));
    localStorage.setItem("messages", JSON.stringify(data.messages || []));
    localStorage.setItem("localUpdatedAt", String(new Date(data.updated_at).getTime()));
  } catch {}
  return true;
}

function renderAccount() {
  $("account").hidden = !sb; // anyone can sign in to save their chats across devices
  $("accountOut").hidden = !!user;
  $("accountIn").hidden = !user;
  if (user) $("accountEmail").textContent = user.email;
}

$("signInBtn").addEventListener("click", () => {
  $("signInBtn").hidden = true;
  $("signInForm").hidden = false;
  $("signInHint").hidden = false;
  $("signInEmail").value = store.get("localAI", false) && SBC ? SBC.owner : "";
  $("signInEmail").focus();
});
$("signInForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("signInEmail").value.trim();
  $("accountNote").textContent = "Sending…";
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  $("accountNote").textContent = error ? `Couldn't send: ${error.message}` : "Check your email and tap the sign-in link on this device.";
});
$("signOutBtn").addEventListener("click", async () => {
  await sb.auth.signOut();
  // Clear this browser's copy of the synced data so the next person on this device starts fresh.
  ["messages", "recents", "ref", "localUpdatedAt", "chatOpen", "annotations", "chatHistory"].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
  location.reload();
});

// ---------- Usage tracking → Supabase table bible_events ----------
// A random visitor id (shared with /course) plus the first name from the gate.
// Not recorded on the owner's own devices (?me) or the local companion page.
const VISITOR_KEY = "st_visitor_id";
const SESSION_ID = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
const OPENED_AT = Date.now();
const isOwner = () => !!(user && SBC && user.email === SBC.owner);
const shouldTrack = () => !!SBC && !IS_LOCAL && !store.get("localAI", false) && !isOwner();

function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(VISITOR_KEY, id); }
    return id;
  } catch { return SESSION_ID; }
}

function track(event, detail = null, extra = {}) {
  if (!shouldTrack()) return;
  let referrer = null;
  try { const r = document.referrer && new URL(document.referrer); if (r && r.host !== location.host) referrer = r.host.slice(0, 200); } catch {}
  fetch(`${SBC.url}/rest/v1/bible_events`, {
    method: "POST",
    keepalive: true,
    headers: { apikey: SBC.anonKey, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      visitor_id: visitorId(), session_id: SESSION_ID, event,
      detail: detail == null ? null : String(detail).slice(0, 40),
      device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop",
      referrer, email: user?.email ? String(user.email).slice(0, 120) : null, ...extra,
    }),
  }).catch(() => {});
}

let leftReported = false;
function reportLeave() {
  if (leftReported) return;
  leftReported = true;
  track("leave", null, { seconds: Math.min(86400, Math.round((Date.now() - OPENED_AT) / 1000)) });
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") reportLeave(); else leftReported = false;
});
window.addEventListener("pagehide", reportLeave);

// ---------- Name gate ----------
// First screen: new reader (name + optional email) or returning reader (email sign-in link).
// Resolves with the reader's first name once they're through to the welcome step.
function showGate({ needNameOnly = false } = {}) {
  return new Promise((resolve) => {
    const panes = ["gateChoose", "gateForm", "gateSignIn", "gateSent", "gateWelcome"];
    const show = (id) => panes.forEach((p) => ($(p).hidden = p !== id));
    $("gate").hidden = false;
    app.hidden = true;

    const welcome = (name) => {
      store.set("bible_name", name);
      $("gateHello").textContent = `Welcome, ${name}.`;
      show("gateWelcome");
      $("gateStart").focus();
      $("gateStart").addEventListener("click", () => {
        $("gate").hidden = true;
        app.hidden = false;
        resolve(name);
      }, { once: true });
    };
    const sendLink = async (email, name) => {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + location.pathname, data: name ? { name } : undefined },
      });
      $("gateErr").textContent = error ? `Couldn't send the link: ${error.message}` : "";
      return !error;
    };

    if (needNameOnly) {
      // Signed in, but no name on the account yet: just ask for the name.
      $("gateEmail").hidden = true;
      $("gateFormNote").textContent = "Your first name is saved to your account and shared with sdp.";
      $("gateForm").querySelector("[data-gate-back]").hidden = true;
      show("gateForm");
    } else {
      show("gateChoose");
    }

    $("gateNewBtn").onclick = () => { show("gateForm"); $("gateName").focus(); };
    $("gateHaveBtn").onclick = () => { show("gateSignIn"); $("gateSignInEmail").focus(); };
    $("gate").querySelectorAll("[data-gate-back]").forEach((b) => (b.onclick = () => show("gateChoose")));

    $("gateForm").onsubmit = async (e) => {
      e.preventDefault();
      const name = $("gateName").value.trim().slice(0, 40);
      const email = needNameOnly ? "" : $("gateEmail").value.trim();
      if (!name) return;
      if (!email) return welcome(name);
      store.set("bible_name", name);
      $("gateSentText").textContent = `We sent a link to ${email}. Tap it on this device to finish creating your account. Your name is saved with it.`;
      $("gateGuestBtn").textContent = "Keep reading as a guest for now";
      $("gateGuestBtn").onclick = () => welcome(name);
      show("gateSent");
      await sendLink(email, name);
    };

    $("gateSignIn").onsubmit = async (e) => {
      e.preventDefault();
      const email = $("gateSignInEmail").value.trim();
      if (!email) return;
      $("gateSentText").textContent = `We sent a sign-in link to ${email}. Tap it on this device and you'll come back signed in, with your chats and reading place.`;
      $("gateGuestBtn").textContent = "Read as a guest instead";
      $("gateGuestBtn").onclick = () => { show("gateForm"); $("gateName").focus(); };
      show("gateSent");
      await sendLink(email, null);
    };
  });
}

// ---------- Title-bar clock (same format as the homepage) ----------
function tickClock() {
  const d = new Date();
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
  $("clock").textContent = `${h % 12 || 12}:${m}${h >= 12 ? "PM" : "AM"} - ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}
tickClock();
setInterval(tickClock, 1000);

// ---------- Boot ----------
(async function init() {
  const { data: auth } = await authReady; // before touching the URL hash
  // ?me / ?notme are read here too, so the owner's devices are never tracked
  const params = new URLSearchParams(location.search);
  if (params.has("me")) store.set("localAI", true);
  if (params.has("notme")) store.set("localAI", false);
  user = auth?.session?.user || null;
  track("visit");
  // Signed-in readers bring their name (and chats) from their account, so only ask if it's still unknown.
  if (await pullSync()) textSize = clampSize(store.get("textSize", DEFAULT_SIZE));
  let name = store.get("bible_name", "") || String(user?.user_metadata?.name || "").slice(0, 40);
  if (name && !store.get("bible_name", "")) store.set("bible_name", name); // name given when the account was created
  if (!name && !IS_LOCAL) {
    name = await showGate({ needNameOnly: !!user });
    track("onboard_done", name);
  } else if (name) {
    track("identify", name); // also links a signed-in reader's email to their name in /stats
  }
  const hadHash = !!readHash();
  renderAccount();
  applySize();
  [versions, aiOn] = await Promise.all([probeVersions(), detectAi()]);
  app.classList.toggle("no-ai", !aiOn);
  renderAccount(); // ?me (handled in detectAi) marks this as the owner's device
  const saved = store.get("version", null);
  version = versions.includes(saved) ? saved : versions[0];
  const firstVisit = !hadHash && store.get("ref", null) == null;
  ref = (hadHash && readHash()) || store.get("ref", START_REF);
  { const [c, n] = ref.split("."); if (!BOOKS[c] || Number(n) < 1 || Number(n) > BOOKS[c].chapters) ref = "LUK.3"; }
  history.replaceState(null, "", "#" + ref);
  messages = store.get("messages", []).filter((m) => m.role !== "assistant" || m.content);
  renderLog();
  mergeDuplicateNotes();
  renderMarksList();
  await loadChapter();
  if (firstVisit && ref === START_REF) scrollToSectionOf(START_VERSE);
  if (aiOn && store.get("chatOpen", false) && messages.length) openChat();
  if (user) toast("Synced");
})();
