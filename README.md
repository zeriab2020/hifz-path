# Hifz Path · مسار الحفظ

A Juz' 'Amma (surahs 78–114) memorization app for kids, with a parent dashboard.

**For the kids**
- **Recite with Hudhud 🐦** (the first screen when they open a surah): the whole surah is shown, Hudhud the hoopoe listens as they recite, and each word lights up green as they say it. Tap any word to hear it (word-by-word audio from quran.com). If they get stuck, the next word glows, and after a few more seconds Hudhud says it for them. If they say a wrong word, Hudhud asks them to try again. Each surah earns 1–3 stars; reciting it from memory (words hidden) with 3 stars earns its sticker in their sticker book. Works in Chrome and Safari; elsewhere this screen falls back to the self-check test.
- **Memorize**: each ayah is repeated 20 times with the reciter (number is adjustable); the 20th time is from memory with the words hidden. A mistake adds 5 more repeats.
- **🎤 Check me**: the browser's Arabic speech recognition listens while they recite and marks each word ✓ or ✗. It catches skipped or wrong words, not tajweed. Works in Chrome and Safari; the voice is sent to Google/Apple to be transcribed. Can be turned off in Parent → Settings.
- **Daily alert**: at a time you choose, the app chimes and reminds them to do their daily review (default 30 minutes) of every surah they've saved.
- **Listen & learn**: ayah-by-ayah recitation with repeat (1–10×), loop, speed, choice of reciter, and a "hide words" memory mode. Tick ✓ each ayah once they can say it alone.
- **Test myself**: recite each ayah from memory, reveal, and mark got it / missed it. Passing the whole surah (90%+) marks it memorized.
- **Record**: record the whole surah and save it for the parent to hear.
- **Review**: memorized surahs come back for review after 1, 3, 7, 14, 30, 60, 90 days. A weak review resets the schedule to tomorrow.

**For the parent** (PIN-protected)
- Per child: surahs memorized, ayahs learned, streak, reviews due, last test score, next review date for every surah.
- Listen to recordings, give 1–3 stars, leave a note the child sees.
- "I tested it" button: when they recite to you in person, mark the surah checked (and memorized).
- Add/rename/remove children, pick the default reciter.

Fonts: Amiri Quran, Amiri and Nunito are bundled in `fonts/` (SIL Open Font License).

Text: Uthmani script from the Noble Qur'an Encyclopedia (quranenc.com), via the `quran-json` package (CC-BY-4.0); ayah counts verified (564 ayahs). English meanings: Saheeh International. Audio streams from everyayah.com.

---

## 1. Put it on GitHub Pages

1. Create a new repo, e.g. `zeriab2020/hifz-path`.
2. Upload everything in this folder (keep the `css/`, `js/`, `data/` folders).
3. Repo **Settings → Pages → Source: Deploy from a branch → `main` / root → Save**.
4. After a minute it's live at `https://zeriab2020.github.io/hifz-path/`.

It works right away in **this-device-only** mode (saved in the browser). Do step 2 to see progress from your phone.

## 2. Turn on sync across devices (free Firebase, ~10 minutes)

Without this, each device keeps its own progress. With it, every device opened with your setup link shares the same progress, stars, stickers and recordings. No one needs a Google account on the kids' devices.

1. Go to <https://console.firebase.google.com> → **Create a project** (name it `hifz-path`; Analytics not needed). It stays on the free **Spark** plan; no card needed.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
3. **Build → Firestore Database → Create database** → pick a location near you (e.g. `nam5`) → **Start in production mode**.
   Open the **Rules** tab, paste the contents of `firestore.rules` from this repo, **Publish**.
4. **Project settings (gear) → General → Your apps → Web (`</>`)** → register app (no hosting). Copy the `firebaseConfig` values into `js/firebase-config.js` and commit:
   ```js
   export const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "hifz-path-xxxx.firebaseapp.com",
     projectId: "hifz-path-xxxx",
     appId: "1:...:web:..."
   };
   ```
   (These web keys are meant to be public. Your family's data is protected by a long secret family code that only exists inside your setup link.)
5. On **your** device, open the app → **I'm the parent → Set up our family**. Anything already saved on that device (children, progress, recordings) is copied in.
6. **Parent → 📲 Share with kids** → send the link to every other device (kids' devices and your own phone). Opening it connects that device.

Keep the setup link private: anyone who has it can see and change your family's progress.

Recordings are compressed (~32 kbps) and stored in Firestore itself, so you don't need Cloud Storage (which requires the paid Blaze plan). A 3-minute recitation is about 0.7 MB; the free tier holds 1 GB.

## Files

| File | What it is |
|---|---|
| `index.html` | App shell |
| `js/app.js` | Screens: kid picker, surah path, learn / test / record, parent dashboard |
| `js/store.js` | Saving: browser storage, or Firebase when configured |
| `js/firebase-config.js` | Your Firebase keys (empty = this device only) |
| `data/juz-amma.js` | Surahs 78–114 text + meanings |
| `firestore.rules` | Security rules to paste into Firebase |
