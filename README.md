# 🔓 SIERRAUNLOCK Platform

**Sierra Leone's First Professional Digital Unlocking & Repair Platform**  
*Unlock • Repair • Connect*

![Version](https://img.shields.io/badge/version-3.32.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-UNLICENSED-red)

---

## 📖 About

SIERRAUNLOCK is a secure, scalable, and modern web platform designed to bridge the gap between local technicians and global unlocking servers in Sierra Leone. Built with a "security-first" mindset, it provides customers with a seamless wallet-based checkout experience, live currency conversion, and real-time order tracking, while giving founders a powerful, centralized administrative dashboard.

**Core Philosophy:**  
> *"IT CAN ONLY BE GOD ✦ LEARN BEFORE YOU EARN"*

---

## ✨ Key Features

### 🛡️ Security & Compliance
- **XSS & Injection Protection:** Strict Content Security Policy (CSP), input sanitization, and honeypot traps on all forms.
- **Rate Limiting:** Prevents brute-force attacks and form spam (max 3 submissions per 5 mins per endpoint).
- **Secure Authentication:** Bcrypt password hashing, EmailJS OTP verification, and session-based token management.
- **Legal Compliance:** Strict adherence to CTIA consumer standards and Sierra Leone law. *Zero tolerance for illegal IMEI/blacklist tampering.*

### 💰 Wallet & Payment System
- **Multi-Currency Support:** Live SLE ⇄ USD ⇄ USDT ⇄ BTC ⇄ ETH converter powered by the public Binance API.
- **Founder-Verified Top-ups:** Orange Money and Binance Pay require manual founder approval before crediting, preventing fraud.
- **Auto-Refund Engine:** If an upstream order fails, the customer's wallet balance is instantly and automatically refunded.

### ⚙️ Backend & Integrations
- **Live Catalog:** Dynamically fetches IMEI, File, and Server services from the FastUnlockers API.
- **GitHub Data Vault:** Automated, encrypted backup of all user data, wallets, and orders to a private GitHub repository (prevents data loss).
- **Webhook Support:** Ready for Binance auto-fulfillment and CDR (Callback Data Record) status updates.

### 👨‍💼 Admin Dashboard
- Private, token-protected founder control panel.
- Manage exchange rates, approve/reject wallet top-ups, retry failed upstream orders, issue refunds with logged reasons, and manage customer accounts.

---

## 🏗️ Architecture

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Custom animations, responsive grid, Leaflet.js for GPS maps).
- **Backend:** Node.js, Express.js.
- **Validation:** Joi schema validation for all API endpoints.
- **Storage:** Local JSON (`data.json`) continuously synchronized with a private GitHub Repository (Vault).
- **Hosting:** Render.com (Backend API), GitHub Pages (Frontend).

---

## 🚀 Getting Started

### Prerequisites
- Node.js `>= 18.0.0`
- Git
- A Render.com account (for backend deployment)

### Local Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sierraunlock-tech/sierraunlock-tech.git
   cd sierraunlock-tech