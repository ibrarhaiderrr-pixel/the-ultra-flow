# THE ULTRA FLOW — Project Guide (Handover)

Yeh file is website ki poori details rakhti hai. Agar kabhi naye AI assistant (Antigravity, ChatGPT, Claude, waghera) se kaam karwana ho, to **yeh file usko de dein** — wo sab samajh jayega.

---

## 1. Website kya hai

- **Naam:** THE ULTRA FLOW
- **Kaam:** Ek simple download/landing page. Windows (.exe) aur Android (.apk) app download karne ke liye.
- **Website par koi Sign In / Sign Up nahi hai** — sirf downloads aur guides.
- **Live link (permanent):** https://the-ultra-flow.vercel.app

### Page par sections (upar se neeche)
1. Hero — Badge "OFFICIAL APP DOWNLOADS · V1.0 LIVE", heading "Create Beyond Limits With The Ultra Flow", tagline, Windows + Android download cards
2. Setup video — abhi placeholder (asal video baad me lagani hai) + "Quick Help" card (VPN tips)
3. How to install — Android banner + Windows SmartScreen guide image + 4 steps
4. Google Sign-in Help — 2-Step Verification ke 3 steps + guide image
5. About the app — 3 feature cards
6. FAQ — sawal jawab
7. Footer

---

## 2. Accounts aur jagah (kahan kya hai)

| Cheez | Detail |
|---|---|
| GitHub account | `ibrarhaiderrr-pixel` |
| GitHub repo | https://github.com/ibrarhaiderrr-pixel/the-ultra-flow |
| Hosting | Vercel (GitHub se login), project: `the-ultra-flow` |
| Vercel setting | **Root Directory = `public`** (isko mat badlein) |
| Computer par folder | `C:\Users\dell\Desktop\antigravity` |
| Kharcha | Free (koi card nahi diya) |

> Repo **public** hai — is me koi password ya secret mat daalein.

---

## 3. Files (kaunsi file kya karti hai)

Asal website sirf `public/` folder hai:

| File | Kaam |
|---|---|
| `public/index.html` | Poora page — saara text, sections, download buttons |
| `public/styles.css` | Design / colors / layout |
| `public/app.js` | Chhota script (toast messages, download button behaviour) |
| `public/logo.png` | Logo |
| `public/guide-windows.png` | Windows SmartScreen guide tasveer |
| `public/google-auth-guide.png` | Google 2-Step guide tasveer |
| `deploy.js` | Changes ko GitHub par bhejta hai → Vercel site update kar deta hai |

Baaqi files (`server.js`, `db.js`, `admin.html`, `data/`) sirf computer par local chalane ke liye hain. **Vercel par inka koi kaam nahi** — admin panel live site par nahi chalta.

---

## 4. Aam kaam kaise karein

### A) Download links lagana (sab se zaroori)
`public/index.html` me yeh do jagah hain:
- `id="btnWinDownload"` wale `<a>` me `href="#"` ko Windows .exe ke link se badlein
- `id="btnAndroidDownload"` wale `<a>` me `href="#"` ko Android .apk ke link se badlein

**Zaroori:** `public/app.js` ka `loadPublicDownloads()` function local server se links mangta hai. Vercel par wo server nahi hai, is liye link seedha HTML me likhna hai, aur `app.js` me wo hissa aisa ho ke HTML wale link ko `#` se overwrite na kare.

### B) Setup video lagana
`public/index.html` me `id="videoPlayerBox"` ke andar placeholder hai. Usko YouTube embed se badlein:
```html
<div class="video-responsive-wrap">
  <iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID?rel=0" allowfullscreen></iframe>
</div>
```
(`.video-responsive-wrap` ka CSS `styles.css` me pehle se mojood hai.)

### C) Text ya version badalna
Sab text `public/index.html` me hai. Version badge ke liye "V1.0 LIVE" aur cards me "v1.0.0" dhoondein.

---

## 5. Changes live kaise karein (deploy process)

**Tareeqa 1 — Terminal se (AI assistant yeh kar sakta hai):**
1. GitHub CLI login check: `"C:\Program Files\GitHub CLI\gh.exe" auth status`
2. Agar login nahi: `"C:\Program Files\GitHub CLI\gh.exe" auth login --web` → https://github.com/login/device par code daalein → Authorize
3. Project folder me: `node deploy.js`
4. 1 minute baad https://the-ultra-flow.vercel.app check karein

**Tareeqa 2 — Haath se (browser):**
1. https://github.com/ibrarhaiderrr-pixel/the-ultra-flow kholein
2. `public` folder me jayein → **Add file → Upload files**
3. Badli hui files drag karein → **Commit changes**
4. Vercel khud update kar dega

> Agar naya computer ho aur GitHub CLI na ho: `winget install --id GitHub.cli -e`

---

## 6. Computer par local chalana (optional)
Node.js chahiye. Folder me:
```
npm install
node server.js
```
Phir http://localhost:3000 kholein. (`Start-Website.bat` bhi yahi karta hai + ek temporary public link banata hai.)

---

## 7. Naye AI ko dene ke liye ready message

Yeh copy karke naye AI ko bhejein, saath me yeh file attach karein:

```
Mere paas "THE ULTRA FLOW" naam ki website hai. Poori details PROJECT-GUIDE.md me hain (attach hai).
- Live: https://the-ultra-flow.vercel.app
- Repo: https://github.com/ibrarhaiderrr-pixel/the-ultra-flow (website = public/ folder)
- Hosting: Vercel, Root Directory = public, static site (koi backend nahi)
- Computer par folder: C:\Users\dell\Desktop\antigravity
- Deploy: "node deploy.js" (GitHub CLI se upload karta hai, Vercel khud update hota hai)

Mujhe yeh kaam karwana hai: [YAHAN APNA KAAM LIKHEIN]
```

---

## 8. Kya pending hai
- [ ] Windows .exe ka download link
- [ ] Android .apk ka download link
- [ ] Asal setup video (YouTube)
- [ ] (Optional) Apna domain, jaise `theultraflow.com` — Vercel → Settings → Domains se lag jata hai
