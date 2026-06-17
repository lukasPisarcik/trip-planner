---
'trip-planner': minor
---

Import TikTok and Instagram posts into a trip from the co-pilot. Paste a reel/post URL into the chat (or drop links in the brainstorm tab and use the new "import from my brainstorm notes" starter prompt) and the agent pulls it in — TikTok via the public oEmbed endpoint, Instagram by parsing OpenGraph tags — then routes it to the Food & Drink tab (cafes/bars/restaurants) or Viral Spots (sights/landmarks), preserving the platform `source` and a clickable `socialUrl`.

For narrated travel reels the agent can also transcribe the spoken voiceover (where place names usually live) with a new `transcribe_reel` tool that runs entirely locally and free — `yt-dlp` extracts the audio and `whisper.cpp` transcribes it. This requires the local prerequisites (`brew install yt-dlp ffmpeg whisper-cpp` plus a ggml model at `WHISPER_MODEL_PATH`); when they're absent (a fresh checkout or the read-only Vercel deployment) transcription silently no-ops and the feature falls back to caption + thumbnail.

Adds a dependency-light extraction service (`src/lib/server/services/social.service.ts`), a transcription service (`transcribe.service.ts`), and `extract_social_post` + `transcribe_reel` agent tools available to both the Claude and Codex providers. Viral spots gain optional `source`/`socialUrl` fields, rendered as a source badge on the viral card (mirroring the restaurant card). Extraction is best-effort: when a post is private or behind Instagram's login wall, the agent asks the traveler to paste the caption instead.
