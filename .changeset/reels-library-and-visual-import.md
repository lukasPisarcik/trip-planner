---
'trip-planner': minor
---

Add a Reels Library and a Claude-vision import path so image-only reels finally yield spots.

**Visual import.** A new `read_post_visuals` agent tool reads what a reel _shows_, not just what it says: `yt-dlp` downloads the clip, `ffmpeg` samples a few keyframes, and a one-shot Claude-vision query (reusing the Claude Code license — no metered API key) returns `{ onScreenText, visualDescription }`. The co-pilot calls it when the caption and transcript come back thin, so a reel whose value is a burned-in menu, signage, or dish montage now produces real spots. The vision service is dependency-light and no-ops gracefully when `yt-dlp`/`ffmpeg`/the CLI are missing.

**Library.** A new `/library` route: an Instagram-saved-style grid where you paste a TikTok/Instagram URL and the reel appears immediately in a `processing` state while a background job fills its caption, transcript, on-screen text, and visual description, then flips it to `ready` live via Convex. Each reel keeps a durable cover thumbnail in Convex file storage (survives Instagram link expiry), and reels can be organised into their own folders (create/rename/delete/move), namespaced separately from trip folders.

**Build from reels.** Select reels and hit **Build trip** to attach them as chips in the co-pilot composer; you still write the prompt, and the chat route hydrates each reel's stored text server-side (by id) and folds it into the agent's context — so the trip is built from the reels plus your words.

Adds two Convex tables (`reels`, `reelFolders`) and a `FFMPEG_PATH` env var. Everything write-facing (the `/library` route, save/CRUD, Build trip) is hidden under `VIEWER_MODE` and blocked at the Convex layer without `OWNER_WRITE_SECRET`.
