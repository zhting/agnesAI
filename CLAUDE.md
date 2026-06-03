# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a lightweight Node.js web server (no dependencies, no package.json) that provides a local dashboard for the **Agnes AI Gateway** platform. It exposes two AI capabilities:

1. **Video Generation** — async task-based workflow via `agnes-video-v2.0` (text-to-video, image-to-video, multi-image video, keyframe animation)
2. **Image Generation** — synchronous image generation via `agnes-image-2.1-flash` (text-to-image, image-to-image, composition/preservation, high-density optimization)

## Structure

| File | Purpose |
|------|---------|
| `server.js` | Express-free Node.js HTTP server (port 3000, localhost only) |
| `index.html` | Single-page dashboard UI — all CSS + JS inline |
| `start.bat` | Windows batch script that runs `node server.js` |
| `key.txt` | Local file for persisting the user's Agnes API key |

## How to Run

```bash
node server.js
# or double-click start.bat on Windows
```

The server starts on `http://127.0.0.1:3000`. No build step or package manager needed.

## Architecture

### Server (`server.js`)

A single `http.createServer()` callback routes four endpoint families:

1. **`GET /` or `/index.html`** — serves the dashboard HTML
2. **`GET/POST /api/key`** — read/write the API key from `key.txt`
3. **`GET /video-proxy?url=...`** — HTTPS proxy for videos hosted on `storage.googleapis.com` (bypasses China network restrictions)
4. **`/v1/*`** — reverse proxy to `https://apihub.agnes-ai.com/v1/*`
   - Reads API key from `X-Api-Key` header, falls back to `key.txt`
   - Strips query params from `req.url` before forwarding
   - Streams upstream response to client

### Dashboard (`index.html`)

Single-page app with no framework. Key sections:

- **Media tabs** (top level): toggle between Video Generation and Image Generation cards
- **Video modes**: text-to-video, image-to-video, multi-image video, keyframe animation — controlled by secondary tabs
- **Image modes**: text-to-image, image-to-image, composition, high-density — controlled by secondary tabs
- **API key**: auto-saved to both `localStorage` and `key.txt` with debounced POST to `/api/key`
- **Image paste/drop**: local images are read as Base64 and embedded directly into URL fields
- **Video polling**: 3-second interval polling of `/v1/videos/{task_id}` with retry logic for both server errors and network errors (max 10 server retries, 5 network retries)
- **Video playback**: video URLs are proxied through `/video-proxy` to avoid CORS/GCS blocking in China

### API Key Storage

The API key is stored in two places:
- `key.txt` on disk (used by server for proxying)
- `localStorage` in browser (used as fallback)

## Agnes API Reference

See `AI Gateway, Free AI API & AI Applications.md` for full API documentation.

Key endpoints:
- **Create video task**: `POST https://apihub.agnes-ai.com/v1/videos` → returns `{id, status, progress}`
- **Get video result**: `GET https://apihub.agnes-ai.com/v1/videos/{task_id}`
- **Generate image**: `POST https://apihub.agnes-ai.com/v1/images/generations` → returns `{data: [{url}]}`

Video model: `agnes-video-v2.0`, async with statuses: `queued` → `in_progress` → `completed` / `failed`
Image model: `agnes-image-2.1-flash`, sync response

Important constraints:
- `num_frames` must satisfy `8n + 1` and be ≤ 441
- Video URLs may come from `video_url` or `remixed_from_video_id` field
