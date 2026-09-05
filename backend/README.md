```markdown
<p align="center">
  <img src="assets/images/brand/sierraunlock-logo.png" alt="SIERRAUNLOCK" width="120"/>
</p>

<h1 align="center">🇸🇱 SIERRAUNLOCK</h1>

<p align="center">
  <strong>Sierra Leone's first digital unlocking, repair & spare-parts platform.</strong><br/>
  Unlock • Repair • Connect
</p>

<p align="center">
  <a href="https://sierraunlock-tech.github.io/sierraunlock-tech/"><img src="https://img.shields.io/badge/🔗_Live_Demo-1EB53A?style=for-the-badge" alt="Live Demo"/></a>
  <a href="https://github.com/sierraunlock-tech"><img src="https://img.shields.io/badge/GitHub-0072C6?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"/></a>
  <a href="https://whatsapp.com/channel/0029VbDtNmh1XquQ7GVpp409"><img src="https://img.shields.io/badge/WhatsApp_Channel-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp"/></a>
</p>

<p align="center">
  <em><strong>IT CAN ONLY BE GOD ✦ LEARN BEFORE YOU EARN</strong></em>
</p>

---

## 🎯 Mission

SIERRAUNLOCK bridges the gap between **local Sierra Leonean technicians** (from Waterloo to Koidu) and **global unlocking infrastructure** — legally, transparently, and fraud-free. We consolidate seven services into one trusted platform:

| Service | Description |
|---|---|
| 🔓 **Network Unlocking** | Legal carrier unlocks for iPhone, Samsung, Tecno, Infinix, Itel, Nokia, Huawei, Xiaomi |
| 🧠 **Software & Flashing** | Owner-verified FRP resets, OS flashing, performance optimization |
| 🔩 **Hardware Repair** | Screens, batteries, ports, water-damage, board-level micro-soldering |
| 🧰 **Spare Parts Marketplace** | Zero-fraud marketplace with real photos and honest conditions |
| 📍 **GPS Shop Map** | Live Leaflet map of verified shops across Sierra Leone |
| 🤝 **Reseller Network** | Wholesale unlock pricing for partner shops & technicians |
| 💳 **Secure Payments** | Orange Money, Binance Pay, BTC, ETH, USD, SLE with live converter |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (GitHub Pages)                    │
│  Static HTML/CSS/JS  •  Data in browser localStorage           │
│  No shared database = nothing central for intruders to break    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   📱 WhatsApp    💰 Orange Money  ₿ Binance Pay
   (Orders)       (SLE payments)   (Crypto/USD)
        │             │             │
        └─────────────┴─────────────┘
                      ▼
              🧑‍💼 FOUNDERS (Waterloo / Koidu)
              Fulfill manually or via backend
```

**Design philosophy:** *Working software over comprehensive documentation.* We ship a fully functional, secured, documented platform — not paperwork that gathers dust.

---

## 📂 Project Structure

```text
sierraunlock/
│
├── 🌐 PAGES (12 public + 1 private)
│   ├── index.html          # Homepage — 7 service cards + founders + payments
│   ├── about.html          # Founders (Alhassan & Baimba) + journey timeline
│   ├── services.html       # Legal unlocking + CTIA standards + IMEI policy
│   ├── repair.html         # Repair booking + full GTC terms
│   ├── marketplace.html    # Zero-fraud spare parts + seller corner
│   ├── shops.html          # Leaflet GPS map + shop submission
│   ├── payments.html       # Verified accounts + live converter
│   ├── reseller.html       # B2B wholesale network + application
│   ├── faq.html            # 15-question consumer knowledge base
│   ├── contact.html        # All contact channels + business application
│   ├── auth.html           # Customer account (EmailJS OTP)
│   └── admin.html          # 🔐 Private admin dashboard (noindexed)
│
├── 🎨 STYLES
│   └── assets/css/
│       ├── style.css        # Design system (v5) — tokens, layout, dropdowns
│       └── animations.css   # Motion engine (v6) — reveals, marquee, orbs
│
├── 🧠 JAVASCRIPT ENGINES
│   └── assets/js/
│       ├── security.js      # 🔒 Security shield v3 (11 hardening layers)
│       ├── main.js          # Core engine (nav, rotator, marquee, reveal)
│       ├── auth.js          # Customer account + EmailJS OTP (rate-limited)
│       ├── admin.js         # Dashboard (brute-force lockout + session expiry)
│       ├── map.js           # Leaflet GPS map + shop submission
│       └── payments.js      # Live SLE/USD/BTC/ETH converter (Binance API)
│
├── ⚙️ BACKEND (future deployment)
│   └── backend/
│       ├── server.js        # Express API v2 (Helmet + Joi + rate limits)
│       ├── package.json     # Dependencies
│       ├── .env             # Secrets (never committed)
│       └── .gitignore
│
└── 📖 README.md             # This file
```

---

## 🔐 Security Hardening (v3)

The platform is protected by **11 layered security measures** — all running client-side, with zero friction for legitimate users:

| # | Protection | What it stops |
|---|---|---|
| 1 | **Frame-buster** | Clickjacking attacks (site embedded in fake pages) |
| 2 | **Self-XSS warning** | Customers pasting scam code in console |
| 3 | **DevTools detection** | Casual inspection with console open |
| 4 | **Input sanitizer** | HTML injection / XSS via form fields |
| 5 | **Form rate-limiter** | Spam (max 3 submissions / 5 min / form) |
| 6 | **noopener fixer** | Tab-nabbing on all external links |
| 7 | **Honeypot traps** | Bot form submissions (auto-injected) |
| 8 | **CSP meta tag** | Malicious script injection |
| 9 | **Copy-paste protection** | Credential stuffing on password/OTP fields |
| 10 | **Activity monitoring** | Rapid automated clicking detection |
| 11 | **Admin brute-force lockout** | 5 wrong PINs = 60-second freeze + 30-min auto-logout |

**Security philosophy:** *Defense in depth.* No single control is relied upon — layers stack to deter automated attacks, script kiddies, and social engineering.

---

## 🚀 Getting Started

### Local Development (no build step required)

```bash
# 1. Clone the repository
git clone https://github.com/sierraunlock-tech/sierraunlock-tech.git
cd sierraunlock-tech

# 2. Open in VS Code
code .

# 3. Launch with any local server
# Option A — Live Server extension in VS Code (recommended)
# Option B — Python
python -m http.server 8000
# Option C — Node
npx serve .

# 4. Visit http://localhost:8000
```

### GitHub Pages Deployment (current live version)

The site is already live at: **https://sierraunlock-tech.github.io/sierraunlock-tech/**

To deploy updates:

```bash
git add .
git commit -m "your change message"
git push
# GitHub Pages auto-rebuilds within ~60 seconds
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Markup** | Semantic HTML5 | Accessibility + SEO |
| **Styling** | CSS3 (custom properties, clamp, grid, flexbox) | Responsive design system |
| **Animation** | Pure CSS keyframes + IntersectionObserver | 60fps motion engine |
| **Map** | Leaflet.js + OpenStreetMap tiles | GPS shop finder |
| **Email** | EmailJS | OTP verification (no backend needed) |
| **Payments API** | Binance public API | Live BTC/ETH rates |
| **Storage** | localStorage + sessionStorage | Per-device data (no shared DB) |
| **Backend (future)** | Node.js + Express + Helmet + Joi | Server-side unlock orders |
| **Hosting** | GitHub Pages (frontend) + Render (backend) | Free, scalable, global CDN |

---

## 📊 Admin Dashboard

**Access:** `admin.html` (noindexed by Google)  
**Default PIN:** `2026` — **change immediately after first login**

| Panel | Purpose |
|---|---|
| 📊 Overview | Live stats — jobs, shops, listings, SLE rate |
| 💱 Rates & Pricing | Set exchange rate + wholesale tool margins |
| 📥 Seller Submissions | Approve / reject marketplace listings |
| 📍 Shops Approval | Verify community shops for the GPS map |
| 🛒 Marketplace | Publish listings directly |
| 🧾 Jobs Board | Track every unlock/repair job |
| ⚙️ Settings | Change version label + admin PIN + danger zone |

---

## 🌍 Hubs

### 🏢 Waterloo Hub (Western Area)
**Founder:** Alhassan Mansaray  
**Location:** Tombo Park, Waterloo — opposite Peninsula School  
**Phone:** `+232 75 908 206`  
**Services:** Unlocking • Trading • Marketplace pickups

### 🏢 Koidu Hub (Kono District)
**Co-Founder:** Baimba Conteh  
**Location:** Koidu City  
**Phone:** `+232 31 363 736`  
**Services:** Engineering • Board-level repair • Technician certification

---

## 📜 Legal & Compliance

SIERRAUNLOCK is committed to **100% legal unlocking** aligned with:

- ✅ **CTIA Consumer Code for Wireless Service** (6 unlocking principles)
- ✅ **Sierra Leone telecommunications law**
- ✅ **DMCA** (Digital Millennium Copyright Act)
- ❌ **We NEVER perform:** IMEI changing, blacklist removal, FRP bypass without proof of ownership, or any work on stolen devices

See [`services.html#legal`](https://sierraunlock-tech.github.io/sierraunlock-tech/services.html#legal) for the full IMEI & Anti-Fraud Policy.

---

## 🤝 Contributing

This is a commercial product of **SIERRAUNLOCK Engineering** (Alhassan Mansaray & Baimba Conteh). 

For partnership inquiries, business accounts, or wholesale access:
- 📧 **Email:** sierraunlock@gmail.com
- 📱 **WhatsApp:** `+232 75 908 206`
- 🌐 **Business application:** [`contact.html#business`](https://sierraunlock-tech.github.io/sierraunlock-tech/contact.html#business)

---

## 📄 License

**UNLICENSED** — All rights reserved. This codebase is proprietary to SIERRAUNLOCK Engineering. Use, distribution, or reproduction requires written permission from the founders.

---

<p align="center">
  <strong>Built with 🇸🇱 pride for Sierra Leone</strong><br/>
  <sub>Waterloo • Koidu • Freetown • Bo • Kenema • Makeni • and beyond</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-1EB53A?style=flat-square"/>
  <img src="https://img.shields.io/badge/Status-Production_Ready-0072C6?style=flat-square"/>
  <img src="https://img.shields.io/badge/Security-Hardened_v3-B00020?style=flat-square"/>
</p>
```