# Architecture decision

The previous native rewrite drifted from the site: it imported a seeded catalog, rewrote authentication screens, and was incomplete (for example, screens imported source modules that were not present in the archive). A separate native implementation would require porting every page, permission, validation rule, pricing calculation, API handler, and responsive design change, and could drift again.

This mobile shell renders the live first-party website in a native WebView. Therefore the site remains one implementation for customers, verified dealers, and administrators. The WebView bridge is limited to external-link handling, payment-browser return refresh, and Android hardware-back navigation. It does not create product data or bypass API/Firebase security rules.
