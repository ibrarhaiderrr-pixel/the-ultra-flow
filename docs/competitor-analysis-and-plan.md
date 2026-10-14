# The Ultra Flow — Admin Panel aur App ka Plan

Competitor ki video (`competitor.mp4`, 82 second) ke frames dekh kar yeh plan banaya hai. Unka panel `092pak.workers.dev` par chalta hai (Cloudflare Workers).

## Competitor ke panel me kya kya hai

| Page | Kya karta hai |
|---|---|
| **Dashboard** | Total clients (149), active (142), devices (152), latest events, release channels (website / backend / Windows / Android version) |
| **Clients** | Saare clients ki list. Filters: All / Active / Pending / Expired / Suspended. Har client par buttons: Renew, Edit, Reset, Unbind device, Suspend, Delete, WhatsApp message |
| **Create Client** | Username/Gmail, email, WhatsApp number, password, display name, kitne din, device limit, purchase price, selling price, expected profit, aur "Google Flow account" chunne ka option |
| **Package ready** | Client bante hi login details ka message tayar hota hai: "Copy" ya "Send via WhatsApp" |
| **Notices** | Clients ko app ke andar notice bhejna (title, message, priority, schedule) |
| **Expiry Center** | Jin clients ki expiry qareeb hai unke cards, saath me "Send WhatsApp" reminder |
| **Pricing Analytics** | Revenue, cost, profit, har client ki pricing ledger |
| **Accounts** | Google accounts ki list. Ek Gmail kai clients ko diya jata hai (video me ek account "59 assigned") |
| **Devices** | Kaun sa client kis device (Windows/Android) par login hai, app version, last seen, Revoke button |
| **Activity** | Har action ka log (client created, deleted, renewed...) |

## Hum kya banayenge

### Phase 1 — Online backend + Admin panel
- **Hosting:** Cloudflare Workers + D1 database. Competitor bhi yahi use karta hai. Free hai, card nahi chahiye.
- **Pages:** Dashboard, Clients, Create Client (WhatsApp package ke saath), Notices, Expiry Center, Pricing Analytics, Devices, Activity, Settings
- **Admin login:** password se. Panel phone par bhi theek chalega.

### Phase 2 — Windows app (.exe)
- Electron se banegi. Login screen hogi.
- App har dafa server se check karegi: user active hai? expire to nahi hua? device limit se zyada to nahi?
- Admin ki taraf se aaya notice app me dikhega. Days remaining bhi dikhenge.

### Phase 3 — Android app (.apk)
- Wahi login aur checks, Android ke liye.

## ⚠️ Ek hissa jo main nahi banaunga

**Accounts** page aur "Google Flow account" wala option shared Gmail accounts ko dozens of paying clients me baantne ke liye hai (ek Gmail → 59 clients), aur app unhe us account se login karwati hai. Yeh Google ki subscription ko aage bechna hai, jo Google ki terms ke khilaf hai. Is liye main yeh hissa nahi banaunga: na Google accounts ka pool, na unke password/Authenticator codes app me bhejna, na auto-login.

Baaqi sab — clients, subscription, expiry, device limit, notices, pricing, WhatsApp package — normal licensing system hai, aur woh main poora bana dunga. App ke andar user ko kya milega (aapka apna content/tool, ya user ka **apna** Google account), yeh aap tay karein.

## Aapse chahiye
1. Phase 1 (admin panel) se shuru karun?
2. App ke andar user ko asal me kya dena hai, Google accounts ke ilawa?
3. Cloudflare account (free) — signup me 1 minute lagta hai, baaqi setup main terminal se kar dunga.
