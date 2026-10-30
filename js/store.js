// Storage layer. Same async API for two backends:
//  - LocalStore: browser only (localStorage for data, IndexedDB for recordings)
//  - CloudStore: Firebase Auth (Google) + Firestore. Recordings are split into
//    chunks inside Firestore so the free Spark plan is enough (no Cloud Storage).
import { firebaseConfig } from "./firebase-config.js";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ---------------- Local ---------------- */
export class LocalStore {
  constructor() { this.mode = "local"; this.user = null; }
  async init() { return true; }
  _get(k, d) { try { const v = localStorage.getItem("hifz:" + k); return v ? JSON.parse(v) : d; } catch { return d; } }
  _set(k, v) { try { localStorage.setItem("hifz:" + k, JSON.stringify(v)); } catch (e) { console.warn(e); } }

  async getSettings() { return this._get("settings", {}); }
  async saveSettings(s) { this._set("settings", { ...(await this.getSettings()), ...s }); }

  async listKids() { return this._get("kids", []); }
  async saveKid(kid) {
    const kids = await this.listKids();
    if (!kid.id) kid.id = uid();
    const i = kids.findIndex(k => k.id === kid.id);
    if (i >= 0) kids[i] = { ...kids[i], ...kid }; else kids.push(kid);
    this._set("kids", kids); return kid;
  }
  async deleteKid(id) {
    this._set("kids", (await this.listKids()).filter(k => k.id !== id));
    localStorage.removeItem("hifz:progress:" + id);
    for (const r of await this.listRecordings(id)) await this.deleteRecording(r.id);
  }

  async getProgress(kidId) { return this._get("progress:" + kidId, {}); }
  async saveSurah(kidId, n, data) {
    const p = await this.getProgress(kidId); p[n] = { ...(p[n] || {}), ...data };
    this._set("progress:" + kidId, p);
  }

  _db() {
    if (this.__db) return this.__db;
    this.__db = new Promise((res, rej) => {
      const r = indexedDB.open("hifz-recordings", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("blobs");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this.__db;
  }
  async _idb(mode, fn) {
    const db = await this._db();
    return new Promise((res, rej) => {
      const tx = db.transaction("blobs", mode); const req = fn(tx.objectStore("blobs"));
      tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error);
    });
  }
  async listRecordings(kidId) {
    const all = this._get("recordings", []);
    return (kidId ? all.filter(r => r.kidId === kidId) : all).sort((a, b) => b.createdAt - a.createdAt);
  }
  async saveRecording(meta, blob) {
    const rec = { ...meta, id: uid(), createdAt: Date.now(), mime: blob.type, size: blob.size };
    await this._idb("readwrite", s => s.put(blob, rec.id));
    this._set("recordings", [rec, ...this._get("recordings", [])]); return rec;
  }
  async getRecordingBlob(id) { return this._idb("readonly", s => s.get(id)); }
  async updateRecording(id, patch) {
    this._set("recordings", this._get("recordings", []).map(r => r.id === id ? { ...r, ...patch } : r));
  }
  async deleteRecording(id) {
    await this._idb("readwrite", s => s.delete(id));
    this._set("recordings", this._get("recordings", []).filter(r => r.id !== id));
  }
}

/* ---------------- Firebase ---------------- */
const FB = "https://www.gstatic.com/firebasejs/10.14.1/";
const CHUNK = 600 * 1024; // base64 chars per Firestore doc (doc limit is 1 MiB)

class CloudStore {
  constructor() { this.mode = "cloud"; this.user = null; }
  async init() {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")
    ]);
    this.fs = fs; this.authMod = auth;
    const app = initializeApp(firebaseConfig);
    this.auth = auth.getAuth(app);
    this.db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
    // Every device signs in anonymously (no Google account needed). The secret family code from the
    // setup link decides which family's data a device can see.
    const cred = await auth.signInAnonymously(this.auth);
    this.user = cred.user;
    try { this.familyId = localStorage.getItem("hifz:family") || null; } catch { this.familyId = null; }
    return true;
  }
  get ready() { return !!this.familyId; }
  _setFamily(id) { this.familyId = id; try { id ? localStorage.setItem("hifz:family", id) : localStorage.removeItem("hifz:family"); } catch {} }
  createFamily() {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const id = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => abc[b % abc.length]).join("");
    this._setFamily(id); return id;
  }
  joinFamily(id) { if (!/^[A-Za-z0-9]{20,40}$/.test(id || "")) throw new Error("Bad family code"); this._setFamily(id); }
  leaveFamily() { this._setFamily(null); }

  _ref(...path) { return this.fs.doc(this.db, "families", this.familyId, ...path); }
  _col(...path) { return this.fs.collection(this.db, "families", this.familyId, ...path); }

  async getSettings() { const s = await this.fs.getDoc(this._ref("meta", "settings")); return s.exists() ? s.data() : {}; }
  async saveSettings(s) { await this.fs.setDoc(this._ref("meta", "settings"), s, { merge: true }); }

  async listKids() {
    const q = await this.fs.getDocs(this._col("kids"));
    return q.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  async saveKid(kid) {
    if (!kid.id) kid.id = uid();
    const { id, ...rest } = kid;
    await this.fs.setDoc(this._ref("kids", id), rest, { merge: true }); return kid;
  }
  async deleteKid(id) {
    for (const r of await this.listRecordings(id)) await this.deleteRecording(r.id);
    const ps = await this.fs.getDocs(this._col("kids", id, "surahs"));
    for (const d of ps.docs) await this.fs.deleteDoc(d.ref);
    await this.fs.deleteDoc(this._ref("kids", id));
  }

  async getProgress(kidId) {
    const q = await this.fs.getDocs(this._col("kids", kidId, "surahs"));
    const p = {}; q.docs.forEach(d => p[d.id] = d.data()); return p;
  }
  async saveSurah(kidId, n, data) { await this.fs.setDoc(this._ref("kids", kidId, "surahs", String(n)), data, { merge: true }); }

  async listRecordings(kidId) {
    const c = this._col("recordings");
    const q = kidId ? this.fs.query(c, this.fs.where("kidId", "==", kidId)) : c;
    const s = await this.fs.getDocs(q);
    return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);
  }
  async saveRecording(meta, blob) {
    const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.readAsDataURL(blob); });
    const id = uid(); const chunks = Math.ceil(b64.length / CHUNK);
    for (let i = 0; i < chunks; i++)
      await this.fs.setDoc(this._ref("recordings", id, "chunks", String(i)), { d: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
    const rec = { ...meta, createdAt: Date.now(), mime: blob.type, size: blob.size, chunks };
    await this.fs.setDoc(this._ref("recordings", id), rec);
    return { id, ...rec };
  }
  async getRecordingBlob(id) {
    const m = await this.fs.getDoc(this._ref("recordings", id)); if (!m.exists()) return null;
    const { chunks, mime } = m.data(); let b64 = "";
    for (let i = 0; i < chunks; i++) b64 += (await this.fs.getDoc(this._ref("recordings", id, "chunks", String(i)))).data().d;
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime });
  }
  async updateRecording(id, patch) { await this.fs.updateDoc(this._ref("recordings", id), patch); }
  async deleteRecording(id) {
    const m = await this.fs.getDoc(this._ref("recordings", id));
    const n = m.exists() ? m.data().chunks : 0;
    for (let i = 0; i < n; i++) await this.fs.deleteDoc(this._ref("recordings", id, "chunks", String(i)));
    await this.fs.deleteDoc(this._ref("recordings", id));
  }
}

// Copy everything saved on this device (before sync was turned on) into the family's cloud data.
// Newer progress wins per surah; minutes and streak days are merged. Local data is kept as a backup.
export async function migrateLocal(cloud, onStatus) {
  const key = "hifz:migrated:" + cloud.familyId;
  try { if (localStorage.getItem(key)) return 0; } catch { return 0; }
  const local = new LocalStore();
  const lkids = await local.listKids();
  const lrecs = await local.listRecordings();
  if (!lkids.length && !lrecs.length) { try { localStorage.setItem(key, "1"); } catch {} return 0; }
  onStatus?.("Copying this device's progress to your family…");
  const cset = await cloud.getSettings(), lset = await local.getSettings(), addSet = {};
  for (const [k, v] of Object.entries(lset)) if (cset[k] == null && v != null) addSet[k] = v;
  if (Object.keys(addSet).length) await cloud.saveSettings(addSet);
  const ckids = Object.fromEntries((await cloud.listKids()).map(k => [k.id, k]));
  for (const lk of lkids) {
    const ck = ckids[lk.id];
    if (!ck) await cloud.saveKid({ ...lk });
    else {
      const minutes = { ...(ck.minutes || {}) };
      for (const [d, v] of Object.entries(lk.minutes || {})) minutes[d] = Math.max(minutes[d] || 0, v);
      const days = [...new Set([...(ck.days || []), ...(lk.days || [])])].sort().slice(-120);
      await cloud.saveKid({ id: lk.id, minutes, days, stars: Math.max(ck.stars || 0, lk.stars || 0) });
    }
    const lp = await local.getProgress(lk.id), cp = ck ? await cloud.getProgress(lk.id) : {};
    for (const [n, d] of Object.entries(lp))
      if (!cp[n] || (d.updatedAt || 0) > (cp[n].updatedAt || 0)) await cloud.saveSurah(lk.id, n, d);
  }
  let done = 0;
  for (const r of lrecs) {
    const blob = await local.getRecordingBlob(r.id); if (!blob) continue;
    const { id, createdAt, mime, size, ...meta } = r;
    onStatus?.(`Uploading recordings… ${++done}/${lrecs.length}`);
    const saved = await cloud.saveRecording(meta, blob);
    await cloud.updateRecording(saved.id, { createdAt });
  }
  try { localStorage.setItem(key, "1"); } catch {}
  return lkids.length + lrecs.length;
}

export async function createStore() {
  if (firebaseConfig.apiKey) {
    try { const s = new CloudStore(); await s.init(); return s; }
    catch (e) { console.error("Firebase failed, using local mode", e); const l = new LocalStore(); l.cloudError = String(e.message || e); return l; }
  }
  return new LocalStore();
}
