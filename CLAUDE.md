# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run the bot
```

No build step, no tests, no linter configured.

To restart the bot after changes:
```bash
pkill -f "node src/bot.js"; npm start
```

## Architecture

Four source files, no framework beyond Telegraf:

- **`src/bot.js`** — entry point. Registers all Telegram commands (`/start`, `/room`, `/rooms`, `/invite`), the inline button callback handler (`bot.action(/^invite:.+$/)`), and the hourly cron job. Imports from all other modules.
- **`src/galene.js`** — thin HTTP client over axios. Three functions: `createRoom`, `deleteRoom`, `createInviteToken`. Reads config from env vars at module load time (not per-call). The Galène server uses a non-standard API path: `/galene-api/v0/.groups/` with dot-prefixed segments (`.groups/`, `.tokens/`). Tokens are returned in the `Location` response header, not the body.
- **`src/storage.js`** — in-memory cache backed by `data/rooms.json`. Cache is loaded once on first access and written through on every mutation. Room records include `{ name (UUID), url, userId, alias, createdAt }`. Per-user limit is `MAX_ROOMS_PER_USER = 3`.
- **`src/words.js`** — word lists for auto-generating room aliases (`color-mood-produce`) and invite usernames (`color-produce`).

## Key behaviours

- Room names in Galène are full UUIDs; the user-facing name is `alias` (stored separately).
- `presenter: [{}]` is required in the room creation body — without it users cannot enable mic/camera.
- `permissions: ['present']` is required in the token creation body — without it invite links have no media permissions.
- The invite button on `/room` messages encodes the UUID in callback data as `invite:{uuid}`.
- Rooms are scoped per Telegram `userId` — users can only see/invite to their own rooms.
