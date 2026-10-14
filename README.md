# THE ULTRA FLOW — Project Guide (Handover)

> **Kal ya kisi naye account / naye AI se kaam shuru karna ho:** yeh file us AI ko de dein (ya `C:\Users\dell\Desktop\antigravity` ko workspace bana dein) aur **section 10** wala message bhej dein. Wo yahin se kaam shuru kar dega.

Last update: 15 Oct 2026

---

## 1. Project kya hai (short)

"THE ULTRA FLOW" — ek app business ka system. 3 hisse:

| Hissa | Kya hai | Status |
|---|---|---|
| **Download website** | Users ke liye landing page: Windows/Android download, install guide, Google 2-step guide, FAQ. Koi sign in nahi. | ✅ Live |
| **Admin panel + backend** | Clients banana, expiry, devices, notices, pricing, WhatsApp package. Apps isi se login check karti hain. | ✅ Live |
| **Reseller panel** | Resellers ko apna panel — sirf apne clients, credits/limits | ⏳ Next (section 7) |
| **Windows app (.exe) / Android app (.apk)** | Login screen + server se active/expiry/device check + notices | ⏳ Baad me |

---

## 2. Saare links aur accounts

| Cheez | Detail |
|---|---|
| Download website (live) | https://the-ultra-flow.vercel.app |
| Admin panel (live) | https://ultraflow-admin.admin-backend.workers.dev |
| Admin password | Computer par `ADMIN-PASSWORD.txt` file me (yahan nahi likha — repo public hai). Panel > Settings se badal sakte hain. |
| GitHub | account `ibrarhaiderrr-pixel`, repo https://github.com/ibrarhaiderrr-pixel/the-ultra-flow (**public**) |
| Vercel | GitHub se login, project `the-ultra-flow`, **Root Directory = `public`** |
| Cloudflare | account `ibrarhaiderrr@gmail.com` (ID `94790d1afa2dd88a0038e37629f74be5`), Worker `ultraflow-admin`, D1 database `ultraflow-db` (ID `79a37051-ff6b-4cec-8825-717cf1a91c4b`) |
| Computer par folder | `C:\Users\dell\Desktop\antigravity` |
| Kharcha | Sab free, koi card nahi |

> Repo public hai — **kabhi bhi password, token ya secret GitHub par mat daalein.**

---

## 3. Folder structure

```
antigravity/
├── public/                 ← Download website (Vercel par yahi chalta hai)
│   ├── index.html          ← Poora page / saara text
│   ├── styles.css, app.js
│   └── logo.png, guide-windows.png, google-auth-guide.png
├── admin-backend/          ← Admin panel + API (Cloudflare Worker)
│   ├── src/index.js        ← Saari API (admin + app)
│   ├── schema.sql          ← Database tables
│   ├── wrangler.toml       ← Cloudflare config
│   ├── public/             ← Admin panel UI (index.html, admin.css, admin.js, views.js, logo.png)
│   └── .dev.vars           ← Sirf local password (GitHub par nahi jata)
├── docs/                   ← Plans, competitor analysis, screenshots
├── PROJECT-GUIDE.md        ← Yeh file (GitHub par README.md)
├── deploy.js               ← Website + backup GitHub par bhejta hai
├── ADMIN-PASSWORD.txt      ← Live admin password (sirf computer par)
├── competitor.mp4          ← Competitor ke admin panel ki video
└── server.js, db.js, ...   ← Purana local server (ab zaroorat nahi)
```

---

## 4. Download website

Sections: Hero (V1.0 LIVE, "Create Beyond Limits With The Ultra Flow") → Setup video (placeholder) + Quick Help → How to install (Android + Windows SmartScreen) → Google 2-Step help → About → FAQ → Footer.

**Pending:** asal download links (`public/index.html` me `id="btnWinDownload"` / `id="btnAndroidDownload"` ka `href`), asal setup video (`id="videoPlayerBox"`).
Note: `public/app.js` ka `loadPublicDownloads()` purane local server se links mangta hai — Vercel par wo nahi hai, is liye links seedha HTML me likhne hain (ya isko admin backend ke `/api/public/releases` se jodna hai).

**Update karna:** files badlein → `node deploy.js` (GitHub CLI login chahiye) → Vercel khud update.
Ya browser se: GitHub repo → `public` folder → Add file → Upload files.

---

## 5. Admin panel + backend

**Pages:** Dashboard · Clients (create/edit/renew/suspend/reset devices/new password/delete, search, filters) · Expiry Center (WhatsApp reminder) · Notices · Pricing Analytics · Devices (revoke) · Activity · Settings (brand, release links/versions, admin password).

**Rules:**
- Plan ke din client ki **pehli app login** par shuru hote hain ("Not activated" tab tak).
- Device limit login par check hoti hai. Suspend / expire / device revoke = app band.
- Client password sirf banate waqt (aur "New password" par) dikhta hai, database me hash hota hai.

**App API (Windows/Android apps ke liye):**
- `POST /api/app/login` — `{ username, password, device_id, platform, app_version, device_name }` → `token`, `allowed`, `account`, `notices`, `releases`
- `GET /api/app/status` (header `Authorization: Bearer <token>`) — har dafa app khulne par / har kuch minute
- `POST /api/app/logout`
- `GET /api/public/releases` — latest versions/links

**Database tables:** clients, devices, notices, activity, settings.

**Local chalana:** `admin-backend` folder me `npm install` → `npx wrangler d1 execute ultraflow-db --local --file=schema.sql` → `npx wrangler dev --port 8787` → http://localhost:8787 (password `.dev.vars` me).

**Live update (deploy):**
1. Cloudflare API token banayein: https://dash.cloudflare.com/profile/api-tokens → Create Token → "Edit Cloudflare Workers" template → "+ Add more": Account / D1 / Edit → Create.
2. PowerShell me `admin-backend` folder ke andar:
   ```
   $env:CLOUDFLARE_API_TOKEN='<token>'; $env:CLOUDFLARE_ACCOUNT_ID='94790d1afa2dd88a0038e37629f74be5'
   npx wrangler deploy
   ```
3. Database me naya table/column ho to: `npx wrangler d1 execute ultraflow-db --remote --file=schema.sql`
4. Kaam ke baad token delete kar dein.
(`wrangler login` wala browser tareeqa is computer par baar baar fail hua tha — token wala tareeqa use karein.)

**Tests:** `docs/tests/test-backend.js` (25 checks — login, device limit, suspend, renew, revoke...). Base URL aur password file ke upar badal kar `node test-backend.js`.

**Pending chhota kaam:** `admin.css` me badge fix (status label ek line me) local par ho chuka hai, agli deploy me live jayega.

---

## 6. Jo jaan boojh kar NAHI banaya

Competitor ke panel me "Accounts" page hai jahan ek Gmail kai clients ko diya jata hai (ek account → 59 clients) aur app un sab ko usi Google account se login karwati hai. Yeh Google subscription ko aage bechna hai (Google terms ke khilaf, accounts ban ho sakte hain). Is liye **Google accounts ka pool, unke password / Authenticator codes app me bhejna, ya auto-login nahi banaya gaya.** Baaqi licensing system normal hai.

---

## 7. NEXT: Reseller panel (kal yahin se shuru)

**Zaroorat:** Resellers ko apna login/panel dena, jahan wo apne clients bana sakein.

**Plan (proposed — kal confirm karna):**
- Admin panel me naya page **Resellers**: reseller banana (naam, username, password, WhatsApp), suspend/delete, **credits** dena.
- **Credits system:** har client banane / renew karne par reseller ke credits katte hain (e.g. 30 din = 1 credit). Admin credits top-up karta hai. Har transaction ka record.
- **Reseller panel** (alag login, same link par role ke hisaab se): sirf **apne** clients dekhe/banaye/renew kare, apna balance aur history dekhe, WhatsApp package bheje. Doosre resellers ya admin ka data nahi dikhe.
- Admin ko har client ke saath dikhe ke kis reseller ne banaya; reseller-wise sales/profit report.
- Database: `resellers` table, `clients.reseller_id`, `credit_transactions` table.
- Competitor me bhi yeh tha: "This client will be linked automatically to Haider. No seller selection is needed."

**Kal decide karna:**
1. Credits kaise katenge — per client, per din, ya fixed price PKR?
2. Kya reseller client ko suspend/delete kar sake, ya sirf admin?
3. Kya reseller apni selling price khud rakhe?
4. Ek reseller ke neeche sub-reseller chahiye ya nahi?

---

## 8. Baad me: Windows / Android app

- Windows: Electron (.exe). Android: (.apk).
- Login screen → `/api/app/login` → app ke andar kaam → har kuch minute `/api/app/status` → `allowed=false` ho to app lock + message.
- Notices app me dikhenge, days remaining, "update available" (min_app_version se).
- **Abhi decide nahi hua:** app ke andar user ko asal me kya milega (Google shared accounts ke ilawa).

---

## 9. Pending list

- [ ] Reseller panel (section 7)
- [ ] Windows app (.exe) + Android app (.apk)
- [ ] Website par asal download links + setup video
- [ ] Admin panel ka badge fix deploy karna (agli deploy ke saath)
- [ ] (Optional) Apna domain — Vercel / Cloudflare me lag jata hai

---

## 10. Naye AI ko dene ke liye ready message

Copy karein, saath me yeh file attach karein (ya folder ko workspace banayein):

```
Mera project "THE ULTRA FLOW" hai. Poori details PROJECT-GUIDE.md me hain — pehle use poora parho.
- Computer par folder: C:\Users\dell\Desktop\antigravity
- GitHub (backup + website): https://github.com/ibrarhaiderrr-pixel/the-ultra-flow
- Website (Vercel): https://the-ultra-flow.vercel.app
- Admin panel (Cloudflare Worker + D1): https://ultraflow-admin.admin-backend.workers.dev — code admin-backend/ folder me
- Shared Google accounts wala hissa nahi banana (guide section 6).

Aaj ka kaam: [jaise: section 7 ka reseller panel banana]
```

---

## 11. Agar computer na ho (sirf GitHub se wapas lana)

1. Naye computer par Node.js install karein.
2. GitHub repo ka **Code → Download ZIP** karein aur extract karein.
3. Website: `public/` folder. Admin backend: `admin-backend/` folder → `npm install`.
4. Admin password Cloudflare me save hai (computer wali file na bhi ho to): naya set karna ho to token ke saath `npx wrangler secret put ADMIN_PASSWORD`.
5. Live database Cloudflare par hai — computer kharab hone se clients ka data nahi jata.
