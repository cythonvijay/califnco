# Califnco — Water Purifier Commerce, Dealer & Admin Platform

Monorepo containing the redesigned Califnco customer storefront, B2B dealer portal, and administrator console (`apps/web`), trusted serverless API endpoints (`api/`), Firestore security rules (`firestore.rules`), shared domain validation & pricing package (`packages/shared`), and Android mobile app (`apps/mobile`).

## Architecture Overview

```
apps/web        React + Vite + TypeScript: Customer Storefront, /dealer/* B2B Workspace, /admin/* Admin Console
api/            Vercel serverless functions (Firebase Admin SDK): order creation, Razorpay verify, admin CRUD & approvals
packages/shared Shared TypeScript domain logic: types, GST/shipping pricing, Zod validation schemas, RBAC permissions, catalog seed
apps/mobile     Expo (React Native) customer application for Android consuming the shared active catalog
firestore.rules Least-privilege Firestore security rules supporting custom claims + admin-provisioned user roles
tests/rules     Firestore security rules test suite
scripts/        seed (initial active catalog) and set-admin (grants admin role across Auth + Firestore)
```

## Key Architectural Repairs & Redesign Highlights

1. **Unified Product Source of Truth (`apps/web/src/lib/repository.ts` & `useCatalog.ts`)**
   - The active catalog is controlled by the Administrator Product Management system (`/admin/products`) and persisted directly to the configured database (`Firestore` when `VITE_FIREBASE_*` is configured, or persistent `localStorage` database `califnco.db.v2` in local development).
   - Silent `SEED_PRODUCTS` demo fallback resurrection has been removed. If all products are unpublished, archived, or deleted, customer-facing pages display a clean Empty Catalog State with a direct link to the Admin Console rather than resurrecting demo arrays.
   - Product creation, editing, sale pricing (`salePricePaise`), wholesale pricing (`wholesalePricePaise`), stock updates, homepage `featured` toggles, `published` / `draft` / `archived` lifecycle transitions, and deletions synchronize immediately across the Homepage, Catalog, Search, Product Detail, Cart, Checkout, Dealer Portal, and Admin views.

2. **Role-Based Authorization & Access-Denied Fixes**
   - `firestore.rules`, `api/_lib/http.ts`, and `apps/web/src/context/Auth.tsx` resolve roles consistently across Firebase Auth custom claims (`request.auth.token.role`) and admin-provisioned Firestore user documents (`users/{uid}.role`), while strictly preventing customers from writing `role` to their own user document.
   - `useRepoQuery` and `AccessStateCard` distinguish accurately between `signed_out`, `unauthorized` (authenticated without required role), `missing_config`, `network_error`, and empty data states.

3. **Global Navigation & Dedicated Role Shells**
   - **Customer Storefront Header**: Single-row desktop layout with Califnco brand identity on the left, primary links (`Home`, `Water Purifiers`, `Filters & Accessories`, `Dispensers`, `Pumps`, `Installation/Service`, `Dealers`) in the center, and Search, Account Dropdown (containing Profile, Orders, Service Visits, Notifications, and **Sign out**), and Cart badge on the right. Responsive mobile drawer on viewports ≤960px.
   - **Admin Console (`AdminShell`)**: Dedicated sidebar + compact top bar with breadcrumbs, notifications link, and profile menu containing Sign out—completely separated from customer shopping navigation.
   - **Dealer Portal (`DealerShell`)**: Dedicated B2B trade header and workspace for wholesale ordering (10+ units minimum, free bulk freight).

4. **Product Photography & Image Management**
   - Flat category illustrations and `"ILLUSTRATION"` captions have been replaced with studio and lifestyle photography (`apps/web/src/lib/managedPhotos.ts`, `apps/web/src/lib/images.ts`, `apps/mobile/src/photos.ts`).
   - Admin Product Management supports client-side image file upload (auto-compressed to WebP data URI with live preview) as well as selection from the Califnco studio photography preset library.

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional for local persistence mode; required for live Firebase/Razorpay)
cp apps/web/.env.example apps/web/.env
```

There are two supported local workflows. Pick one - do not run both against the same ports:

**A) Full stack, one command (recommended for checkout / order / payment testing):**

```bash
npx vercel dev
```

Vercel Dev's own router owns `http://localhost:3000` and serves both the Vite frontend
(it spawns Vite as a child process internally) and the `/api/*` serverless functions
through that single port. Use this whenever you need `/api/orders/create`,
`/api/payments/*`, or any other backend route to actually work.

`vercel.json` points `devCommand` at `npm run dev:vercel` (not the plain `dev` script),
which disables Vite's HMR websocket for this workflow only. With some Vercel CLI
versions, the HMR websocket upgrade proxied through Vercel Dev's router fails its
handshake and crashes the whole dev process with `ECONNRESET` - taking the API routes
down with it. `vercel dev` is for exercising the real checkout/payment flow, not for
live-editing the UI, so losing hot-reload there in exchange for a dev server that
doesn't crash is the right trade-off. You'll need to manually refresh the page after
editing frontend code while `vercel dev` is running. Plain `npm run dev` (below) is
unaffected and keeps full HMR.

**B) Frontend-only, fast UI iteration (no API):**

```bash
npm run dev                   # Web app only, http://localhost:5173, API calls will fail
```

If you also need working API calls while using the fast Vite-only dev server, run the API
in a second terminal on a dedicated, non-conflicting port and tell Vite to proxy to it:

```bash
# terminal 1 - API only, deliberately NOT port 3000 to avoid colliding with workflow A
API_DEV_PORT=3001 npx vercel dev --listen 3001

# terminal 2 - Vite, proxying /api to the port above
VITE_USE_API_PROXY=1 API_DEV_PORT=3001 npm run dev
```

`VITE_USE_API_PROXY` defaults to off and `API_DEV_PORT` defaults to `3001`; both are opt-in
so a plain `npm run dev` never silently tries to reach a port nothing is listening on.

### Local Development Test Accounts (when running without external Firebase credentials)
- **Administrator**: `admin@califnco.com` / `Admin1234`
- **Approved Dealer**: `dealer@bluedroptraders.in` / `Dealer1234`
- **Retail Customer**: `asha.rao@example.com` / `Customer1234`

## Verification, Typecheck, Tests & Production Build

```bash
npm test            # Unit & domain validation tests (Vitest)
npm run typecheck   # TypeScript verification across shared, web, and api
npm run build       # Production bundle build into apps/web/dist
npm run test:rules  # Firestore security rules test suite (requires Firebase Emulator)
```

## Android Application (Expo)

```bash
cd apps/mobile
cp .env.example .env
npm install
npx expo start --android
```

## Razorpay hosted Payment Links (test mode)

The checkout creates a **new Razorpay Payment Link per order** using the server-calculated order total (INR paise). It does not trust an amount sent by the browser and does not use a fixed hosted Payment Page URL. Razorpay returns the customer to `/api/payments/callback`; that server endpoint validates the callback signature, fetches the Payment Link from Razorpay, checks that it is fully paid for the exact order total, and only then marks the order `paid_verified` before redirecting to the order-confirmation page.

Configure these as **server-only Vercel environment variables** (not `apps/web/.env`, and never with a `VITE_` prefix):

- `RAZORPAY_KEY_ID` — Razorpay test key beginning `rzp_test_`
- `RAZORPAY_KEY_SECRET` — matching Razorpay test secret
- `APP_BASE_URL` — public HTTPS origin for the deployed CALIFNCO site, for example `https://your-production-domain.example` (no trailing slash)
- `FIREBASE_SERVICE_ACCOUNT_B64` — existing Firebase Admin service account value

Set the variables for the environment being tested, then redeploy. Razorpay cannot redirect to a localhost-only callback. Use Razorpay test credentials for end-to-end testing; do not switch to live keys until the payment flow and order reconciliation are tested. If Razorpay credentials are absent, the app uses its existing demo checkout and does not charge a customer.
