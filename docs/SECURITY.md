# Security notes
- Secrets only in Vercel/host env vars; `.gitignore` excludes `.env*` and service-account files. Run `git secrets`/gitleaks before pushing.
- Firebase web config is public by design; protection comes from Authentication + Firestore rules, so deploy `firestore.rules` before going live.
- Roles are custom claims set via Admin SDK; after any role change refresh tokens are revoked and the user signs in again.
- API verifies ID tokens with revocation checking; admin endpoints require `role == admin`.
- Rules test matrix: `tests/rules/firestore.rules.test.ts` (wholesale price secrecy, order immutability, product writes, dealer application state, service booking updates, role injection).
- Before production: add rate limiting (Vercel WAF), App Check, Firestore backups, an abandoned-order sweeper, and re-review rules after any schema change.
