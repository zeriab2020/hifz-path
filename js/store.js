// Storage layer. Same async API for two backends:
//  - LocalStore: browser only (localStorage for data, IndexedDB for recordings)
//  - CloudStore: Firebase Auth (Google) + Firestore. Recordings are split into
//    chunks inside Firestore so the free Spark plan is enough (no Cloud Storage).
import { firebaseConfig } from "./firebase-config.js";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ---------------- Local ---------------- */
class LocalStore {
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
    await new Promise(res => { const off = auth.onAuthStateChanged(this.auth, u => { this.user = u; off(); res(); }); });
    try { await auth.getRedirectResult(this.auth); this.user = this.auth.currentUser; } catch (e) { console.warn(e); }
    return true;
  }
  async signIn() {
    const p = new this.authMod.GoogleAuthProvider();
    try { const r = await this.authMod.signInWithPopup(this.auth, p); this.user = r.user; }
    catch (e) {
      if (String(e.code).includes("popup")) await this.authMod.signInWithRedirect(this.auth, p);
      else throw e;
    }
  }
  async signOut() { await this.authMod.signOut(this.auth); this.user = null; }

  _ref(...path) { return this.fs.doc(this.db, "families", this.user.uid, ...path); }
  _col(...path) { return this.fs.collection(this.db, "families", this.user.uid, ...path); }

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

export async function createStore() {
  if (firebaseConfig.apiKey) {
    try { const s = new CloudStore(); await s.init(); return s; }
    catch (e) { console.error("Firebase failed, using local mode", e); const l = new LocalStore(); l.cloudError = String(e.message || e); return l; }
  }
  return new LocalStore();
}
