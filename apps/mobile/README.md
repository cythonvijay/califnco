# CALIFNCO Mobile — shared website experience

This project intentionally runs the **existing CALIFNCO web application inside an Expo WebView** instead of maintaining a second copy of its product catalog, authentication, checkout, dealer logic, or admin functionality. This is the safest way to keep the same UI and the same actions while the website is the source of truth.

## Why this fixes the previous mismatch

- No bundled demo/default products are rendered by the mobile shell.
- The live website's own catalog hook and data/API logic decide which products appear. Draft, archived, or unpublished products follow the same rules as the site.
- Login, registration, password reset, role checks, customer profile, dealer pages, admin pages, orders, and service flows are the website's actual screens and code.
- Checkout uses the same website order creation/payment API. External Razorpay/payment links open in the device browser; when the user returns, the web app reloads so it can show server-verified order status.
- There is no separate native Firebase config to copy. Firebase is configured by the deployed website itself. Do not place service-account keys or Razorpay secrets in this folder.
- If the site is unreachable, the app shows a connection error; it does **not** silently substitute a fake catalog.

The dependency patch under `patches/` fixes the published `react-native-webview@14.0.1` TypeScript generic issue so strict typechecking does not fail on all WebView props. It changes only the library declaration default from `undefined` to `{}`; runtime library code is unchanged.

## Requirements

- Node.js 22.13 or newer (recommended for the Expo SDK in this project).
- A reachable, correctly deployed CALIFNCO website.
- Expo Go compatible with the installed Expo SDK for development, or an EAS/development build.

## Setup

1. Open this folder directly in VS Code.
2. Install packages for this independent mobile package (the website monorepo is not installed or modified):

   ```powershell
   npm install --workspaces=false
   ```

3. Copy `.env.example` to `.env`.
4. Set `EXPO_PUBLIC_SITE_URL` to the exact canonical HTTPS website URL. The default is the deployment previously used in this project; update it if your Vercel domain changed.
5. Verify TypeScript and Expo configuration:

   ```powershell
   npm run typecheck
   npx expo-doctor
   ```

6. Start Expo:

   ```powershell
   npx expo start --tunnel
   ```

7. Scan the newly generated QR code using Expo Go that supports this project's Expo SDK.

## What must be verified on your device

This environment could not contact the deployment or download npm packages, so it cannot truthfully claim a live device test. After setup, verify that the configured URL opens in a phone browser first, then in the app. Test customer sign-up/sign-in, admin sign-in, product publish/unpublish, catalog refresh, cart, order placement, payment link, and payment callback. All these operations are handled by the deployed web app; the mobile shell does not write directly to Firestore.

## Security

Only put `EXPO_PUBLIC_SITE_URL` in `.env`. Do not copy website `.env`, Firebase Admin service-account credentials, Razorpay secrets, or EmailJS private keys into the mobile project. If any real private credentials were exposed in screenshots or archives, rotate them at the provider.
