import { createStore } from "./store.js";

/* ============ Data & constants ============ */
const SURAHS = window.JUZ_AMMA;                       // [{n, ar, en, meaning, ayat:[{a, e}]}] for 78..114
const byN = Object.fromEntries(SURAHS.map(s => [s.n, s]));
const ORDER = [...SURAHS].sort((a, b) => b.n - a.n);   // kids start from An-Nas (114) and climb to An-Naba (78)
const TOTAL_AYAT = SURAHS.reduce((t, s) => t + s.ayat.length, 0);
const DAY = 86400000;
const INTERVALS = [1, 3, 7, 14, 30, 60, 90];          // spaced review, in days
const RECITERS = [
  { id: "Husary_128kbps", name: "Al-Husary (clear & steady)" },
  { id: "Husary_Muallim_128kbps", name: "Al-Husary — teaching (slow)" },
  { id: "Minshawy_Teacher_128kbps", name: "Al-Minshawi — with children repeating" },
  { id: "Alafasy_128kbps", name: "Mishary Alafasy" },
  { id: "Abdul_Basit_Murattal_192kbps", name: "Abdul Basit (murattal)" },
];
const AVATARS = ["🌙", "⭐", "🌴", "🐪", "🌸", "🦁", "🐢", "🦋", "🌿", "🕌", "🐬", "🦉"];
const COLORS = ["#dcefe8", "#f8ecd0", "#dbe9f4", "#f8dcd4", "#e8e0f5", "#fbe9cc"];
const BASMALA = "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ";

/* ============ Helpers ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const arNum = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const pad3 = n => String(n).padStart(3, "0");
const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA");
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };
const fmtDate = t => t ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
const fmtDateTime = t => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDur = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const relDays = t => {
  const d = Math.round((new Date(t).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY);
  return d <= 0 ? (d === 0 ? "today" : `${-d} day${d === -1 ? "" : "s"} overdue`) : d === 1 ? "tomorrow" : `in ${d} days`;
};
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("hifz-path:" + s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}
const I = {
  play: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  stop: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  mic: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  eye: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  book: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 5.5C5.5 4 9 4 12 6c3-2 6.5-2 9-.5V19c-2.5-1.5-6-1.5-9 .5-3-2-6.5-2-9-.5z"/><path d="M12 6v13.5"/></svg>',
  star: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
  lock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  back: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  flame: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.3-5 .2 1.8 1 3 2.2 3.5C11 9 11 5 12 2z"/></svg>',
  repeat: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>',
};

/* ============ App state ============ */
let store, settings = {}, kids = [];
const S = { kidId: null, progress: {}, view: null };
const reciter = () => settings.reciter || RECITERS[0].id;
const audioUrl = (s, a, rec = reciter()) => `https://everyayah.com/data/${rec}/${pad3(s)}${pad3(a)}.mp3`;
const kidById = id => kids.find(k => k.id === id);

function surahState(p, s) {
  const pr = p[s.n] || {};
  const known = (pr.known || []).length;
  const due = pr.status === "memorized" && pr.nextReview && pr.nextReview <= endOfToday();
  const status = pr.status === "memorized" ? "memorized" : known > 0 || pr.status === "learning" ? "learning" : "new";
  return { ...pr, status, known, due, total: s.ayat.length };
}
function kidStats(p) {
  let mem = 0, ayat = 0, due = 0, learning = 0;
  for (const s of SURAHS) {
    const st = surahState(p, s);
    if (st.status === "memorized") { mem++; ayat += st.total; } else ayat += st.known;
    if (st.due) due++;
    if (st.status === "learning") learning++;
  }
  return { mem, ayat, due, learning };
}
function streak(kid) {
  const days = new Set(kid.days || []); let n = 0; let t = Date.now();
  if (!days.has(dayKey(t))) t -= DAY;
  while (days.has(dayKey(t))) { n++; t -= DAY; }
  return n;
}
async function markActive(kid) {
  const k = dayKey(); const days = kid.days || [];
  if (days.includes(k)) return;
  kid.days = [...days, k].slice(-120);
  await store.saveKid({ id: kid.id, days: kid.days });
}

/* ============ Audio player ============ */
const player = {
  audio: null, next: null, seq: [], i: 0, opts: null, onAyah: () => {}, onStop: () => {},
  build(o) {
    const items = [];
    if (o.basmala && o.from === 1) items.push(0);
    for (let a = o.from; a <= o.to; a++) for (let r = 0; r < o.repeat; r++) items.push(a);
    return items;
  },
  url(a) { return a === 0 ? audioUrl(1, 1) : audioUrl(this.opts.s, a); },
  play(o, onAyah, onStop) {
    this.stop(true);
    this.opts = o; this.seq = this.build(o); this.i = 0; this.onAyah = onAyah || (() => {}); this.onStop = onStop || (() => {});
    this._go();
  },
  _go() {
    if (this.i >= this.seq.length) {
      if (this.opts.loop) { this.i = 0; this.seq = this.build({ ...this.opts, basmala: false }); }
      else return this.stop();
    }
    const a = this.seq[this.i];
    const au = this.next && this.next._a === a ? this.next : new Audio(this.url(a));
    au._a = a; au.playbackRate = this.opts.rate || 1; this.audio = au;
    const na = this.seq[this.i + 1] ?? (this.opts.loop ? this.seq[0] : null);
    if (na != null) { this.next = new Audio(this.url(na)); this.next._a = na; this.next.preload = "auto"; } else this.next = null;
    au.onended = () => { this.i++; this._go(); };
    au.onerror = () => { toast("Couldn't load the recitation. Check the internet connection."); this.stop(); };
    this.onAyah(a);
    au.play().catch(e => { if (e.name !== "AbortError") { toast("Tap play again to start audio."); this.stop(); } });
  },
  stop(silent) {
    if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); }
    this.audio = null; this.next = null;
    if (!silent) this.onStop();
  },
  get playing() { return !!this.audio; },
};

/* ============ Router ============ */
window.addEventListener("hashchange", route);
async function route() {
  player.stop(true); recorder.cancel(); dailyTimer.stop(); checker.cancel();
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const app = $("#app");
  try {
    if (store.mode === "cloud" && !store.user) return renderSignIn();
    if (parts[0] === "join") return await importSetup(parts.slice(1).join("/"));
    if (parts[0] === "parent") return await renderParent(parts[1]);
    if (parts[0] === "kid" && kidById(parts[1])) {
      S.kidId = parts[1];
      S.progress = await store.getProgress(S.kidId);
      if (parts[2] === "daily") return renderDaily();
      if (parts[2] === "s" && byN[parts[3]]) return renderSurah(byN[parts[3]], parts[4] || "learn");
      return renderKidHome();
    }
    S.kidId = null; renderPicker();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card"><h3>Something went wrong</h3><p class="muted">${esc(e.message || e)}</p><a class="btn" href="#/">Back home</a></div>`;
  }
}
function setNav() {
  const kid = kidById(S.kidId);
  $("#topnav").innerHTML = (kid ? `<a class="pill" href="#/" title="Switch child"><span class="who">${esc(kid.avatar || "⭐")} ${esc(kid.name)}</span></a>` : "")
    + `<a class="pill" href="#/parent">${I.lock}<span>Parent</span></a>`;
}

/* ============ Sign-in (cloud mode) ============ */
function renderSignIn() {
  $("#topnav").innerHTML = "";
  $("#app").innerHTML = `
    <div class="hero"><div class="bismillah">${BASMALA}</div></div>
    <div class="card pin-box">
      <h1>Welcome</h1>
      <p class="muted">A parent signs in once on each device. After that, the kids just tap their name, and everything they do syncs to your phone.</p>
      <button class="btn big" id="gsign">Sign in with Google</button>
      <p class="small muted" id="err"></p>
    </div>`;
  $("#gsign").onclick = async () => {
    try { await store.signIn(); await boot(); } catch (e) { $("#err").textContent = e.message || e; }
  };
}

/* ============ Kid picker ============ */
function renderPicker() {
  setNav();
  setTimeout(() => { const b = $("#pasteGo"); if (!b) return;
    b.onclick = () => { const v = $("#pasteLink").value.trim(), i = v.indexOf("#/join/");
      if (i < 0) return toast("That isn't a setup link. Ask your parent to send it again.");
      location.hash = v.slice(i); }; });
  $("#app").innerHTML = `
    <div class="hero">
      <div class="bismillah">${BASMALA}</div>
      <h1>Who's practicing today?</h1>
      <p class="muted">Juz' 'Amma · ${SURAHS.length} surahs · ${TOTAL_AYAT} ayahs</p>
    </div>
    ${kids.length ? `<div class="kids">${kids.map(k => `
      <a class="kid-btn" href="#/kid/${k.id}" style="text-decoration:none;color:inherit">
        <div class="avatar" style="background:${esc(k.color || COLORS[0])}">${esc(k.avatar || "⭐")}</div>
        <div class="name">${esc(k.name)}</div>
        <div class="small muted">${streak(k) ? `${I.flame} ${streak(k)}-day streak` : "Tap to start"}</div>
      </a>`).join("")}</div>`
    : `<div class="card" style="text-align:center;max-width:460px;margin:20px auto">
        <h3>No one is set up on this device yet</h3>
        <p class="muted"><b>Kids:</b> ask your parent to send you the <b>setup link</b> and open it on this device.</p>
        <p class="muted small"><b>Parent:</b> open the parent area, add the children, then tap <b>“📲 Share with kids”</b>.</p>
        <div class="row" style="margin:12px 0"><input type="text" id="pasteLink" placeholder="…or paste the setup link here" style="flex:1"><button class="btn sm" id="pasteGo">Go</button></div>
        <a class="btn ghost sm" href="#/parent">${I.lock} Open parent area</a></div>`}
    ${store.mode === "local" ? `<p class="small muted" style="text-align:center;margin-top:28px">Saving on this device only${store.cloudError ? " (sync error — see Parent area)" : ""}.</p>` : ""}`;
}

/* ============ Kid home ============ */
function tile(s, p, kid) {
  const st = surahState(p, s);
  const cls = st.due ? "due" : st.status;
  const pct = st.status === "memorized" ? 100 : Math.round(st.known / st.total * 100);
  const chip = st.due ? `<span class="chip due">Review</span>` : st.status === "memorized" ? `<span class="chip memorized">${I.check} Memorized</span>` : st.status === "learning" ? `<span class="chip learning">${st.known}/${st.total}</span>` : `<span>${st.total} ayahs</span>`;
  return `<a class="surah-tile ${cls}" href="#/kid/${kid.id}/s/${s.n}/${liveSupported() ? "recite" : st.due ? "test" : "memorize"}" style="text-decoration:none;color:inherit">
    <span class="num">${s.n}</span>
    <span class="sn-ar">${esc(s.ar)}</span>
    <span class="sn-en">${esc(s.en)}</span>
    <span class="mini"><i style="width:${pct}%"></i></span>
    <span class="meta">${chip}${st.bestStars ? starRow(st.bestStars) : ""}${st.approved ? `<span title="Checked by parent" style="color:var(--gold)">${I.star}</span>` : ""}</span>
  </a>`;
}
function renderKidHome() {
  setNav();
  const kid = kidById(S.kidId), p = S.progress, st = kidStats(p);
  const due = ORDER.filter(s => surahState(p, s).due);
  const learning = ORDER.filter(s => surahState(p, s).status === "learning");
  const nextNew = ORDER.find(s => surahState(p, s).status === "new");
  $("#app").innerHTML = `
    <div class="kid-head">
      <div class="avatar" style="background:${esc(kid.color || COLORS[0])}">${esc(kid.avatar || "⭐")}</div>
      <div><h1>As-salamu alaykum, ${esc(kid.name)}!</h1>
      <div class="muted">${st.mem === SURAHS.length ? "You memorized all of Juz' 'Amma. MashaAllah!" : `${SURAHS.length - st.mem} surahs to go in Juz' 'Amma`}</div></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="v">${st.mem}<span class="muted small"> / ${SURAHS.length}</span></div><div class="l">Surahs memorized</div></div>
      <div class="stat"><div class="v">${st.ayat}</div><div class="l">Ayahs learned</div></div>
      <div class="stat"><div class="v" style="color:var(--amber)">${I.flame} ${streak(kid)}</div><div class="l">Day streak</div></div>
      <div class="stat"><div class="v" style="color:${st.due ? "var(--coral)" : "var(--green)"}">${st.due}</div><div class="l">Reviews today</div></div>
      <div class="stat"><div class="v" style="color:var(--gold)">★ ${kid.stars || 0}</div><div class="l">Stars from Hudhud</div></div>
    </div>
    <div class="bar" style="margin-top:12px" title="${Math.round(st.ayat / TOTAL_AYAT * 100)}% of Juz' 'Amma"><i style="width:${st.ayat / TOTAL_AYAT * 100}%"></i></div>
    ${dailyCard(kid, p)}
    ${due.length ? `<h2>🔁 Review today</h2><p class="small muted" style="margin-top:-6px">Recite these from memory so you don't forget them.</p><div class="list-due">${due.map(s => tile(s, p, kid)).join("")}</div>` : ""}
    ${learning.length ? `<h2>📖 Keep learning</h2><div class="path">${learning.map(s => tile(s, p, kid)).join("")}</div>` : ""}
    ${!learning.length && nextNew ? `<h2>✨ Start your next surah</h2><div class="path">${tile(nextNew, p, kid)}</div>` : ""}
    <h2>🌙 All surahs</h2>
    <div class="path">${ORDER.map(s => tile(s, p, kid)).join("")}</div>
    <h2>📒 My sticker book <span class="small muted">${ORDER.filter(s => p[s.n]?.sticker).length} / ${SURAHS.length}</span></h2>
    <p class="small muted" style="margin-top:-6px">Recite a surah from memory with Hudhud and get 3 stars to earn its sticker.</p>
    <div class="stickers">${ORDER.map(s => p[s.n]?.sticker
      ? `<div class="sticker got" title="${esc(s.en)}"><span>${STICKERS[s.n]}</span><b>${esc(s.en)}</b></div>`
      : `<div class="sticker" title="${esc(s.en)}"><span>?</span><b>${esc(s.en)}</b></div>`).join("")}</div>`;
}

/* ============ Surah page ============ */
async function saveSurah(n, data) {
  S.progress[n] = { ...(S.progress[n] || {}), ...data };
  await store.saveSurah(S.kidId, n, data);
  await markActive(kidById(S.kidId));
}
function renderSurah(s, tab) {
  setNav();
  const kid = kidById(S.kidId), st = surahState(S.progress, s);
  const chip = st.due ? `<span class="chip due">Review due</span>` : `<span class="chip ${st.status}">${st.status === "memorized" ? "Memorized" : st.status === "learning" ? `Learning ${st.known}/${st.total}` : "Not started"}</span>`;
  $("#app").innerHTML = `
    <a href="#/kid/${kid.id}" class="btn ghost sm">${I.back} All surahs</a>
    <div class="surah-head" style="margin-top:12px">
      <div class="sn-ar">سُورَةُ ${esc(s.ar)}</div>
      <div><h1 style="margin:0">${esc(s.en)}</h1><div class="muted small">${esc(s.meaning)} · Surah ${s.n} · ${s.ayat.length} ayahs</div></div>
      <div class="spacer"></div>
      <div class="row"><span id="schip">${chip}</span>${st.approved ? `<span class="chip approved">${I.star} Checked by parent</span>` : ""}
      ${st.status === "memorized" && st.nextReview ? `<span class="small muted">Next review: ${relDays(st.nextReview)}</span>` : ""}</div>
    </div>
    <div class="tabs" role="tablist">
      ${[["recite", "🐦", liveSupported() ? "Recite" : "Test"], ["memorize", I.repeat, "Memorize"], ["learn", I.book, "Listen"], ["record", I.mic, "Record"]].map(([k, ic, l]) =>
        `<button role="tab" aria-selected="${tab === k || (tab === "test" && k === "recite")}" data-tab="${k}">${ic}<span>${l}</span></button>`).join("")}
    </div>
    <div id="tabbody"></div>`;
  $$(".tabs button").forEach(b => b.onclick = () => { history.replaceState(null, "", `#/kid/${kid.id}/s/${s.n}/${b.dataset.tab}`); route(); });
  ({ recite: renderRecite, test: renderRecite, memorize: renderMemorize, learn: renderLearn, record: renderRecord }[tab] || renderRecite)(s);
}

/* ---- Check me: speech recognition word checker ---- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const _norm = new Map();
function normAr(w) {
  let v = _norm.get(w); if (v !== undefined) return v;
  v = normArRaw(w); if (_norm.size > 5000) _norm.clear(); _norm.set(w, v); return v;
}
function normArRaw(w) {
  return w.replace(AR_MARKS, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^ء-ي]/g, "");
}
const skel = w => normAr(w).replace(/[اء]/g, "");
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function sameWord(exp, heard) {
  const a = normAr(exp), b = normAr(heard);
  if (!a || !b) return false;
  if (a === b) return true;
  const x = skel(exp), y = skel(heard);
  if (x === y) return true;
  const tol = l => (l <= 3 ? 0 : l <= 6 ? 1 : 2);
  return lev(a, b) <= tol(Math.max(a.length, b.length)) && lev(x, y) <= tol(Math.max(x.length, y.length));
}
// Fuzzy LCS alignment: which expected words were heard, in order.
function alignWords(expected, heard) {
  const n = expected.length, m = heard.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    dp[i][j] = sameWord(expected[i - 1], heard[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const ok = new Array(n).fill(false);
  // Backtrack preferring the EARLIEST expected word for each heard word (so "يلد" never jumps ahead to "يولد").
  for (let i = n, j = m; i > 0 && j > 0;) {
    if (dp[i - 1][j] === dp[i][j]) i--;
    else if (sameWord(expected[i - 1], heard[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) { ok[i - 1] = true; i--; j--; }
    else j--;
  }
  return ok;
}
function expectedWords(s, from, to) {
  const out = [];
  for (let a = from; a <= to; a++) s.ayat[a - 1].a.split(/\s+/).forEach(w => { if (normAr(w)) out.push({ a, w }); });
  return out;
}
const checker = {
  rec: null, on: false, text: "",
  start(h) {
    this.cancel(); this.text = ""; this.on = true;
    const r = this.rec = new SR();
    r.lang = "ar-SA"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) this.text += " " + t; else interim += " " + t;
      }
      h.onHeard?.((this.text + interim).trim());
    };
    r.onerror = e => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      this.on = false; h.onError?.(e.error);
    };
    r.onend = () => {                        // browsers stop after pauses; keep listening until "Done"
      if (this.on) { try { r.start(); return; } catch {} }
      if (this.rec === r) { this.rec = null; h.onEnd?.(this.text.trim()); }
    };
    try { r.start(); } catch (e) { this.on = false; h.onError?.(e.message); }
  },
  stop() { this.on = false; try { this.rec?.stop(); } catch {} },
  cancel() { this.on = false; if (this.rec) { this.rec.onend = null; this.rec.onresult = null; try { this.rec.abort(); } catch {} } this.rec = null; },
};
const checkEnabled = () => settings.checkMe !== false;

// Renders a "Check me" control into el. Results are drawn into resultEl (defaults inside el).
// onDone({pass, got, total, frac}) is called after they finish reciting.
function checkPanel(el, s, from, to, { onDone, resultEl, label = "Check me", small = false } = {}) {
  if (!el || !checkEnabled()) return;
  if (!SR) { el.innerHTML = `<p class="small muted">🎤 “Check me” works in Chrome (Android, laptop) or Safari on iPhone/iPad.</p>`; return; }
  const exp = expectedWords(s, from, to), words = exp.map(x => x.w);
  el.innerHTML = `<div class="check ${small ? "small" : ""}">
      <button class="btn check-btn ${small ? "sm" : ""}" data-check>🎤 ${label}</button>
      <div class="check-status small muted"></div>
      <div class="heard" dir="rtl"></div>
      ${resultEl ? "" : `<div class="check-out"></div>`}
    </div>`;
  const btn = $("[data-check]", el), status = $(".check-status", el), heard = $(".heard", el);
  const out = resultEl || $(".check-out", el);
  const show = ok => {
    let html = "", cur = 0;
    exp.forEach((x, i) => {
      if (x.a !== cur) { if (cur) html += ` <span class="ayah-no">${arNum(cur)}</span> `; cur = x.a; }
      html += `<span class="cw ${ok[i] ? "ok" : "miss"}">${esc(x.w)}</span> `;
    });
    html += `<span class="ayah-no">${arNum(cur)}</span>`;
    const got = ok.filter(Boolean).length, total = ok.length, frac = got / total, pass = frac >= 0.9;
    out.innerHTML = `<div class="check-words">${html}</div>
      <div class="check-score ${pass ? "pass" : "fail"}">${pass ? (got === total ? "✓ Every word right! MashaAllah" : `✓ ${got} of ${total} words — great!`) : `${total - got} word${total - got > 1 ? "s" : ""} missed (in red) — ${got} of ${total} right`}</div>`;
    return { pass, got, total, frac };
  };
  const finish = text => {
    btn.innerHTML = `🎤 Check again`; btn.classList.remove("live");
    if (!text) { status.textContent = "I didn't hear anything. Tap and recite clearly, close to the device."; return; }
    status.textContent = "";
    onDone?.(show(alignWords(words, text.split(/\s+/))));
  };
  btn.onclick = () => {
    if (checker.on) { status.textContent = "Checking…"; return checker.stop(); }
    player.stop(true); heard.textContent = ""; out.innerHTML = "";
    btn.innerHTML = `${I.stop} Done reciting`; btn.classList.add("live");
    status.textContent = "Listening… recite now";
    checker.start({
      onHeard: t => {
        heard.textContent = t;
        if (alignWords(words, t.split(/\s+/)).every(Boolean)) checker.stop();   // all words heard: finish early
      },
      onEnd: finish,
      onError: err => {
        btn.innerHTML = `🎤 ${label}`; btn.classList.remove("live");
        status.textContent = err === "not-allowed" || err === "service-not-allowed"
          ? "Microphone or speech recognition is blocked. Allow it in the browser settings and try again."
          : err === "network" ? "“Check me” needs an internet connection." : `Couldn't listen (${err}). Try again.`;
      },
    });
  };
}

/* ============ Hudhud: Ello-style live recitation companion ============ */
const HUDHUD_SVG = `<svg viewBox="0 0 140 130" aria-hidden="true">
  <g class="hh-crest">
    <path d="M52 34 C40 10 46 4 50 2 C54 8 58 20 60 32Z" fill="#e8913a"/><path d="M50 2 C48 6 47 9 47 12 L52 10Z" fill="#2b2420"/>
    <path d="M60 31 C56 8 62 0 67 0 C69 8 68 20 66 31Z" fill="#f0a24a"/><path d="M67 0 C64 3 63 6 63 9 L68 8Z" fill="#2b2420"/>
    <path d="M67 32 C72 9 80 4 85 6 C83 15 77 25 72 34Z" fill="#e8913a"/><path d="M85 6 C81 7 79 10 78 12 L83 13Z" fill="#2b2420"/>
    <path d="M73 36 C86 18 95 16 99 20 C94 28 86 34 78 39Z" fill="#f0a24a"/><path d="M99 20 C95 19 92 21 91 23 L96 25Z" fill="#2b2420"/>
  </g>
  <ellipse cx="62" cy="92" rx="34" ry="28" fill="#eba765"/>
  <g class="hh-wing"><path d="M36 82 C44 70 70 72 78 86 C72 104 46 108 34 98Z" fill="#fdf6ec"/>
    <path d="M38 80 L48 104 M48 76 L58 106 M58 75 L66 105 M68 78 L74 100" stroke="#2b2420" stroke-width="6" stroke-linecap="round"/></g>
  <circle cx="66" cy="52" r="23" fill="#f1b672"/>
  <path class="hh-beak" d="M86 50 C104 48 120 54 132 66 C118 60 102 58 86 58Z" fill="#3b2a20"/>
  <circle cx="72" cy="47" r="8" fill="#fff"/><circle class="hh-pupil" cx="74" cy="47" r="4.6" fill="#2b2420"/><circle cx="75.6" cy="45.2" r="1.6" fill="#fff"/>
  <ellipse cx="58" cy="60" rx="5" ry="3.2" fill="#f28b82" opacity=".55"/>
  <path d="M54 118 l-4 8 M54 118 l2 9 M70 118 l-2 9 M70 118 l5 8" stroke="#8a5a2b" stroke-width="3" stroke-linecap="round"/>
  <g class="hh-waves"><path d="M44 40 q-8 8 0 16" fill="none" stroke="#2f6f9f" stroke-width="3" stroke-linecap="round"/><path d="M36 34 q-13 14 0 28" fill="none" stroke="#2f6f9f" stroke-width="3" stroke-linecap="round" opacity=".6"/></g>
</svg>`;
const wordAudioUrl = (s, a, w) => `https://audio.qurancdn.com/wbw/${pad3(s)}_${pad3(a)}_${pad3(w)}.mp3`;
const PRAISE = ["MashaAllah!", "Keep going!", "Beautiful!", "You're doing great!", "Nice and clear!", "SubhanAllah, well done!"];
const STICKERS = { 78: "⛰️", 79: "🌟", 80: "🍇", 81: "🌠", 82: "🌌", 83: "⚖️", 84: "🌗", 85: "✨", 86: "⭐", 87: "🌿", 88: "🐪", 89: "🌄", 90: "🛤️", 91: "☀️", 92: "🌙", 93: "🌅", 94: "💚", 95: "🫒", 96: "📖", 97: "🌃", 98: "💎", 99: "🌍", 100: "🐎", 101: "🦋", 102: "⏳", 103: "⌛", 104: "💰", 105: "🐘", 106: "🧳", 107: "🤲", 108: "🌊", 109: "🕊️", 110: "🏆", 111: "🪵", 112: "💫", 113: "🌤️", 114: "🛡️" };
const liveSupported = () => !!SR && checkEnabled();

let wordAudio = null;
function playWord(s, a, w, onEnd) {
  try { wordAudio?.pause(); } catch {}
  const au = wordAudio = new Audio(wordAudioUrl(s, a, w));
  let fell = false;
  const fallback = () => { if (fell) return; fell = true; player.play({ s, from: a, to: a, repeat: 1, rate: 1 }, null, () => onEnd?.()); };
  au.onended = () => onEnd?.(); au.onerror = fallback;
  au.play().catch(e => { if (e.name !== "AbortError") fallback(); });
}

// Live recitation with word-by-word highlighting.
// opts: { from, to, hidden, onFinish(result) }
function liveRecite(el, s, opts) {
  const from = opts.from || 1, to = opts.to || s.ayat.length;
  let hidden = !!opts.hidden;
  const ayat = [];
  for (let a = from; a <= to; a++) ayat.push({ a, words: s.ayat[a - 1].a.split(/\s+/).filter(w => normAr(w)), ok: [], helped: new Set(), tried: new Set(), done: false });
  let ci = 0, base = 0, offset = 0, frontier = 0, listening = false, lastProgress = Date.now(), hint = 0, mistakeAt = -1, praiseAt = 0, finished = false, totalHelps = 0;
  const cur = () => ayat[ci];

  el.innerHTML = `
    <div class="hh">
      <div class="hh-stage">
        <div class="hh-bird">${HUDHUD_SVG}</div>
        <div class="hh-bubble" id="hhBubble">Bismillah! Tap the microphone and recite. I'll listen to every word.</div>
      </div>
      <div class="hh-controls">
        <button class="btn big hh-mic" id="hhMic">${I.mic} Start reciting</button>
        <button class="btn secondary sm" id="hhHear" hidden>🔊 Hear this ayah</button>
        <button class="btn ghost sm" id="hhSaid" hidden>${I.check} I said it</button>
        <label class="toggle"><input type="checkbox" id="hhHide" ${hidden ? "checked" : ""}> Hide words (from memory)</label>
      </div>
      <p class="small muted hh-tip">Tap any word to hear how it's said.</p>
      <div class="mushaf hh-text ${hidden ? "hh-hidden" : ""}" id="hhText">
        ${from === 1 ? `<div class="basmala">${BASMALA}</div>` : ""}
        ${ayat.map((y, k) => `<div class="hh-ayah" id="hha${k}">${y.words.map((w, i) => `<span class="hw" data-k="${k}" data-i="${i}">${esc(w)}</span>`).join(" ")} <span class="ayah-no">${arNum(y.a)}</span></div>`).join("")}
      </div>
    </div>`;
  const bird = $(".hh-bird", el), bubble = $("#hhBubble", el), mic = $("#hhMic", el), hearB = $("#hhHear", el), saidB = $("#hhSaid", el);
  const say = (t, mood) => { bubble.textContent = t; bird.className = "hh-bird " + (mood || (listening ? "listening" : "")); bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop"); };

  function paint() {
    ayat.forEach((y, k) => {
      const box = $("#hha" + k, el); box.classList.toggle("current", k === ci && !finished); box.classList.toggle("done", y.done);
      $$(".hw", box).forEach((sp, i) => {
        let c = "hw";
        if (y.done || k < ci) c += y.ok[i] ? (y.helped.has(i) ? " helped" : " ok") : " skip";
        else if (k === ci) {
          if (i < frontier) c += y.ok[i] ? (y.helped.has(i) ? " helped" : " ok") : " skip";
          else if (i === frontier) c += " next" + (hint >= 1 ? " hint" : "") + (mistakeAt === i ? " try" : "");
        }
        if (sp.className !== c) { const wasOk = /\b(ok|helped)\b/.test(sp.className); sp.className = c; if (!wasOk && /\b(ok|helped)\b/.test(c)) sp.classList.add("popin"); }
      });
    });
  }
  function scrollToCur() { $("#hha" + ci, el)?.scrollIntoView({ block: "center", behavior: "smooth" }); }

  function onHeard(text) {
    if (finished) return;
    const hw = text.split(/\s+/).filter(Boolean), seg = hw.slice(offset), y = cur();
    const rest = y.words.slice(base);
    const n = rest.length, m = seg.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
      dp[i][j] = sameWord(rest[i - 1], seg[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const ok = new Array(n).fill(false); let lastJ = -1;
    for (let i = n, j = m; i > 0 && j > 0;) {
      if (dp[i - 1][j] === dp[i][j]) i--;
      else if (sameWord(rest[i - 1], seg[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) { ok[i - 1] = true; if (lastJ < 0) lastJ = j - 1; i--; j--; }
      else j--;
    }
    let f = 0; ok.forEach((v, i) => { if (v) f = i + 1; });
    for (let i = 0; i < n; i++) y.ok[base + i] = ok[i] || (base + i < frontier && y.ok[base + i]);
    const newFrontier = base + f;
    if (newFrontier > frontier) {
      frontier = newFrontier; lastProgress = Date.now(); hint = 0; mistakeAt = -1; hearB.hidden = true; saidB.hidden = true;
      if (frontier - praiseAt >= 6 && frontier < y.words.length) { praiseAt = frontier; say(PRAISE[Math.floor(Math.random() * PRAISE.length)], "happy"); setTimeout(() => listening && (bird.className = "hh-bird listening"), 900); }
    }
    const extra = m - 1 - lastJ;                 // words heard after the last match
    if (extra >= 2 && frontier < y.words.length && mistakeAt !== frontier) {
      mistakeAt = frontier; y.tried.add(frontier);
      say("Hmm, try that word again 🙂 Tap it to hear it.", "think");
    }
    paint();
    if (frontier >= y.words.length) ayahDone(offset + lastJ + 1);
  }

  function ayahDone(newOffset) {
    const y = cur(); y.done = true;
    const missed = y.words.length - y.ok.filter(Boolean).length;
    chime(true);
    ci++; base = 0; frontier = 0; offset = newOffset; hint = 0; mistakeAt = -1; praiseAt = 0; lastProgress = Date.now(); hearB.hidden = true; saidB.hidden = true;
    if (ci >= ayat.length) return finish();
    say(missed ? `Ayah ${y.a} done! You skipped ${missed} word${missed > 1 ? "s" : ""} (in orange). Now ayah ${cur().a}.` : `Ayah ${y.a} — perfect! ⭐ Now ayah ${cur().a}.`, "happy");
    setTimeout(() => listening && !finished && (bird.className = "hh-bird listening"), 1000);
    paint(); scrollToCur();
  }

  function startListening() {
    listening = true; base = frontier; offset = 0; lastProgress = Date.now();
    mic.innerHTML = `${I.stop} Pause`; mic.classList.add("live"); bird.className = "hh-bird listening";
    checker.start({
      onHeard,
      onEnd: () => {},
      onError: err => {
        stopListening();
        say(err === "not-allowed" || err === "service-not-allowed" ? "I can't hear you. Please allow the microphone in the browser settings." : err === "network" ? "I need the internet to listen. Check the connection." : "Oops, I couldn't listen. Tap the microphone to try again.", "think");
      },
    });
  }
  function stopListening() { listening = false; checker.cancel(); mic.innerHTML = `${I.mic} Keep reciting`; mic.classList.remove("live"); bird.className = "hh-bird"; }

  // Stuck helper
  const stuckIv = setInterval(() => {
    if (!el.isConnected) { clearInterval(stuckIv); return; }
    if (!listening || finished) return;
    const dt = Date.now() - lastProgress;
    if (dt > 4500 && hint < 1) { hint = 1; say(hidden ? "Take your time… the next word is glowing ✨" : "Need help? Tap the glowing word to hear it ✨", "think"); if (hidden) $(".hw.next", el)?.classList.add("peek"); paint(); }
    else if (dt > 9000 && hint < 2) {
      hint = 2; const y = cur(); y.helped.add(frontier); totalHelps++;
      say("Let's say it together! Listen… then you say it 👂", "think");
      hearB.hidden = false; saidB.hidden = false;
      pauseAndPlay(cb => playWord(s.n, y.a, frontier + 1, cb));
    }
  }, 500);

  function pauseAndPlay(play) {
    const was = listening; if (was) { listening = false; checker.cancel(); }
    play(() => { if (was && !finished && el.isConnected) { say("Now you say it!", "listening"); startListening(); } });
  }

  mic.onclick = () => listening ? (stopListening(), say("Paused. Tap the microphone when you're ready.")) : (startListening(), say(frontier || ci ? "I'm listening… carry on!" : "I'm listening… Bismillah!", "listening"));
  hearB.onclick = () => { const y = cur(); y.helped.add(frontier); pauseAndPlay(cb => player.play({ s: s.n, from: y.a, to: y.a, repeat: 1, rate: 1 }, null, cb)); };
  saidB.onclick = () => {           // fallback when the recognizer keeps mishearing
    const y = cur(); for (let i = frontier; i < y.words.length; i++) { y.ok[i] = true; y.helped.add(i); }
    totalHelps++; frontier = y.words.length; paint(); ayahDone(9999);
    if (listening) { checker.cancel(); startListening(); }
  };
  $("#hhHide", el).onchange = e => { hidden = e.target.checked; $("#hhText", el).classList.toggle("hh-hidden", hidden); };
  $("#hhText", el).onclick = e => {
    const w = e.target.closest(".hw"); if (!w) return;
    const k = +w.dataset.k, i = +w.dataset.i, y = ayat[k];
    if (k === ci && i >= frontier) { y.helped.add(i); }
    w.classList.add("speaking"); pauseAndPlay(cb => playWord(s.n, y.a, i + 1, () => { w.classList.remove("speaking"); cb(); }));
  };

  function finish() {
    finished = true; listening = false; checker.cancel(); clearInterval(stuckIv);
    mic.hidden = true; hearB.hidden = true; saidB.hidden = true;
    const total = ayat.reduce((t, y) => t + y.words.length, 0);
    const got = ayat.reduce((t, y) => t + y.words.filter((_, i) => y.ok[i] && !y.helped.has(i)).length, 0);
    const helps = ayat.reduce((t, y) => t + y.helped.size, 0);
    const frac = got / total;
    const stars = frac >= 0.95 && helps === 0 ? 3 : frac >= 0.85 ? 2 : 1;
    paint(); $("#hhText", el).classList.remove("hh-hidden");
    say(stars === 3 ? "You did it — every word! MashaAllah! 🎉" : stars === 2 ? "Great job! Just a few words to polish ⭐" : "Well done for finishing! Let's practice the orange words 💪", "happy");
    chime(true);
    const perAyah = new Map(ayat.map(y => [y.a, y.words.every((_, i) => y.ok[i] && !y.helped.has(i))]));
    opts.onFinish?.({ got, total, frac, helps, stars, hidden, perAyah, full: from === 1 && to === s.ayat.length });
  }
  paint();
  return { stop() { finished = true; checker.cancel(); clearInterval(stuckIv); } };
}

function starRow(n, of = 3) { return `<span class="stars">${Array.from({ length: of }, (_, i) => `<span class="${i < n ? "on" : ""}">★</span>`).join("")}</span>`; }

// Save a finished Hudhud session; returns {outcome, sticker}
async function saveRecite(s, r) {
  const kid = kidById(S.kidId), prev = S.progress[s.n] || {};
  let data = { lastRecited: Date.now(), bestStars: Math.max(prev.bestStars || 0, r.stars), updatedAt: Date.now() }, outcome = null, sticker = false;
  if (r.hidden && r.full) {
    const res = applyTest(prev, [...r.perAyah.values()].filter(Boolean).length, r.perAyah.size, true, r.perAyah);
    data = { ...res.out, ...data }; outcome = res.outcome;
    if (r.stars === 3 && !prev.sticker) { data.sticker = Date.now(); sticker = true; }
  } else if (!r.hidden) {
    const known = new Set(prev.known || []);
    if (prev.status !== "memorized") data.status = "learning";
    data.known = [...known].sort((a, b) => a - b);
  }
  await saveSurah(s.n, data);
  kid.stars = (kid.stars || 0) + r.stars;
  await store.saveKid({ id: kid.id, stars: kid.stars });
  return { outcome, sticker };
}

function renderRecite(s) {
  if (!liveSupported()) return renderTest(s);
  const kid = kidById(S.kidId), body = $("#tabbody"), st = surahState(S.progress, s);
  const startHidden = S.reciteHidden?.n === s.n ? S.reciteHidden.v : false;   // a surah always opens with its words showing
  body.innerHTML = `<div id="hhWrap"></div><div id="hhResult"></div>`;
  liveRecite($("#hhWrap"), s, {
    hidden: startHidden,
    onFinish: async r => {
      const { outcome, sticker } = await saveRecite(s, r);
      const msg = outcome === "memorized" ? "Surah memorized! It's now in your daily review." : outcome === "reviewed" ? `Review done! Next one ${relDays(S.progress[s.n].nextReview)}.` : outcome === "weak" ? "Let's practice it again tomorrow." : r.hidden ? "" : "Next time, try it with the words hidden!";
      $("#hhResult").innerHTML = `
        <div class="card" style="text-align:center;margin-top:12px">
          <div class="big-stars">${starRow(r.stars)}</div>
          <h2 style="margin:6px 0">${r.got} of ${r.total} words${r.helps ? ` · ${r.helps} with help` : ""}</h2>
          ${msg ? `<p class="muted">${msg}</p>` : ""}
          ${sticker ? `<div class="sticker-new"><span>${STICKERS[s.n]}</span><div><b>New sticker!</b><br><span class="small muted">${esc(s.en)} is in your sticker book</span></div></div>` : ""}
          <div class="row" style="justify-content:center;margin-top:10px">
            <button class="btn gold" id="again">↻ Recite again</button>
            ${!r.hidden ? `<button class="btn secondary" id="againHidden">${I.eye} Try from memory</button>` : ""}
            <a class="btn ghost" href="#/kid/${kid.id}/s/${s.n}/record">${I.mic} Record for parent</a>
          </div>
        </div>`;
      $("#hhResult").scrollIntoView({ behavior: "smooth", block: "center" });
      $("#again").onclick = () => { S.reciteHidden = { n: s.n, v: r.hidden }; renderRecite(s); };
      $("#againHidden") && ($("#againHidden").onclick = () => { S.reciteHidden = { n: s.n, v: true }; renderRecite(s); });
    },
  });
  $("#hhHide").addEventListener("change", e => { S.reciteHidden = { n: s.n, v: e.target.checked }; });
}

/* ---- Memorize: repeat each ayah N times (default 20); the last time is from memory ---- */
function renderMemorize(s) {
  const kid = kidById(S.kidId), N = s.ayat.length, REPS = settings.reps || 20;
  const pr = () => S.progress[s.n] || {};
  const known = () => new Set(pr().known || []);
  const range = Array.from({ length: N }, (_, i) => i + 1);
  let a = (S.memoAyah || {})[s.n] || range.find(i => !known().has(i)) || 1;
  let count = Math.min((pr().memo || {})[a] || 0, REPS - 1);
  let auto = S.memoAuto ?? true;
  const body = $("#tabbody");

  const saveCount = () => {
    const memo = { ...(pr().memo || {}), [a]: count };
    saveSurah(s.n, { memo, status: pr().status === "memorized" ? "memorized" : "learning", updatedAt: Date.now() }).catch(console.error);
  };
  const playAyah = (onEnd) => player.play({ s: s.n, from: a, to: a, repeat: 1, rate: 1, basmala: false }, () => $(".memo-ayah")?.classList.add("playing"),
    () => { $(".memo-ayah")?.classList.remove("playing"); onEnd?.(); });
  const pickAyah = n => { a = n; S.memoAyah = { ...(S.memoAyah || {}), [s.n]: a }; count = known().has(a) ? 0 : Math.min((pr().memo || {})[a] || 0, REPS - 1); player.stop(true); draw(); };
  const header = () => `
    <div class="row" style="margin-bottom:10px">
      <label class="small muted" style="font-weight:800">Ayah
        <select id="mpick" style="width:auto;min-height:38px;padding:4px 10px">${range.map(n => `<option value="${n}" ${n === a ? "selected" : ""}>${n}${known().has(n) ? " ✓" : ""}</option>`).join("")}</select></label>
      <span class="spacer"></span>
      <span class="small muted"><b>${known().size}</b> of ${N} ayahs saved</span>
    </div>`;

  function draw() {
    if (count < REPS - 1) {
      body.innerHTML = `
        <div class="card memo-card">
          ${header()}
          <div class="memo-ring">${ring(count / REPS, 96, `${count}/${REPS}`)}</div>
          <p class="muted" style="margin:6px 0 2px">${count === 0 ? `Listen, then say ayah ${a} out loud. You'll repeat it ${REPS} times.` : `Repeat ${count + 1} of ${REPS} — say it out loud`}</p>
          <p class="small muted" style="margin:0">Repeat ${REPS} is from your head, with the words hidden.</p>
          <div class="memo-ayah"><div class="text">${ayahHtml(s, a)}</div></div>
          <button class="btn big memo-go" id="said">${I.check} I said it</button>
          <div id="mcheck" style="margin-top:10px"></div>
          <div class="row" style="justify-content:center;margin-top:12px">
            <button class="btn secondary sm" id="mlisten">${I.play} Listen</button>
            <label class="toggle"><input type="checkbox" id="mauto" ${auto ? "checked" : ""}> Play the reciter before each repeat</label>
          </div>
          <div class="memo-dots">${Array.from({ length: REPS }, (_, i) => `<i class="${i < count ? "ok" : i === count ? "cur" : ""}${i === REPS - 1 ? " last" : ""}"></i>`).join("")}</div>
        </div>`;
      $("#said").onclick = () => {
        player.stop(true); count++; saveCount();
        if (count === REPS - 1) { chime(true); return draw(); }
        draw(); if (auto) playAyah();
      };
      $("#mlisten").onclick = () => playAyah();
      checkPanel($("#mcheck"), s, a, a, { small: true, onDone: r => {
        if (r.pass) { toast("✓ Correct! That counts as a repeat"); setTimeout(() => $("#said")?.click(), 1100); }
      } });
      $("#mauto").onchange = e => { auto = S.memoAuto = e.target.checked; };
    } else {
      body.innerHTML = `
        <div class="card memo-card">
          ${header()}
          <div class="memo-ring">${ring((REPS - 1) / REPS, 96, `${REPS}/${REPS}`)}</div>
          <h2 style="margin:6px 0">Last time — from your head! 🧠</h2>
          <p class="muted">Say ayah ${a} out loud without looking. Then check yourself.</p>
          ${a > 1 ? `<div class="small muted">Before it:</div><div class="prev-ayah">${ayahHtml(s, a - 1)}</div>` : ""}
          <div class="hidden-ayah" id="mhid"><div><div style="font-size:1.3rem;font-weight:900">Ayah ${a}</div><div id="mhint"></div></div></div>
          <div id="mcheck2" style="margin-bottom:10px"></div>
          <div class="row" style="justify-content:center" id="macts">
            <button class="btn ghost" id="mhintb">Hint: first word</button>
            <button class="btn gold big" id="mrev">${I.eye} I said it — show me</button>
          </div>
        </div>`;
      $("#mhintb").onclick = () => { $("#mhint").innerHTML = `<div class="hint-word">${esc(s.ayat[a - 1].a.split(" ")[0])} …</div>`; $("#mhintb").disabled = true; };
      $("#mrev").onclick = () => {
        $("#mhid").innerHTML = `<div class="text">${ayahHtml(s, a)}</div>`;
        $("#macts").innerHTML = `
          <button class="btn coral" id="mmiss">${I.x} I made a mistake</button>
          <button class="btn" id="mok">${I.check} I got it right</button>`;
        $("#mok").onclick = gotIt;
        $("#mmiss").onclick = missed;
      };
      checkPanel($("#mcheck2"), s, a, a, { resultEl: $("#mhid"), label: "Check me from memory", onDone: r => {
        if (r.pass) { setTimeout(gotIt, 1300); return; }
        $("#macts").innerHTML = `
          <button class="btn coral" id="mmiss">${I.repeat} 5 more repeats</button>
          <button class="btn ghost sm" id="mok">The app heard me wrong — I got it</button>`;
        $("#mok").onclick = gotIt; $("#mmiss").onclick = missed;
      } });
    }
    $("#mpick").onchange = e => pickAyah(+e.target.value);
  }

  async function gotIt() {
    checker.cancel();
    const k = known(); k.add(a); count = REPS;
    await saveSurah(s.n, { known: [...k].sort((x, y) => x - y), memo: { ...(pr().memo || {}), [a]: REPS }, status: pr().status === "memorized" ? "memorized" : "learning", updatedAt: Date.now() });
    chime(true); done();
  }
  function missed() { checker.cancel(); count = Math.max(0, REPS - 6); saveCount(); toast("No problem — 5 more repeats, then try again 💪"); draw(); if (auto) playAyah(); }
  function done() {
    const k = known(), next = range.find(i => i > a && !k.has(i)) || range.find(i => !k.has(i));
    body.innerHTML = `
      <div class="card memo-card">
        <div class="confetti">🎉</div>
        <h2 style="margin:4px 0">Ayah ${a} is saved in your heart!</h2>
        <p class="muted">${k.size} of ${N} ayahs of ${esc(s.en)} done.</p>
        <div class="row" style="justify-content:center;margin-top:8px">
          ${next ? `<button class="btn gold big" id="mnext">Next: ayah ${next} →</button>` : ""}
          ${!next ? `<a class="btn gold big" href="#/kid/${kid.id}/s/${s.n}/test">${I.eye} Test the whole surah</a>` : ""}
          <a class="btn ghost" href="#/kid/${kid.id}">All surahs</a>
        </div>
        ${next && k.size > 1 ? `<p class="small muted" style="margin-top:12px">Tip: before the next ayah, say all the ayahs you've saved so far in a row.</p>` : ""}
        ${!next ? `<p class="small muted" style="margin-top:12px">You saved every ayah! Test the whole surah to mark it memorized.</p>` : ""}
      </div>`;
    $("#mnext") && ($("#mnext").onclick = () => { pickAyah(next); if (auto) playAyah(); });
  }
  draw();
}

/* ---- Listen & learn ---- */
function ayahHtml(s, i, opts = {}) {
  const ay = s.ayat[i - 1];
  return `${esc(ay.a)} <span class="ayah-no">${arNum(i)}</span>`;
}
function renderLearn(s) {
  const kid = kidById(S.kidId);
  const known = new Set(S.progress[s.n]?.known || []);
  const ui = Object.assign({ from: 1, to: s.ayat.length, repeat: 3, loop: false, rate: 1, meaning: false, hide: false }, S.learnUi?.[s.n] || {});
  const keep = () => { S.learnUi = { ...(S.learnUi || {}), [s.n]: ui }; };
  const opt = (n, sel) => `<option value="${n}" ${n === sel ? "selected" : ""}>${n}</option>`;
  const range = Array.from({ length: s.ayat.length }, (_, i) => i + 1);
  $("#tabbody").innerHTML = `
    <div class="sticky-player">
      <div class="controls">
        <button class="btn" id="playall" style="min-width:120px">${I.play} Play</button>
        <label>From<select id="from">${range.map(n => opt(n, ui.from)).join("")}</select></label>
        <label>To<select id="to">${range.map(n => opt(n, ui.to)).join("")}</select></label>
        <label>Repeat each<select id="rep">${[1, 2, 3, 5, 7, 10].map(n => `<option value="${n}" ${n === ui.repeat ? "selected" : ""}>${n}×</option>`).join("")}</select></label>
        <label>Speed<select id="rate">${[0.75, 1, 1.25].map(n => `<option value="${n}" ${n === ui.rate ? "selected" : ""}>${n}×</option>`).join("")}</select></label>
        <label>Reciter<select id="reciter">${RECITERS.map(r => `<option value="${r.id}" ${r.id === reciter() ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>
      </div>
      <div class="row" style="margin-top:10px;gap:18px">
        <label class="toggle"><input type="checkbox" id="loop" ${ui.loop ? "checked" : ""}> ${I.repeat} Loop</label>
        <label class="toggle"><input type="checkbox" id="meaning" ${ui.meaning ? "checked" : ""}> Meaning</label>
        <label class="toggle"><input type="checkbox" id="hide" ${ui.hide ? "checked" : ""}> ${I.eye} Hide words (tap to peek)</label>
      </div>
    </div>
    <div class="mushaf ${ui.hide ? "hide-text" : ""}" id="mushaf">
      <div class="basmala">${BASMALA}</div>
      ${s.ayat.map((ay, k) => { const i = k + 1; return `
        <div class="ayah" id="ay${i}" data-i="${i}">
          <div class="side">
            <button class="play-btn" data-play="${i}" aria-label="Play ayah ${i}">${I.play}</button>
            <button class="known-btn ${known.has(i) ? "on" : ""}" data-known="${i}" aria-pressed="${known.has(i)}" title="I know this ayah">${I.check}</button>
          </div>
          <div>
            <div class="text" data-peek="${i}">${ayahHtml(s, i)}</div>
            ${ui.meaning ? `<div class="meaning">${i}. ${esc(ay.e)}</div>` : ""}
          </div>
        </div>`; }).join("")}
    </div>
    <button class="fab" id="fab" hidden aria-label="Stop">${I.stop}</button>
    <div class="card" style="margin-top:14px;text-align:center">
      <div class="row" style="justify-content:center">
        <span class="muted"><b id="kcount">${known.size}</b> of ${s.ayat.length} ayahs marked ✓</span>
        <a class="btn gold" href="#/kid/${kid.id}/s/${s.n}/test">${I.eye} Test myself</a>
      </div>
      <p class="small muted" style="margin:10px 0 0">Tip: listen to one ayah 5–7 times, say it with the reciter, then say it alone. Tick ✓ when you can say it without looking.</p>
    </div>`;

  const setPlaying = a => {
    $$(".ayah.playing").forEach(e => e.classList.remove("playing"));
    if (a > 0) { const el = $("#ay" + a); if (el) { el.classList.add("playing"); el.scrollIntoView({ block: "center", behavior: "smooth" }); } }
  };
  const btn = $("#playall");
  const fab = $("#fab"); fab.onclick = () => player.stop();
  const onStop = () => { btn.innerHTML = `${I.play} Play`; setPlaying(-1); fab.hidden = true; };
  const start = (from, to) => {
    player.play({ s: s.n, from, to, repeat: ui.repeat, loop: ui.loop, rate: ui.rate, basmala: true }, setPlaying, onStop);
    btn.innerHTML = `${I.stop} Stop`; fab.hidden = false;
    markActive(kid);
  };
  btn.onclick = () => player.playing ? player.stop() : start(ui.from, Math.max(ui.from, ui.to));
  $("#from").onchange = e => { ui.from = +e.target.value; if (ui.to < ui.from) { ui.to = ui.from; $("#to").value = ui.to; } keep(); };
  $("#to").onchange = e => { ui.to = +e.target.value; if (ui.to < ui.from) { ui.from = ui.to; $("#from").value = ui.from; } keep(); };
  $("#rep").onchange = e => { ui.repeat = +e.target.value; keep(); };
  $("#rate").onchange = e => { ui.rate = +e.target.value; if (player.audio) player.audio.playbackRate = ui.rate; player.opts && (player.opts.rate = ui.rate); keep(); };
  $("#loop").onchange = e => { ui.loop = e.target.checked; if (player.opts) player.opts.loop = ui.loop; keep(); };
  $("#reciter").onchange = async e => { settings.reciter = e.target.value; player.stop(); await store.saveSettings({ reciter: settings.reciter }); };
  $("#meaning").onchange = e => { ui.meaning = e.target.checked; keep(); player.stop(); renderLearn(s); };
  $("#hide").onchange = e => { ui.hide = e.target.checked; keep(); $("#mushaf").classList.toggle("hide-text", ui.hide); };
  $("#mushaf").onclick = async e => {
    const pb = e.target.closest("[data-play]"), kb = e.target.closest("[data-known]"), tx = e.target.closest("[data-peek]");
    if (pb) { const i = +pb.dataset.play; start(i, i); }
    else if (kb) {
      const i = +kb.dataset.known; known.has(i) ? known.delete(i) : known.add(i);
      kb.classList.toggle("on", known.has(i)); kb.setAttribute("aria-pressed", known.has(i));
      $("#kcount").textContent = known.size;
      const cur = S.progress[s.n] || {};
      await saveSurah(s.n, { known: [...known].sort((a, b) => a - b), status: cur.status === "memorized" ? "memorized" : "learning", updatedAt: Date.now() });
      if (known.size === s.ayat.length && cur.status !== "memorized") toast("All ayahs ticked! Now test yourself 🌟");
    } else if (tx && ui.hide) tx.closest(".ayah").classList.toggle("peek");
  };
}

/* ---- Test myself ---- */
function applyTest(prev, got, total, full, results) {
  const now = Date.now();
  const known = new Set(prev.known || []);
  results.forEach((ok, i) => ok ? known.add(i) : known.delete(i));
  const out = { known: [...known].sort((a, b) => a - b), updatedAt: now };
  const hist = [...(prev.history || []), { t: now, got, total, kind: prev.status === "memorized" ? "review" : full ? "test" : "part" }].slice(-30);
  out.history = hist; out.lastTest = now; out.lastScore = Math.round(got / total * 100);
  if (!full) { if (prev.status !== "memorized") out.status = "learning"; return { out, outcome: "part" }; }
  const pass = got / total >= 0.9;
  if (prev.status !== "memorized") {
    if (pass) Object.assign(out, { status: "memorized", memorizedAt: now, step: 0, nextReview: now + INTERVALS[0] * DAY, weak: false });
    else out.status = "learning";
    return { out, outcome: pass ? "memorized" : "keep" };
  }
  if (pass) { const step = Math.min((prev.step || 0) + 1, INTERVALS.length - 1); Object.assign(out, { step, nextReview: now + INTERVALS[step] * DAY, weak: false }); }
  else Object.assign(out, { step: 0, nextReview: now + DAY, weak: true });
  out.lastReview = now;
  return { out, outcome: pass ? "reviewed" : "weak" };
}
function renderTest(s) {
  const kid = kidById(S.kidId), body = $("#tabbody"), N = s.ayat.length;
  const st = surahState(S.progress, s);
  let from = 1, to = N;
  const range = Array.from({ length: N }, (_, i) => i + 1);
  body.innerHTML = `
    <div class="card test-wrap test-card">
      <h2 style="margin-top:0">${st.due ? "Review time 🔁" : "Test yourself"}</h2>
      <p class="muted">Recite each ayah out loud from memory. Then reveal it and be honest: did you get it right?</p>
      <div class="controls" style="justify-content:center;margin:12px 0">
        <label>From ayah<select id="tf">${range.map(n => `<option>${n}</option>`).join("")}</select></label>
        <label>To ayah<select id="tt">${range.map(n => `<option ${n === N ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      </div>
      <p class="small muted" id="rangeNote">Whole surah — passing (90% or more) marks it memorized.</p>
      <button class="btn big gold" id="go">${I.play} Start</button>
    </div>`;
  const note = () => { $("#rangeNote").textContent = from === 1 && to === N ? "Whole surah — passing (90% or more) marks it memorized." : "Part of the surah — practice only. Test the whole surah to mark it memorized."; };
  $("#tf").onchange = e => { from = +e.target.value; if (to < from) { to = from; $("#tt").value = to; } note(); };
  $("#tt").onchange = e => { to = +e.target.value; if (to < from) { from = to; $("#tf").value = from; } note(); };
  $("#go").onclick = () => run();

  function run() {
    const results = {}; let i = from;
    const step = () => {
      const revealed = { v: false };
      const dots = range.slice(from - 1, to).map(n => `<i class="${n === i ? "cur" : results[n] === true ? "ok" : results[n] === false ? "miss" : ""}"></i>`).join("");
      body.innerHTML = `
        <div class="card test-wrap test-card">
          <div class="test-progress">${dots}</div>
          ${i > 1 ? `<div class="small muted">Before it:</div><div class="prev-ayah">${ayahHtml(s, i - 1)}</div>` : `<div class="prev-ayah">${BASMALA}</div>`}
          <div class="hidden-ayah" id="hid"><div><div style="font-size:1.3rem;font-weight:900">Ayah ${i}</div><div class="muted small">Say it out loud now</div><div id="hint"></div></div></div>
          <div id="tcheck" style="margin-bottom:10px"></div>
          <div class="row" style="justify-content:center" id="acts">
            <button class="btn ghost" id="hintb">Hint: first word</button>
            <button class="btn" id="rev">${I.eye} Show ayah</button>
          </div>
        </div>
        <p class="small muted" style="text-align:center">${i - from + 1} of ${to - from + 1}</p>`;
      $("#hintb").onclick = () => { $("#hint").innerHTML = `<div class="hint-word">${esc(s.ayat[i - 1].a.split(" ")[0])} …</div>`; $("#hintb").disabled = true; results["h" + i] = true; };
      $("#rev").onclick = () => {
        $("#hid").innerHTML = `<div class="text">${ayahHtml(s, i)}</div>`;
        $("#acts").innerHTML = `
          <button class="btn ghost sm" id="lis">${I.play} Listen</button>
          <button class="btn coral" id="miss">${I.x} I missed it</button>
          <button class="btn" id="ok">${I.check} I got it</button>`;
        $("#lis").onclick = () => player.play({ s: s.n, from: i, to: i, repeat: 1, rate: 1 });
        $("#ok").onclick = () => next(true);
        $("#miss").onclick = () => next(false);
      };
      checkPanel($("#tcheck"), s, i, i, { resultEl: $("#hid"), onDone: r => {
        if (r.pass) { setTimeout(() => next(true), 1300); return; }
        $("#acts").innerHTML = `
          <button class="btn ghost sm" id="lis">${I.play} Listen</button>
          <button class="btn coral" id="miss">${I.x} I missed it</button>
          <button class="btn ghost sm" id="ok">The app heard me wrong — I got it</button>`;
        $("#lis").onclick = () => player.play({ s: s.n, from: i, to: i, repeat: 1, rate: 1 });
        $("#ok").onclick = () => next(true); $("#miss").onclick = () => next(false);
      } });
    };
    const next = ok => { player.stop(true); checker.cancel(); results[i] = ok; i++; i > to ? finish() : step(); };
    const finish = async () => {
      const keys = range.slice(from - 1, to);
      const got = keys.filter(n => results[n]).length, total = keys.length;
      const res = new Map(keys.map(n => [n, !!results[n]]));
      const { out, outcome } = applyTest(S.progress[s.n] || {}, got, total, from === 1 && to === N, res);
      await saveSurah(s.n, out);
      const ns = surahState(S.progress, s);
      $("#schip").innerHTML = ns.status === "memorized" ? `<span class="chip memorized">Memorized</span>` : `<span class="chip learning">Learning ${ns.known}/${ns.total}</span>`;
      const missed = keys.filter(n => !results[n]);
      const msg = {
        memorized: ["🎉", "MashaAllah! You memorized it!", "Come back tomorrow for a quick review so it stays strong."],
        reviewed: ["🌟", "Great review!", `Next review ${relDays(out.nextReview)}.`],
        weak: ["💪", "Good effort — let's strengthen it", "Practice the missed ayahs today. We'll review again tomorrow."],
        keep: ["📖", "Almost there!", "Practice the missed ayahs, then test again."],
        part: ["👍", "Nice practice!", "When you're ready, test the whole surah."],
      }[outcome];
      body.innerHTML = `
        <div class="card test-wrap test-card">
          <div class="confetti">${msg[0]}</div>
          <div class="result-big">${got} / ${total}</div>
          <h2 style="margin:6px 0">${msg[1]}</h2>
          <p class="muted">${msg[2]}</p>
          ${missed.length ? `<p class="small">Ayahs to practice: <b>${missed.join(", ")}</b></p>` : ""}
          <div class="row" style="justify-content:center;margin-top:10px">
            ${missed.length ? `<a class="btn secondary" href="#/kid/${kid.id}/s/${s.n}/learn">${I.book} Practice</a>` : ""}
            <a class="btn gold" href="#/kid/${kid.id}/s/${s.n}/record">${I.mic} Record for parent</a>
            <a class="btn ghost" href="#/kid/${kid.id}">All surahs</a>
          </div>
        </div>`;
    };
    step();
  }
}

/* ---- Record ---- */
const recorder = {
  mr: null, stream: null, chunks: [], t0: 0, tick: null,
  cancel() { clearInterval(this.tick); if (this.mr && this.mr.state !== "inactive") { this.mr.onstop = null; this.mr.stop(); } this.stream?.getTracks().forEach(t => t.stop()); this.mr = null; this.stream = null; },
};
function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"])
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
  return "";
}
async function recordingList(el, list, { parent = false } = {}) {
  if (!list.length) { el.innerHTML = `<p class="muted small">No recordings yet.</p>`; return; }
  el.innerHTML = list.map(r => {
    const s = byN[r.surah]; const kid = kidById(r.kidId);
    return `<div class="rec-item" data-id="${r.id}">
      <div style="min-width:150px">
        ${parent ? `<div class="who">${esc(kid?.avatar || "")} ${esc(kid?.name || r.kidName || "")}</div>` : ""}
        <div><b>${esc(s?.en || r.surah)}</b> <span class="ar" style="color:var(--green)">${esc(s?.ar || "")}</span></div>
        <div class="small muted">${fmtDateTime(r.createdAt)} · ${fmtDur(r.duration || 0)}</div>
      </div>
      <button class="btn secondary sm" data-load="${r.id}">${I.play} Play</button>
      <span class="row" style="gap:6px">${r.heard ? `<span class="chip memorized">Heard</span>` : parent ? `<span class="chip due">New</span>` : ""}${r.stars ? `<span class="chip approved">${"★".repeat(r.stars)}</span>` : ""}</span>
      ${parent ? `<span class="spacer"></span>
        <span class="row" style="gap:4px">${[1, 2, 3].map(n => `<button class="btn ghost sm" data-star="${n}" title="${n} star${n > 1 ? "s" : ""}" style="${(r.stars || 0) >= n ? "color:var(--gold)" : ""}">${I.star}</button>`).join("")}</span>
        <button class="btn ghost sm" data-del="${r.id}" title="Delete">${I.x}</button>
        <div style="width:100%;display:flex;gap:8px"><input type="text" data-note="${r.id}" placeholder="Note for your child (e.g. watch the madd in ayah 3)" value="${esc(r.note || "")}"><button class="btn sm" data-savenote="${r.id}">Save</button></div>`
      : r.note ? `<div class="note">💬 ${esc(r.note)}</div>` : ""}
    </div>`;
  }).join("");
  el.onclick = async e => {
    const item = e.target.closest(".rec-item"); if (!item) return;
    const id = item.dataset.id, r = list.find(x => x.id === id);
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.load) {
      b.disabled = true; b.textContent = "Loading…";
      try {
        const blob = await store.getRecordingBlob(id);
        const au = document.createElement("audio"); au.controls = true; au.src = URL.createObjectURL(blob);
        b.replaceWith(au); au.play().catch(() => {});
        if (parent && !r.heard) { r.heard = true; await store.updateRecording(id, { heard: true }); }
      } catch (err) { b.disabled = false; b.textContent = "Retry"; toast("Couldn't load recording"); }
    } else if (b.dataset.star) {
      const n = +b.dataset.star; r.stars = r.stars === n ? 0 : n;
      await store.updateRecording(id, { stars: r.stars, heard: true }); r.heard = true;
      recordingList(el, list, { parent }); toast(r.stars ? `Gave ${r.stars} star${r.stars > 1 ? "s" : ""}` : "Stars removed");
    } else if (b.dataset.savenote) {
      r.note = $(`[data-note="${id}"]`, el).value.trim(); await store.updateRecording(id, { note: r.note }); toast("Note saved");
    } else if (b.dataset.del) {
      if (!confirm("Delete this recording?")) return;
      await store.deleteRecording(id); list.splice(list.indexOf(r), 1); recordingList(el, list, { parent });
    }
  };
}
async function renderRecord(s) {
  const kid = kidById(S.kidId), body = $("#tabbody");
  const canRec = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  let show = S.recShow ?? false;
  body.innerHTML = `
    <div class="card rec-panel">
      <h2 style="margin-top:0">Record your recitation</h2>
      <p class="muted">Recite the whole surah from memory. Your parent will listen and leave you stars and notes.</p>
      ${canRec ? `<button class="rec-dot" id="recb" aria-label="Start recording">${I.mic}</button>
        <div class="timer" id="timer">0:00</div>
        <div id="recmsg" class="small muted">Tap the red button to start</div>
        <div id="preview" style="margin-top:12px"></div>`
      : `<div class="banner warn">This browser can't record audio. Try Chrome or Safari on a phone or tablet.</div>`}
      <label class="toggle" style="margin-top:14px"><input type="checkbox" id="showtxt" ${show ? "checked" : ""}> Show the words while I recite</label>
    </div>
    <div id="rtext"></div>
    <h2>My recordings of ${esc(s.en)}</h2>
    <div class="rec-list" id="recs"><p class="muted small">Loading…</p></div>`;
  const drawText = () => {
    $("#rtext").innerHTML = show ? `<div class="mushaf" style="margin-top:12px"><div class="basmala">${BASMALA}</div>${s.ayat.map((_, k) => `<div class="ayah" style="grid-template-columns:1fr"><div class="text">${ayahHtml(s, k + 1)}</div></div>`).join("")}</div>` : "";
  };
  drawText();
  $("#showtxt").onchange = e => { show = S.recShow = e.target.checked; drawText(); };
  const load = async () => recordingList($("#recs"), (await store.listRecordings(kid.id)).filter(r => r.surah === s.n));
  load();
  if (!canRec) return;

  const btn = $("#recb");
  btn.onclick = async () => {
    if (recorder.mr && recorder.mr.state === "recording") { recorder.mr.stop(); return; }
    $("#preview").innerHTML = "";
    try { recorder.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { $("#recmsg").textContent = "Microphone permission is needed. Allow it in the browser and try again."; return; }
    const mime = pickMime();
    recorder.mr = new MediaRecorder(recorder.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
    recorder.chunks = [];
    recorder.mr.ondataavailable = e => e.data.size && recorder.chunks.push(e.data);
    recorder.mr.onstop = () => {
      clearInterval(recorder.tick); recorder.stream.getTracks().forEach(t => t.stop());
      const dur = (Date.now() - recorder.t0) / 1000;
      const blob = new Blob(recorder.chunks, { type: recorder.mr.mimeType || mime || "audio/webm" });
      btn.classList.remove("live"); btn.innerHTML = I.mic; $("#recmsg").textContent = "Listen back. Happy with it?";
      const url = URL.createObjectURL(blob);
      $("#preview").innerHTML = `<audio controls src="${url}" style="width:100%;max-width:420px"></audio>
        <div class="row" style="justify-content:center;margin-top:10px">
          <button class="btn ghost" id="redo">Try again</button>
          <button class="btn" id="save">${I.check} Save for parent</button></div>`;
      $("#redo").onclick = () => { $("#preview").innerHTML = ""; $("#timer").textContent = "0:00"; $("#recmsg").textContent = "Tap the red button to start"; };
      $("#save").onclick = async () => {
        $("#save").disabled = true; $("#save").textContent = "Saving…";
        try {
          await store.saveRecording({ kidId: kid.id, kidName: kid.name, surah: s.n, duration: Math.round(dur), heard: false, stars: 0, note: "" }, blob);
          await markActive(kid);
          $("#preview").innerHTML = `<div class="banner">Saved! ${store.mode === "cloud" ? "Your parent can listen now." : "Your parent can listen on this device."} 🌟</div>`;
          $("#timer").textContent = "0:00"; $("#recmsg").textContent = "Tap the red button to record again";
          load();
        } catch (e) { console.error(e); $("#save").disabled = false; $("#save").textContent = "Retry save"; toast("Couldn't save: " + (e.message || e)); }
      };
    };
    recorder.mr.start(1000); recorder.t0 = Date.now();
    btn.classList.add("live"); btn.innerHTML = I.stop; $("#recmsg").textContent = "Recording… tap to stop";
    recorder.tick = setInterval(() => {
      const t = (Date.now() - recorder.t0) / 1000; $("#timer").textContent = fmtDur(t);
      if (t >= 600) { recorder.mr.stop(); toast("Stopped at 10 minutes"); }
    }, 250);
  };
}

/* ============ Daily 30-minute review ============ */
const goalSecs = kid => (kid.goalMin || 30) * 60;
const todaySecs = kid => (kid.minutes || {})[dayKey()] || 0;
const reminderTime = kid => kid.reminderTime || "17:00";
const reminderOn = kid => kid.reminderOn !== false;
const fmtTime12 = hhmm => { const [h, m] = hhmm.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };

async function addSeconds(kid, secs) {
  if (secs <= 0) return;
  const m = { ...(kid.minutes || {}) }; const k = dayKey();
  m[k] = Math.round((m[k] || 0) + secs);
  const keys = Object.keys(m).sort(); while (keys.length > 60) delete m[keys.shift()];
  kid.minutes = m;
  await store.saveKid({ id: kid.id, minutes: m });
}

// Counts only real practice time: page visible, not paused, and some activity in the last 3 minutes
// (a tap, a key, or recitation audio playing).
const dailyTimer = {
  kid: null, unsaved: 0, secs: 0, iv: null, paused: false, lastAct: 0, onTick: null,
  start(kid, onTick) {
    this.stop(); this.kid = kid; this.secs = todaySecs(kid); this.unsaved = 0; this.paused = false; this.lastAct = Date.now(); this.onTick = onTick;
    this._act = () => { this.lastAct = Date.now(); };
    ["pointerdown", "keydown"].forEach(e => document.addEventListener(e, this._act));
    this.iv = setInterval(() => {
      if (player.playing) this.lastAct = Date.now();
      const idle = Date.now() - this.lastAct > 180000;
      const active = !this.paused && !idle && document.visibilityState === "visible";
      if (active) { this.secs++; this.unsaved++; }
      if (this.unsaved >= 20) this.flush();
      this.onTick?.(this.secs, active, idle);
    }, 1000);
  },
  flush() { const s = this.unsaved; this.unsaved = 0; if (this.kid && s) addSeconds(this.kid, s).catch(console.error); },
  stop() {
    if (!this.iv) return;
    clearInterval(this.iv); this.iv = null; this.flush();
    ["pointerdown", "keydown"].forEach(e => document.removeEventListener(e, this._act));
  },
};
window.addEventListener("pagehide", () => dailyTimer.flush());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") dailyTimer.flush(); });

function ring(frac, size = 74, label = "") {
  const r = size / 2 - 7, c = 2 * Math.PI * r, f = Math.min(1, frac);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--sand-2)" stroke-width="8"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${f >= 1 ? "var(--gold)" : "var(--green-2)"}" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" font-weight="900" font-size="${size / 4.4}" fill="var(--ink)">${label}</text></svg>`;
}
function dailyQueue(p) {
  const mem = ORDER.filter(s => surahState(p, s).status === "memorized");
  const due = mem.filter(s => surahState(p, s).due);
  const rest = mem.filter(s => !surahState(p, s).due).sort((a, b) => (p[a.n]?.lastRecited || 0) - (p[b.n]?.lastRecited || 0));
  const learning = ORDER.filter(s => surahState(p, s).status === "learning");
  return { review: [...due, ...rest], learning };
}
function dailyCard(kid, p) {
  const done = todaySecs(kid), goal = goalSecs(kid), min = Math.floor(done / 60), gm = goal / 60;
  const { review } = dailyQueue(p);
  const met = done >= goal;
  return `<div class="card daily-card ${met ? "met" : ""}">
    ${ring(done / goal, 78, `${min}/${gm}`)}
    <div style="flex:1;min-width:180px">
      <h3 style="margin:0 0 2px">${met ? "✅ Daily review done today!" : `☀️ Daily review — ${gm} minutes`}</h3>
      <div class="small muted">${review.length
        ? (met ? "MashaAllah! You can keep going for extra reward." : `Go through your ${review.length} saved surah${review.length > 1 ? "s" : ""}. ${min ? `${gm - min} minutes left.` : ""}`)
        : "Memorize your first surah, then review it here every day. Today, practice your current surah."}</div>
      ${reminderOn(kid) ? `<div class="small muted" style="margin-top:2px">⏰ Reminder every day at ${fmtTime12(reminderTime(kid))}</div>` : ""}
    </div>
    <a class="btn ${met ? "secondary" : "gold"} big" href="#/kid/${kid.id}/daily">${I.play} ${met ? "Keep going" : min ? "Continue" : "Start"}</a>
  </div>`;
}

function applyDaily(prev, rating) {
  const now = Date.now();
  const out = { lastRecited: now, updatedAt: now, history: [...(prev.history || []), { t: now, kind: "daily", rating }].slice(-30) };
  const due = prev.nextReview && prev.nextReview <= endOfToday();
  if (rating === "smooth") {
    if (due) { const step = Math.min((prev.step || 0) + 1, INTERVALS.length - 1); Object.assign(out, { step, nextReview: now + INTERVALS[step] * DAY, weak: false, lastReview: now }); }
  } else if (rating === "some") {
    if (due) Object.assign(out, { nextReview: now + DAY, lastReview: now });
  } else Object.assign(out, { step: 0, nextReview: now + DAY, weak: true, lastReview: now });
  return out;
}

function renderDaily() {
  setNav();
  const kid = kidById(S.kidId), p = S.progress, goal = goalSecs(kid);
  let { review, learning } = dailyQueue(p);
  const queue = review.length ? review : learning.length ? learning.slice(0, 1) : [ORDER.find(s => surahState(p, s).status === "new") || ORDER[0]];
  const reviewMode = review.length > 0;
  let idx = 0, round = 1, show = false, celebrated = todaySecs(kid) >= goal;

  $("#app").innerHTML = `
    <a href="#/kid/${kid.id}" class="btn ghost sm">${I.back} Home</a>
    <div class="card daily-top">
      <div id="dring"></div>
      <div style="flex:1;min-width:160px">
        <h2 style="margin:0">Daily review</h2>
        <div class="timer" id="dtime">0:00</div>
        <div class="small muted" id="dstate">Timer runs while you practice</div>
      </div>
      <button class="btn ghost" id="dpause">Pause</button>
    </div>
    <div id="dgoal"></div>
    <div id="dbody"></div>`;

  const tick = (secs, active, idle) => {
    $("#dring").innerHTML = ring(secs / goal, 70, `${Math.floor(secs / 60)}m`);
    $("#dtime").textContent = `${fmtDur(secs)} / ${fmtDur(goal)}`;
    $("#dstate").textContent = dailyTimer.paused ? "Paused" : idle ? "Still there? Tap anywhere to keep the timer going." : active ? "Timer running" : "Paused";
    if (!celebrated && secs >= goal) {
      celebrated = true; chime(true);
      $("#dgoal").innerHTML = `<div class="banner" style="margin:12px 0;text-align:center;font-size:1.05rem">🎉 You did your ${goal / 60} minutes today! MashaAllah. You can finish or keep going.
        <div class="row" style="justify-content:center;margin-top:8px"><a class="btn sm" href="#/kid/${kid.id}">Finish</a></div></div>`;
    }
  };
  dailyTimer.start(kid, tick);
  tick(todaySecs(kid), true, false);
  $("#dpause").onclick = () => { dailyTimer.paused = !dailyTimer.paused; $("#dpause").textContent = dailyTimer.paused ? "Resume" : "Pause"; if (dailyTimer.paused) player.stop(); };

  const draw = () => {
    const s = queue[idx], st = surahState(S.progress, s);
    $("#dbody").innerHTML = `
      <div class="row small muted" style="margin:14px 0 6px">
        <span>${reviewMode ? `Surah ${idx + 1} of ${queue.length}` : "Practice"}${round > 1 ? ` · Round ${round}` : ""}</span>
        <span class="spacer"></span>
        <span class="test-progress" style="margin:0">${queue.map((_, i) => `<i class="${i < idx ? "ok" : i === idx ? "cur" : ""}"></i>`).join("")}</span>
      </div>
      <div class="card">
        <div class="surah-head">
          <div class="sn-ar" style="font-size:2rem">سُورَةُ ${esc(s.ar)}</div>
          <div><h2 style="margin:0">${esc(s.en)}</h2><div class="small muted">${s.ayat.length} ayahs</div></div>
          <span class="spacer"></span>
          ${st.due ? `<span class="chip due">Review due</span>` : `<span class="chip ${st.status}">${st.status === "memorized" ? "Memorized" : st.status === "learning" ? "Learning" : "New"}</span>`}
        </div>
        <p class="muted" style="margin:10px 0">${reviewMode ? "Recite the whole surah out loud from memory. Tap an ayah to peek if you get stuck." : "You don't have a memorized surah yet, so spend today's time learning this one."}</p>
        <div class="row">
          ${reviewMode && liveSupported() ? `<button class="btn gold" id="dhud">🐦 Recite with Hudhud</button>` : ""}
          <button class="btn secondary sm" id="dlisten">${I.play} Listen first</button>
          <label class="toggle"><input type="checkbox" id="dshow" ${show ? "checked" : ""}> Show the words</label>
        </div>
      </div>
      <div class="mushaf ${show ? "" : "hide-text"}" id="dmushaf" style="margin-top:10px">
        <div class="basmala">${BASMALA}</div>
        ${s.ayat.map((_, k) => `<div class="ayah" id="ay${k + 1}" style="grid-template-columns:1fr"><div class="text" data-peek>${ayahHtml(s, k + 1)}</div></div>`).join("")}
      </div>
      <div class="card" style="margin-top:12px;text-align:center">
        ${reviewMode ? `<div id="dcheck" style="margin-bottom:12px"></div><h3>How did it go?</h3>
          <div class="row" style="justify-content:center">
            <button class="btn" data-rate="smooth">😊 Smooth</button>
            <button class="btn gold" data-rate="some">😐 A few mistakes</button>
            <button class="btn coral" data-rate="hard">😟 Needs practice</button>
          </div>`
        : `<a class="btn gold" href="#/kid/${kid.id}/s/${s.n}/learn">${I.book} Go to Listen & learn</a>
           <p class="small muted">The daily timer counts on this screen, so come back here when you're done.</p>`}
      </div>`;
    $("#dshow").onchange = e => { show = e.target.checked; $("#dmushaf").classList.toggle("hide-text", !show); };
    $("#dmushaf").onclick = e => { const t = e.target.closest("[data-peek]"); if (t && !show) t.closest(".ayah").classList.toggle("peek"); };
    $("#dlisten").onclick = () => {
      if (player.playing) return player.stop();
      $("#dlisten").innerHTML = `${I.stop} Stop`;
      player.play({ s: s.n, from: 1, to: s.ayat.length, repeat: 1, rate: 1, basmala: true },
        a => { $$(".ayah.playing").forEach(x => x.classList.remove("playing")); a > 0 && $("#ay" + a)?.classList.add("playing"); },
        () => { $("#dlisten") && ($("#dlisten").innerHTML = `${I.play} Listen first`); $$(".ayah.playing").forEach(x => x.classList.remove("playing")); });
    };
    if (!liveSupported()) checkPanel($("#dcheck"), s, 1, s.ayat.length, { label: "Check me — recite the whole surah", onDone: r => {
      const pick = r.frac >= 0.95 ? "smooth" : r.frac >= 0.8 ? "some" : "hard";
      $$("[data-rate]").forEach(b => b.classList.toggle("suggest", b.dataset.rate === pick));
      $("#dcheck").scrollIntoView({ block: "start", behavior: "smooth" });
    } });
    $("#dhud") && ($("#dhud").onclick = () => {
      player.stop(true);
      const box = document.createElement("div"); $("#dmushaf").replaceWith(box);
      $("#dhud").remove(); $("#dshow").closest("label").remove();
      liveRecite(box, s, { hidden: !show, onFinish: async r => {
        kid.stars = (kid.stars || 0) + r.stars; await store.saveKid({ id: kid.id, stars: kid.stars });
        const pick = r.stars === 3 ? "smooth" : r.stars === 2 ? "some" : "hard";
        $$("[data-rate]").forEach(b => b.classList.toggle("suggest", b.dataset.rate === pick));
        $("#dcheck").innerHTML = `<div class="big-stars">${starRow(r.stars)}</div><p class="muted" style="margin:4px 0">${r.got} of ${r.total} words${r.helps ? ` · ${r.helps} with help` : ""}</p>`;
        $("#dcheck").scrollIntoView({ block: "center", behavior: "smooth" });
      } });
    });
    $$("[data-rate]").forEach(b => b.onclick = async () => {
      player.stop(true); checker.cancel();
      await saveSurah(s.n, applyDaily(S.progress[s.n] || {}, b.dataset.rate));
      if (b.dataset.rate === "hard") toast(`We'll review ${s.en} again tomorrow 💪`);
      idx++;
      if (idx >= queue.length) { idx = 0; round++; toast(`Round ${round}! Go through them again 🌟`); }
      draw(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  draw();
}

/* ---- Daily alert ---- */
function chime(happy) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const notes = happy ? [523, 659, 784, 1047] : [659, 523, 659, 784];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.22;
      o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t); o.stop(t + 0.55);
    });
  } catch {}
}
function reminderDue(kid) {
  if (!reminderOn(kid) || todaySecs(kid) >= goalSecs(kid)) return false;
  const [h, m] = reminderTime(kid).split(":").map(Number);
  const at = new Date(); at.setHours(h, m, 0, 0);
  return Date.now() >= at.getTime();
}
const alertedKey = kid => `hifz:alerted:${kid.id}:${dayKey()}`;
async function notify(kid) {
  const title = `⏰ ${kid.name}, time for Qur'an review!`;
  const body = `${Math.ceil((goalSecs(kid) - todaySecs(kid)) / 60)} minutes of reviewing your saved surahs. Tap to start.`;
  const url = `${location.pathname}#/kid/${kid.id}/daily`;
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag: "hifz-" + kid.id, data: { url }, icon: "icon.svg", badge: "icon.svg", requireInteraction: true });
    else { const n = new Notification(title, { body, tag: "hifz-" + kid.id }); n.onclick = () => { window.focus(); location.hash = `#/kid/${kid.id}/daily`; }; }
    return true;
  } catch (e) { console.warn(e); return false; }
}
function showAlertModal(list) {
  if ($("#alertModal") || location.hash.includes("/daily")) return;
  const el = document.createElement("div");
  el.id = "alertModal"; el.className = "modal-back";
  el.innerHTML = `<div class="modal" role="alertdialog" aria-labelledby="alt">
    <div style="font-size:3rem">⏰</div>
    <h2 id="alt" style="margin:4px 0">Time for your daily review!</h2>
    <p class="muted">${list.length > 1 ? "Each of you: " : ""}${list.map(k => `<b>${esc(k.name)}</b> — ${Math.ceil((goalSecs(k) - todaySecs(k)) / 60)} min left`).join("<br>")}</p>
    <div class="row" style="justify-content:center;flex-direction:column;gap:8px">
      ${list.map(k => `<a class="btn gold big" href="#/kid/${k.id}/daily" data-close>${esc(k.avatar || "⭐")} Start ${esc(k.name)}'s review</a>`).join("")}
      <button class="btn ghost sm" data-close>Later</button>
    </div></div>`;
  document.body.appendChild(el);
  el.addEventListener("click", e => { if (e.target.closest("[data-close]") || e.target === el) el.remove(); });
  chime(false);
}
// Checks every 30 s while the app is open. If the app opens after the reminder time and today's
// goal isn't met, it alerts right away. Each child is alerted once per day per device
// (the in-app pop-up shows again whenever the app is reopened until the goal is met).
async function checkReminders(fromOpen) {
  if (!kids.length || (store.mode === "cloud" && !store.user)) return;
  const due = kids.filter(reminderDue);
  if (!due.length) return;
  if (S.kidId && !due.some(k => k.id === S.kidId) ) return;
  const list = S.kidId ? due.filter(k => k.id === S.kidId) : due;
  const fresh = list.filter(k => !localStorage.getItem(alertedKey(k)));
  if (fresh.length) {
    for (const k of fresh) { await notify(k); try { localStorage.setItem(alertedKey(k), "1"); } catch {} }
    showAlertModal(list);
  } else if (fromOpen) showAlertModal(list);
}
async function setupNotifications() {
  if ("serviceWorker" in navigator) { try { await navigator.serviceWorker.register("sw.js"); } catch (e) { console.warn("SW", e); } }
}

/* ============ Parent area ============ */
async function renderParent(sub) {
  S.kidId = null; setNav();
  const app = $("#app");
  if (!settings.pinHash) {
    app.innerHTML = `<div class="card pin-box">
      <h1>${I.lock} Parent area</h1>
      <p class="muted">Choose a 4-digit PIN so the kids stay out of here.</p>
      <input class="pin-input" id="p1" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="new-password">
      <input class="pin-input" id="p2" type="password" inputmode="numeric" maxlength="4" placeholder="again" style="margin-top:8px" autocomplete="new-password">
      <button class="btn" id="setpin" style="margin-top:12px;width:100%">Set PIN</button>
      <p class="small" id="err" style="color:var(--coral)"></p></div>`;
    $("#setpin").onclick = async () => {
      const a = $("#p1").value, b = $("#p2").value;
      if (!/^\d{4}$/.test(a)) return $("#err").textContent = "Use exactly 4 digits.";
      if (a !== b) return $("#err").textContent = "The two PINs don't match.";
      settings.pinHash = await sha(a); await store.saveSettings({ pinHash: settings.pinHash });
      sessionStorage.setItem("hifz:unlocked", "1"); renderParent();
    };
    $("#p1").focus(); return;
  }
  if (sessionStorage.getItem("hifz:unlocked") !== "1") {
    app.innerHTML = `<div class="card pin-box">
      <h1>${I.lock} Parent area</h1>
      <input class="pin-input" id="pin" type="password" inputmode="numeric" maxlength="4" placeholder="PIN" autocomplete="current-password">
      <p class="small" id="err" style="color:var(--coral)"></p>
      <a href="#/" class="small">Back</a></div>`;
    $("#pin").oninput = async e => {
      if (e.target.value.length < 4) return;
      if (await sha(e.target.value) === settings.pinHash) { sessionStorage.setItem("hifz:unlocked", "1"); renderParent(); }
      else { $("#err").textContent = "Wrong PIN"; e.target.value = ""; }
    };
    $("#pin").focus(); return;
  }

  const sel = sub && kidById(sub) ? sub : kids[0]?.id;
  const progress = sel ? await store.getProgress(sel) : {};
  const recs = await store.listRecordings();
  const newRecs = recs.filter(r => !r.heard).length;
  const kid = kidById(sel);

  app.innerHTML = `
    <div class="row"><h1 style="margin:0">Parent dashboard</h1><span class="spacer"></span>
      ${kids.length ? `<button class="btn gold sm" id="shareb">📲 Share with kids</button>
      <a class="btn sm" href="#/" id="kidsb">👧 Kids' screen</a>` : ""}
      <button class="btn ghost sm" id="lockb">${I.lock} Lock</button></div>
    <div id="sharebox"></div>
    <div style="margin-top:10px">${syncBanner()}</div>
    ${kids.length ? `
      <div class="kid-tabs" style="margin-top:14px">${kids.map(k => `<a class="kid-tab" href="#/parent/${k.id}" aria-selected="${k.id === sel}" style="text-decoration:none;color:inherit"><span class="avatar" style="width:30px;height:30px;font-size:1.1rem;margin:0;background:${esc(k.color || COLORS[0])}">${esc(k.avatar || "⭐")}</span>${esc(k.name)}</a>`).join("")}</div>
      ${kidPanel(kid, progress)}` : `<div class="card" style="margin-top:14px"><b>Add your children below to get started.</b></div>`}
    <h2>🎙️ Recordings ${newRecs ? `<span class="chip due">${newRecs} new</span>` : ""}</h2>
    <div class="rec-list" id="precs"></div>
    <h2>👨‍👩‍👧‍👦 Children</h2>
    <div class="grid2">
      <div class="card" id="kidsCard"></div>
      <div class="card">
        <h3>Settings</h3>
        <label class="small muted" style="font-weight:800">Repeats per ayah in Memorize (last one is from memory)</label>
        <select id="reps" style="margin-bottom:10px">${[5, 10, 15, 20, 25, 30, 40].map(n => `<option value="${n}" ${n === (settings.reps || 20) ? "selected" : ""}>${n} times</option>`).join("")}</select>
        <label class="toggle" style="margin-bottom:10px"><input type="checkbox" id="checkme" ${checkEnabled() ? "checked" : ""}> 🐦 Hudhud listens (the browser's speech recognition hears their recitation and lights up each word; voice goes to Google/Apple to be transcribed). Off = self-check only.</label>
        <label class="small muted" style="font-weight:800">Default reciter</label>
        <select id="defrec">${RECITERS.map(r => `<option value="${r.id}" ${r.id === reciter() ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>
        <div class="row" style="margin-top:14px">
          <button class="btn ghost sm" id="chpin">Change PIN</button>
          <button class="btn secondary sm" id="notif">🔔 ${"Notification" in window && Notification.permission === "granted" ? "Notifications on (test)" : "Turn on alerts on this device"}</button>
          ${store.mode === "cloud" ? `<button class="btn ghost sm" id="signout">Sign out of this device</button>` : ""}
        </div>
        <p class="small muted" style="margin-bottom:0">Text: Uthmani script from the Noble Qur'an Encyclopedia (quranenc.com). Audio streamed from everyayah.com.</p>
      </div>
    </div>`;

  $("#lockb").onclick = () => { sessionStorage.removeItem("hifz:unlocked"); location.hash = "#/"; };
  $("#kidsb") && ($("#kidsb").onclick = () => sessionStorage.removeItem("hifz:unlocked"));
  $("#shareb") && ($("#shareb").onclick = () => showShare());
  $("#reps").onchange = async e => { settings.reps = +e.target.value; await store.saveSettings({ reps: settings.reps }); toast(`Each ayah: ${settings.reps} repeats`); };
  $("#checkme").onchange = async e => { settings.checkMe = e.target.checked; await store.saveSettings({ checkMe: settings.checkMe }); toast(settings.checkMe ? "Check me is on" : "Check me is off"); };
  $("#defrec").onchange = async e => { settings.reciter = e.target.value; await store.saveSettings({ reciter: settings.reciter }); toast("Reciter saved"); };
  $("#notif").onclick = async () => {
    if (!("Notification" in window)) return toast("This browser can't show notifications. On iPhone/iPad, first tap Share → Add to Home Screen, then open it from there.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return toast("Notifications blocked. Allow them in the browser's site settings.");
    await setupNotifications();
    const k = kids[0];
    if (k) await notify({ ...k, minutes: {} });
    toast("Alerts are on for this device");
    renderParent(sub);
  };
  $("#chpin").onclick = async () => { settings.pinHash = null; await store.saveSettings({ pinHash: null }); renderParent(sub); };
  $("#signout") && ($("#signout").onclick = async () => { await store.signOut(); sessionStorage.removeItem("hifz:unlocked"); renderSignIn(); });
  recordingList($("#precs"), recs.slice(0, 40), { parent: true });
  kidsCard();
  if (kid) wireKidPanel(kid, progress);
}
function syncBanner() {
  if (store.mode === "cloud") return `<div class="banner">☁️ Syncing as <b>${esc(store.user?.email || "")}</b>. Progress and recordings show up on every device you sign in on.</div>`;
  if (store.cloudError) return `<div class="banner warn">Firebase couldn't start (${esc(store.cloudError)}). Saving on this device only. Check js/firebase-config.js and the README.</div>`;
  return `<div class="banner warn">Saving on <b>this device only</b>. To see progress from your phone, add your Firebase keys (README, “Turn on sync”).</div>`;
}
function kidPanel(kid, p) {
  if (!kid) return "";
  const st = kidStats(p);
  const last = Math.max(0, ...Object.values(p).map(x => x.updatedAt || 0));
  const rows = ORDER.map(s => {
    const x = surahState(p, s);
    const chip = x.due ? `<span class="chip due">Review due</span>` : `<span class="chip ${x.status}">${x.status === "memorized" ? (x.weak ? "Memorized · weak" : "Memorized") : x.status === "learning" ? "Learning" : "Not started"}</span>`;
    return `<tr>
      <td>${s.n}</td>
      <td><span class="sn-ar">${esc(s.ar)}</span> <b>${esc(s.en)}</b></td>
      <td>${chip}</td>
      <td>${x.status === "memorized" ? `${x.total}/${x.total}` : `${x.known}/${x.total}`}</td>
      <td>${x.lastScore != null ? x.lastScore + "%" : "—"} <span class="muted small">${x.lastTest ? fmtDate(x.lastTest) : ""}</span></td>
      <td>${x.bestStars ? starRow(x.bestStars) : "—"}</td>
      <td>${x.lastRecited ? fmtDate(x.lastRecited) : "—"}</td>
      <td>${x.status === "memorized" && x.nextReview ? relDays(x.nextReview) : "—"}</td>
      <td>${x.approved ? `<button class="btn ghost sm" data-unapprove="${s.n}" title="Remove check">${I.star} ${fmtDate(x.approvedAt)}</button>` : `<button class="btn secondary sm" data-approve="${s.n}">${I.check} I tested it</button>`}</td>
      <td>${x.status !== "new" ? `<button class="btn ghost sm" data-reset="${s.n}" title="Reset progress">Reset</button>` : ""}</td>
    </tr>`;
  }).join("");
  return `
    <div class="stats">
      <div class="stat"><div class="v">${st.mem}<span class="muted small"> / ${SURAHS.length}</span></div><div class="l">Surahs memorized</div></div>
      <div class="stat"><div class="v">${st.ayat}<span class="muted small"> / ${TOTAL_AYAT}</span></div><div class="l">Ayahs learned</div></div>
      <div class="stat"><div class="v" style="color:${st.due ? "var(--coral)" : "var(--green)"}">${st.due}</div><div class="l">Reviews due today</div></div>
      <div class="stat"><div class="v">${I.flame} ${streak(kid)}</div><div class="l">Day streak · last active ${last ? fmtDate(last) : "—"}</div></div>
    </div>
    <div class="card" style="margin-top:10px">
      <div class="row"><h3 style="margin:0">☀️ Daily review: ${Math.floor(todaySecs(kid) / 60)} of ${goalSecs(kid) / 60} min today</h3><span class="spacer"></span>
        <span class="small muted">${reminderOn(kid) ? `⏰ Alert at ${fmtTime12(reminderTime(kid))}` : "Alert off"}</span></div>
      <div class="week">${Array.from({ length: 7 }, (_, i) => {
        const t = Date.now() - (6 - i) * DAY, sec = (kid.minutes || {})[dayKey(t)] || 0, f = Math.min(1, sec / goalSecs(kid));
        return `<div class="wday ${f >= 1 ? "met" : ""}" title="${Math.floor(sec / 60)} min"><div class="wbar"><i style="height:${Math.max(f * 100, sec ? 6 : 0)}%"></i></div><b>${Math.floor(sec / 60)}</b><span>${new Date(t).toLocaleDateString(undefined, { weekday: "short" })}</span></div>`;
      }).join("")}</div>
    </div>
    <div class="small muted" style="margin-top:8px">★ ${kid.stars || 0} stars from Hudhud · 📒 ${ORDER.filter(s => p[s.n]?.sticker).length} stickers</div>
    <div class="bar" style="margin:12px 0 4px"><i style="width:${st.ayat / TOTAL_AYAT * 100}%"></i></div>
    <p class="small muted">${Math.round(st.ayat / TOTAL_AYAT * 100)}% of Juz' 'Amma. “I tested it” = you heard them recite it to you; it also marks the surah memorized and starts its review schedule.</p>
    <div class="table-wrap" style="max-height:520px"><table id="ptable">
      <thead><tr><th>#</th><th>Surah</th><th>Status</th><th>Ayahs</th><th>Last test</th><th>Best ★</th><th>Last recited</th><th>Next review</th><th>Parent check</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}
function wireKidPanel(kid, p) {
  $("#ptable").onclick = async e => {
    const b = e.target.closest("button"); if (!b) return;
    const n = +(b.dataset.approve || b.dataset.unapprove || b.dataset.reset);
    const cur = p[n] || {}; let data;
    if (b.dataset.approve) {
      data = { approved: true, approvedAt: Date.now(), updatedAt: Date.now() };
      if (cur.status !== "memorized") Object.assign(data, { status: "memorized", memorizedAt: Date.now(), step: 0, nextReview: Date.now() + DAY, known: byN[n].ayat.map((_, i) => i + 1) });
    } else if (b.dataset.unapprove) data = { approved: false, approvedAt: null };
    else {
      if (!confirm(`Reset ${kid.name}'s progress on ${byN[n].en}?`)) return;
      data = { status: "new", known: [], approved: false, approvedAt: null, nextReview: null, step: 0, weak: false, lastScore: null, lastTest: null, memorizedAt: null };
    }
    await store.saveSurah(kid.id, n, data);
    renderParent(kid.id);
  };
}
function kidsCard() {
  const el = $("#kidsCard"); let pick = { avatar: AVATARS[0], color: COLORS[0] };
  el.innerHTML = `<h3>Your children</h3>
    ${kids.map(k => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--sand-2)">
      <span class="avatar" style="width:34px;height:34px;font-size:1.2rem;margin:0;background:${esc(k.color || COLORS[0])}">${esc(k.avatar || "⭐")}</span>
      <b>${esc(k.name)}</b><span class="spacer"></span>
      <button class="btn ghost sm" data-rename="${k.id}">Rename</button>
      <button class="btn ghost sm" data-delkid="${k.id}">Remove</button>
      <div class="row small" style="width:100%;gap:8px">
        <label class="toggle"><input type="checkbox" data-remon="${k.id}" ${reminderOn(k) ? "checked" : ""}> Daily alert at</label>
        <input type="time" data-remtime="${k.id}" value="${reminderTime(k)}" style="width:auto;min-height:36px;padding:4px 8px">
        <span>for</span>
        <select data-goal="${k.id}" style="width:auto;min-height:36px;padding:4px 8px">${[10, 15, 20, 30, 45, 60].map(n => `<option value="${n}" ${n === (k.goalMin || 30) ? "selected" : ""}>${n} min</option>`).join("")}</select>
      </div></div>`).join("") || `<p class="muted small">No children added yet.</p>`}
    <div style="margin-top:12px">
      <input type="text" id="kname" placeholder="Child's name" maxlength="24">
      <div class="emoji-pick" style="margin-top:8px">${AVATARS.map((a, i) => `<button type="button" data-av="${a}" aria-pressed="${i === 0}">${a}</button>`).join("")}</div>
      <button class="btn" id="addkid" style="margin-top:10px">Add child</button>
    </div>`;
  $$("[data-av]", el).forEach(b => b.onclick = () => { $$("[data-av]", el).forEach(x => x.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", "true"); pick.avatar = b.dataset.av; });
  $("#addkid").onclick = async () => {
    const name = $("#kname").value.trim(); if (!name) return $("#kname").focus();
    const k = await store.saveKid({ name, avatar: pick.avatar, color: COLORS[kids.length % COLORS.length], createdAt: Date.now(), days: [] });
    kids.push(k); toast(`Added ${name}`); renderParent(k.id);
  };
  el.onchange = async e => {
    const t = e.target, id = t.dataset.remon || t.dataset.remtime || t.dataset.goal; if (!id) return;
    const k = kidById(id), patch = {};
    if (t.dataset.remon) patch.reminderOn = t.checked;
    if (t.dataset.remtime && t.value) patch.reminderTime = t.value;
    if (t.dataset.goal) patch.goalMin = +t.value;
    Object.assign(k, patch); await store.saveKid({ id, ...patch });
    try { localStorage.removeItem(alertedKey(k)); } catch {}
    toast("Alert settings saved");
  };
  el.onclick = async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rename) {
      const k = kidById(b.dataset.rename); const name = prompt("New name", k.name)?.trim();
      if (name) { k.name = name; await store.saveKid({ id: k.id, name }); renderParent(k.id); }
    } else if (b.dataset.delkid) {
      const k = kidById(b.dataset.delkid);
      if (!confirm(`Remove ${k.name} and ALL their progress and recordings? This can't be undone.`)) return;
      await store.deleteKid(k.id); kids = kids.filter(x => x.id !== k.id); renderParent();
    }
  };
}

/* ============ Setup link: copies the children (and settings) to another device ============ */
const b64url = str => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = str => new TextDecoder().decode(Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)));
function setupLink(onlyId) {
  const list = kids.filter(k => !onlyId || k.id === onlyId).map(k => ({ id: k.id, name: k.name, avatar: k.avatar, color: k.color,
    goalMin: k.goalMin, reminderTime: k.reminderTime, reminderOn: k.reminderOn }));
  const data = { v: 1, kids: list, set: { reciter: settings.reciter, reps: settings.reps, checkMe: settings.checkMe, pinHash: settings.pinHash } };
  return location.origin + location.pathname + "#/join/" + b64url(JSON.stringify(data));
}
function showShare() {
  const box = $("#sharebox");
  const opts = [["", "All children"], ...kids.map(k => [k.id, `${k.avatar || "⭐"} Only ${k.name}`])];
  box.innerHTML = `<div class="card" style="margin-top:12px;border:2px solid var(--gold)">
    <h3>📲 Send the app to your kids</h3>
    <p class="small muted" style="margin-top:0">Send this link to each child's phone or tablet. Opening it adds them to that device, ready to start. (Progress is saved on the device they use.)</p>
    <div class="row"><select id="shareWho" style="width:auto">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div>
    <div class="row" style="margin-top:10px">
      <input type="text" id="shareUrl" readonly style="flex:1;min-width:200px;font-size:.85rem">
      <button class="btn sm" id="copyb">Copy link</button>
      ${navigator.share ? `<button class="btn gold sm" id="sendb">Send…</button>` : ""}
    </div></div>`;
  const upd = () => { $("#shareUrl").value = setupLink($("#shareWho").value); };
  upd(); $("#shareWho").onchange = upd;
  $("#copyb").onclick = async () => {
    try { await navigator.clipboard.writeText($("#shareUrl").value); toast("Link copied — paste it in a message to your kids"); }
    catch { $("#shareUrl").select(); document.execCommand("copy"); toast("Link copied"); }
  };
  $("#sendb") && ($("#sendb").onclick = () => navigator.share({ title: "Hifz Path", text: "Your Qur'an app 🌙 Open this link to start:", url: $("#shareUrl").value }).catch(() => {}));
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}
async function importSetup(code) {
  let data;
  try { data = JSON.parse(unb64url(code)); } catch { toast("That setup link looks broken. Ask your parent to send it again."); location.hash = "#/"; return; }
  let added = 0;
  for (const k of data.kids || []) {
    if (!k?.id || !k?.name) continue;
    const ex = kidById(k.id);
    const kid = { ...k, ...(ex ? {} : { createdAt: Date.now(), days: [] }) };
    await store.saveKid(kid);
    if (ex) Object.assign(ex, k); else { kids.push(kid); added++; }
  }
  const set = Object.fromEntries(Object.entries(data.set || {}).filter(([k, v]) => v !== undefined && v !== null && !(k === "pinHash" && settings.pinHash)));
  if (Object.keys(set).length) { Object.assign(settings, set); await store.saveSettings(set); }
  history.replaceState(null, "", location.pathname + "#/");
  const names = (data.kids || []).map(k => k.name).join(" & ");
  if ((data.kids || []).length === 1) { location.hash = `#/kid/${data.kids[0].id}`; } else route();
  toast(added ? `Welcome, ${names}! 🌙` : `${names} updated on this device`);
}

/* ============ Boot ============ */
async function boot() {
  if (!store) store = await createStore();
  if (store.mode === "cloud" && !store.user) return renderSignIn();
  [settings, kids] = await Promise.all([store.getSettings(), store.listKids()]);
  await route();
  if (!boot.started) {
    boot.started = true;
    setupNotifications();
    setTimeout(() => checkReminders(true), 800);
    setInterval(() => checkReminders(false), 30000);
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || (store.mode === "cloud" && !store.user)) return;
      kids = await store.listKids(); checkReminders(true);
    });
  }
}
boot().catch(e => { console.error(e); $("#app").innerHTML = `<div class="card">Couldn't start: ${esc(e.message || e)}</div>`; });
