# BrightLoop — Subscription Management System (SMS)

> **Build one unified system to run plans, subscriptions, automated billing, and recurring revenue in one place.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-ff4154.svg)](https://tanstack.com/start)
[![Vite](https://img.shields.io/badge/Vite-8.1-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.2-38b2ac.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e.svg)](https://supabase.com/)

---

## 📖 Executive Summary

**BrightLoop** is an enterprise-grade subscription management and recurring billing platform engineered for high-growth recurring businesses. It replaces fragmented spreadsheets, manual invoices, and disconnected payment reconciliation with a unified, automated digital backbone.

From quotation generation and subscription activation to automated multi-cadence billing, smart tax rules, dynamic discount application, and executive revenue reporting — BrightLoop runs the complete lifecycle of recurring revenue.

---

## ⚡ Key Highlights & Core Capabilities

### 1. Unified Product & Plan Catalog
- **Products & Variants**: Configure base products with category classification, sales price, cost price, and variant add-ons (e.g., brand-specific adjustments such as +$560 for Odoo).
- **Billing Cadences**: Support for daily, weekly, monthly, and yearly recurring schedules.
- **Plan Constraints & Policies**: Set minimum seat quantities, promotional availability windows, and automated end-of-term policies (auto-close, early termination, pause, renew).

### 2. Quotation to Subscription Lifecycle
- **Quotation Templates**: Reusable templates pre-configured with standard plans and product line combinations.
- **Strict State Machine**: Seamless lifecycle progression:
  $$\text{Draft} \longrightarrow \text{Quotation} \longrightarrow \text{Confirmed} \longrightarrow \text{Active} \longrightarrow \text{Closed}$$
- **Full Traceability**: Every subscription maintains a unique identifier, linked customer profile, start/expiry dates, payment terms, and itemized lines with tax & discount breakdowns.

### 3. Automated Recurring Billing Engine
- **Drift-Free Scheduling**: Billing dates are calculated strictly from the root subscription start date and cumulative cycle count (`billing_date_for_cycle`), preventing calendar drift.
- **Idempotent Billing Runs**: Scheduled via Postgres cron (`pg_cron`) or executed on-demand. Invoices are strictly unique per `(subscription_id, period_start)`, ensuring zero double-billing and zero skipped cycles.

### 4. Smart Invoicing & Automated Tax
- **Atomic Invoicing**: Automatically generated directly from active subscriptions with customer snapshots, line items, and pricing locks.
- **Tax Rules Engine**: Dynamic regional and product-specific tax calculations.
- **Invoice Lifecycle**: Full tracking from `Draft` $\rightarrow$ `Confirmed` $\rightarrow$ `Paid` with cancellation and printable export options.

### 5. Configurable Discount Engine
- **Flexible Rules**: Percentage-based or fixed-amount discounts.
- **Targeted Application**: Apply discounts subscription-wide or restrict them to specific products.
- **Safeguards & Thresholds**: Minimum purchase amount/quantity thresholds, validity date ranges, and maximum usage counters.
- **Automatic Invoice Inclusion**: Eligible discounts apply automatically upon invoice generation without manual intervention.

### 6. Payment Collection & Gateway Integration
- **Multi-Method Recording**: Track bank transfers, cash, credit cards, and manual entries with reference notes and receipts.
- **Razorpay Integration**: Native checkout flow with order creation, cryptographic signature verification, and automated invoice marking.
- **Overdue Management**: Proactive alerts and filtering for aging receivables before they become bad debt.

### 7. Role-Based Access Control (RBAC)
- **Admin**: Full control over products, plans, tax settings, staff management, and system-level configuration.
- **Staff / Operations**: Daily customer handling, quotation generation, invoice reviews, and payment logging.
- **Customer Portal**: Self-service portal where customers view active subscriptions, download invoices, and manage payment details securely.

### 8. Executive Financial Intelligence
- Real-time visibility into Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), active subscriber counts, collection rates, and overdue receivables.
- High-performance, indexed PostgreSQL queries ensuring sub-2-second response times across large dataset volumes.

### 9. Dual Operating Modes
- **Live / Production Mode**: Connects directly to production Supabase database with strict audit logging.
- **Interactive Demo Sandbox**: Isolated demo tables with an integrated mock data generator to test high-volume billing scenarios safely.

---

## 🛠️ Architecture & Tech Stack

```
BrightLoop Subscription OS
├── Frontend (Client)
│   ├── React 19.2 + TanStack Router (File-based routing)
│   ├── TanStack Query (Server state management & caching)
│   ├── Tailwind CSS v4 + Radix UI Primitives (Component design)
│   └── Sonner / Lucide Icons (Feedback & UI typography)
├── Application Server
│   ├── TanStack Start / Nitro (SSR & API server entrypoints)
│   └── Vite 8 (Hot-module replacement & bundling)
└── Backend & Persistence
    ├── Supabase PostgreSQL (Database, Realtime, & Auth)
    ├── Drizzle ORM (Type-safe schema definitions & migrations)
    └── Security Definer Functions & Row-Level Security (RLS)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher (recommended: Node 20 LTS or Node 24)
- **npm** / **bun** / **pnpm**

### 1. Clone the Repository
```bash
git clone https://github.com/Balaji210907/SMS_AT-TI.git
cd SMS_AT-TI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your Supabase project URL and publishable key are set:
```ini
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
```

### 4. Run the Development Server
```bash
npm run dev
```
Open your browser and navigate to **`http://localhost:8080`** (or `http://localhost:5173`).

---

## 📜 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Launches local development server with Vite & TanStack Start |
| `npm run build` | Builds the application for production deployment |
| `npm run preview` | Runs the production build locally for verification |
| `npm run lint` | Runs ESLint across TypeScript and TSX files |
| `npm run test` | Executes unit and integration test suite via Vitest |

---

## 🗄️ Database Migrations

Database migrations are managed using Drizzle Kit in `drizzle/migrations/`:
- `0000_core_schema.sql`: Core schema (users, roles, products, plans, taxes, discounts, subscriptions, invoices, payments)
- `0001_business_logic.sql`: RLS policies, audit triggers, and Security Definer business logic
- `0002_billing_cron.sql`: Automated recurring billing worker definitions
- `0003_demo_mode_tables_and_generator.sql`: Sandbox tables and sample data generation
- `0004_email_logs_payment_transactions_import_batches.sql`: Email audit and batch imports
- `0005_demo_discount_products_and_generator_fix.sql`: Extended demo product rules
- `0006_demo_dashboard_metrics_keys_and_verified_payment.sql`: Executive KPI aggregation

To apply migrations or introspect the schema:
```bash
npx drizzle-kit push
```

---

## 🔒 Security & Architecture Principles

- **Atomic Writes**: All financial transactions and status updates execute via `SECURITY DEFINER` PostgreSQL functions to guarantee atomicity and role verification regardless of client state.
- **Snapshot Immutability**: Historical invoices lock line-item prices, applied discounts, and tax rates at generation time, preventing retroactive alterations.
- **Row-Level Security (RLS)**: Enforced across all catalog, subscription, customer, and transaction tables. Customers are strictly isolated to their own records.

---

## 📄 License
This project is proprietary and developed for the BrightLoop Subscription Management System.
