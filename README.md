# Clinora

> A modern, offline-first clinic management and prescription system built for small to mid-size medical practices.

---

## Overview

Clinora is a full-featured Electronic Medical Record (EMR) and pharmacy management system that runs entirely on your local network — no internet required, no cloud dependency. Designed for clinics that need speed, reliability, and full control over patient data.

---

## Features

### Doctor Workflow
- **Patient Management** — Register patients, view full visit history, and manage records with soft-delete support.
- **Visit Tracking** — Create and manage patient visits with fees, payment status, and completion states.
- **Prescription Writing** — Write prescriptions with multiple medicine line items. Print ready-to-use prescription slips directly from the app.
- **Dashboard** — At-a-glance view of today's patients, pending prescriptions, and revenue.

### Pharmacy Workflow
- **Prescription Queue** — View all pending prescriptions sent by the doctor. Start dispensing with one click.
- **Dispensing Flow** — Step-by-step dispensing with per-item completion tracking.
- **Payment Collection** — Record and track payment status for each dispensed prescription.
- **Revenue & Transactions** — Full history of completed dispensing with revenue breakdown.

### Shared Modules
- **Medicines** — Maintain a master list of medicines with import support.
- **Stock Items** — Track pharmacy stock separately from the medicine catalogue.
- **Settings** — Clinic name, prescription template configuration, and per-user profile management.
- **Profile** — Update personal info, change password, and manage avatar.
- **Role-Based Access** — Doctor and Pharmacy roles with separate dashboards and permissions.

---

## Project Structure

```
clinora/
├── backend/        Laravel 13 + Sanctum REST API
├── frontend/       React + Vite web client
├── clinoraexe/     Tauri 2 standalone Windows desktop app
├── automation/     Startup, stop, install & uninstall scripts
└── docs/           Project documentation
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Web Backend | Laravel 13, PHP, Sanctum |
| Web Frontend | React, Vite |
| Desktop App | Tauri 2 (Rust), React |
| Database | MySQL |
| Auth | Laravel Sanctum (web) / local session (desktop) |
| PDF | Laravel PDF generation |

---

## Getting Started

### Web App (Laravel + React)

**Requirements:** PHP 8.2+, Composer, Node.js 18+, MySQL 8+

```bash
# 1. Set up the database
# Create a MySQL database and configure .env in /backend

# 2. Install backend dependencies
cd backend
composer install
php artisan migrate --seed

# 3. Install frontend dependencies
cd ../frontend
npm install
npm run dev

# 4. Start backend server
cd ../backend
php artisan serve
```

Or use the automation scripts:
```bash
# Windows — from /automation/
install.bat       # First-time setup
start.bat         # Start all services
stop.bat          # Stop all services
```

### Desktop App (Tauri EXE)

**Requirements:** Rust toolchain, Node.js 18+, MySQL 8+

```bash
cd clinoraexe
npm install
npm run tauri dev       # Development
npm run tauri build     # Build EXE
```

Configure your MySQL connection in `clinoraexe/src-tauri/tauri.conf.json` or the app's settings screen on first launch.

---

## Roles

| Role | Access |
|---|---|
| `doctor` | Patients, Visits, Prescriptions, Dashboard, Medicines, Settings |
| `pharmacy` | Prescription Queue, Dispensing, Revenue, Stock, Medicines |

---

## License

This project is proprietary software. See [LICENSE](LICENSE) for full terms.

All rights reserved © Thaelon.

---

## Built By

**Ghost-team** at [Thaelon](https://k871git.github.io/thaelon)

> Building tools that work where the internet doesn't.
