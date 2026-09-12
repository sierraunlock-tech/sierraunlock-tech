# SIERRAUNLOCK 🔓🇸🇱
**Sierra Leone's First Digital Unlocking Platform**
`Unlock • Repair • Connect` — Any Brand. Any Network. Legal. Certified. Trusted.

---

## 1. WHAT IS THIS?
SIERRAUNLOCK is a production-ready resale platform for phone unlocking,
IMEI checks, FRP/iCloud bypass and tool licenses. It resells services
from the FastUnlockers.us GSM Hub (reseller account: Alhassan301) with an
automatic profit margin, live order tracking, 24/7 AI assistant and a
founder-only fulfillment desk.

## 2. LIVE URLS
| What | Where |
|---|---|
| Customer site | https://sierraunlock.com (+ sierraunlock.live) |
| Live catalog (248+ services) | /live-services.html |
| Order tracking | /track.html |
| Policy / refunds / legal | /policy.html |
| Founder desk (SECRET) | /admin-orders.html (token required) |
| Backend API | https://sierraunlock-tech-1-4um3.onrender.com |

## 3. ARCHITECTURE
Customer browser (GitHub Pages)
   → Render backend (Express, v3.13)
      → FastUnlockers GSM Hub v3.00 API (/api/dhru, user Alhassan301)
Money: customer → SIERRAUNLOCK desk (OM/Binance/cash)
       → wholesale deducted from Alhassan's FastUnlockers balance
       → margin split 75% SIERRAUNLOCK / 25% Alhassan

## 4. KEY FEATURES
- Live catalog synced from upstream every 10 minutes (auto-adds ANY new
  service/tool FastUnlockers enables on the reseller account — no code change)
- Pricing engine: customer price = wholesale cost + $2 flat
  (Leone price = USD × live rate, default 26 SLE/USD, admin-updatable)
- Cost privacy: wholesale cost NEVER exposed to customers
- Order flow: order → pay → Mark Paid → AUTO upstream order → code on track.html
- Binance Pay webhook auto-detect (job ID in payment note → 30-sec fulfilment)
- Refund lock: paid orders irreversible by customers; refunds founder-only
- SIERRA Assistant: 24/7 auto-reply chatbot (12-topic knowledge base)
- Services mega-menu with deep links (#g=network / #g=frp / #g=checks / #g=tools)
- Responsive + animated UI (polish.css), accessible, print-ready

## 5. REPOSITORY STRUCTURE
sierraunlock-live/
├── index.html, about.html, services.html, payments.html, faq.html,
│   contact.html, reseller.html, marketplace.html, repair.html,
│   shops.html, auth.html, admin.html
├── live-services.html   ← live catalog (customer buying page)
├── track.html           ← live order tracking + code delivery
├── policy.html          ← terms / refund / legal compliance
├── admin-orders.html    ← FOUNDER DESK (secret URL + token)
├── assets/
│   ├── css/ (style.css, animations.css, polish.css)
│   ├── js/  (main.js v9.7 master brain, auth.js, payments.js, …)
│   └── images/ (brand, founders, tools)
└── backend/
    ├── server.js        ← Express API v3.13 (Render)
    ├── package.json
    └── .env.example

## 6. ENV VARIABLES (Render only — NEVER in Git/frontend)
PORT, FRONTEND_URL (comma list of allowed origins),
ADMIN_TOKEN, UNLOCK_API_URL, UNLOCK_API_KEY, UNLOCK_API_USERNAME=Alhassan301,
optional: UNLOCK_FLAT_FEE (default 2), UNLOCK_COMMISSION_SPLIT (0.75,0.25),
BINANCE_WEBHOOK_SECRET

## 7. SECURITY
HTTPS everywhere • helmet • CORS whitelist (both domains) • rate limiting
• Joi validation • admin-token on all money endpoints • webhook HMAC
• IMEI masked in public tracking • wholesale cost hidden • refund lock
• owner-verification policy • CTIA + Sierra Leone law compliance

## 8. AUTOMATION MAP (what runs without humans)
1 Catalog sync (10 min)          5 Code delivery to track.html
2 Price + Leone conversion       6 Chatbot customer support 24/7
3 Binance payment auto-detect    7 Nav/mega-menu/animation injection
4 Auto upstream order on Mark Paid  8 Rate-driven price recalculation

## 9. UPSTREAM SYNC RULE (important for founders)
Anything FastUnlockers ENABLES on Alhassan's reseller account — new unlock
services, tool credits (Chimera/Pandora/TSM/…), file services, server
services — appears on sierraunlock.com AUTOMATICALLY within ~10 minutes.
No code change required. To request new product lines, message
FastUnlockers admin to enable them on account Alhassan301.

## 10. OWNERSHIP
© 2026 SIERRAUNLOCK — Alhassan Mansaray (Waterloo) & Baimba Conteh (Koidu).
IT CAN ONLY BE GOD ✦ LEARN BEFORE YOU EARN