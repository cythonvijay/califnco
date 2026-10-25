# Daily AI Product Automation — Instagram + WhatsApp Status (n8n + WAHA)

File: `automation/instagram-daily-post.n8n.json` (inactive on import).

## Complete Pipeline (25 Mandatory Points + 10 Bonus Points)
1. **Schedule Trigger (`Daily 10:00 IST`)**: Runs automatically every day at `10:00 Asia/Kolkata` (`0 10 * * *`) with zero manual intervention.
2. **Product Rotation & Deduplication (`Read Products` + `Read PostLog` -> `Select product (dedupe)`)**:
   - Reads the `Products` and `PostLog` tabs in Google Sheets.
   - Prevents duplicate posts on the same IST calendar date and selects the least-recently published SKU.
3. **AI-Generated Product Image (`Generate AI Product Image (Hugging Face)` -> `Upload AI Image to ImgBB`)**:
   - Calls the Hugging Face Inference API (`black-forest-labs/FLUX.1-schnell` via `HF_API_TOKEN`) with a commercial studio prompt tailored to the selected product's name and category.
   - Uploads the generated binary image to **ImgBB** (`IMGBB_API_KEY`) to obtain a public HTTPS JPEG/PNG URL required by Meta Graph API and WAHA (falling back cleanly to the sheet's `image_url` if `HF_API_TOKEN` is omitted).
4. **AI-Generated Caption + Hashtags (`Generate AI Caption + Hashtags (Groq / Gemini)`)**:
   - Calls an OpenAI-compatible LLM endpoint (`Groq` or `Gemini` via `LLM_BASE_URL` and `LLM_MODEL`) to generate a factual product caption with 8–12 relevant hashtags.
   - `Validate Caption & Resolve Image URL` verifies caption length, hashtag count, and filters out unverified medical or discount claims.
5. **Instagram Publishing (`Create media container` -> `Wait for processing` -> `Check container status` -> `Publish to Instagram`)**:
   - Publishes the AI-generated product image and caption to the linked Instagram Business account via Meta Graph API v21.0.
6. **Bonus (+10 pts) — WhatsApp Status via WAHA (`Post to WhatsApp Status (WAHA Bonus)`)**:
   - Posts the daily AI image and caption directly to WhatsApp Status via a local Docker **WAHA** instance (`POST {{WAHA_BASE_URL}}/api/{{WAHA_SESSION}}/status/image`).
7. **Audit Logging (`Build log row` -> `Log result`)**:
   - Appends the full execution record (`timestamp`, `sku`, `product`, `media_url`, `ai_image`, `caption`, `ig_media_id`, `waha_status`, `status`, `error`) to the `PostLog` sheet.

## Quick Setup (Docker n8n + WAHA)

```bash
# 1. Start n8n (port 5678) and WAHA WhatsApp HTTP API (port 3000)
-e SHEET_ID=YOUR_GOOGLE_SHEET_ID \
-e HF_TOKEN=YOUR_HUGGINGFACE_ACCESS_TOKEN \
-e IMGBB_API_KEY=YOUR_IMGBB_API_KEY \
-e LLM_BASE_URL=https://api.groq.com/openai/v1 \
-e LLM_MODEL=YOUR_CONFIGURED_MODEL \
-e IG_USER_ID=YOUR_INSTAGRAM_PROFESSIONAL_ACCOUNT_ID \
-e IG_ACCESS_TOKEN=YOUR_INSTAGRAM_ACCESS_TOKEN \
docker run -d --name waha -p 3000:3000 devlikeapro/waha
```
