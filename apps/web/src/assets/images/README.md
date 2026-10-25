# Califnco photography slots

Drop real photographs here (jpg, png, webp or avif). They are picked up automatically at build time by file name;
anything missing falls back to the neutral category artwork in `public/img/`.

| Folder | File name | Used for |
|---|---|---|
| hero/ | `hero.<ext>` | Homepage hero (wide, ~2400x900, subject on the right) |
| lifestyle/ | `family.<ext>` | "Better Water, Brighter Lives" / family section |
| installation/ | `install.<ext>` | Professional installation banner (portrait-ish, ~900x700) |
| categories/ | `purifiers.<ext>`, `dispensers.<ext>`, `pumps.<ext>`, `filters.<ext>`, `cartridges.<ext>`, `spare-parts.<ext>` | Category cards (landscape, ~800x400, subject on the right) |
| products/ | `<SKU>.<ext>` e.g. `CF-P-RO7.webp`, plus optional gallery `CF-P-RO7_2.webp`, `CF-P-RO7_3.webp` | Product cards, product page, cart, orders, admin, dealer |
| filters/ | `<SKU>.<ext>` | Optional override for filter/cartridge SKUs |

Only use photographs you own or are licensed to use, and only show a photo on the product it actually depicts.
