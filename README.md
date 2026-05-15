# worries

A black-and-white, customizable link-in-bio website for online profiles.

## Features

- Create account / login
- Public pages like `/username` with old `/u/username` links redirecting
- Custom profile picture URL
- Custom banner URL
- Custom bio
- Custom link buttons
- Optional custom button icons
- Discord OAuth connection for showing a connected Discord account
- Free/VIP system
- VIP-only music URL
- VIP-only custom font field
- Landing page, about page, and VIP pricing page

## Why this fixed version exists

The first version used `better-sqlite3`. Render tried to build it with Node `v24.14.1`, and that native package failed to compile.

This version removes `better-sqlite3` and `connect-sqlite3`, so Render does not need to compile native SQLite code.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

## Deploy on Render

Use these settings:

```text
Build Command: npm install
Start Command: npm start
```

Environment variables:

```text
NODE_ENV=production
SESSION_SECRET=make-this-a-long-random-secret
BASE_URL=https://your-render-url.onrender.com
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

## Discord setup

Create an app in the Discord Developer Portal, open OAuth2, and add this redirect URL exactly:

```text
https://your-render-url.onrender.com/auth/discord/callback
```

For local testing, also add:

```text
http://localhost:3000/auth/discord/callback
```

The site uses the `identify` scope so users can connect their Discord identity. Live Discord presence/status requires a Discord bot/gateway setup later.

Optional:

```text
DATA_PATH=/opt/render/project/src/db/data.json
```

## Important database note

This starter version stores accounts/profiles in `db/data.json` so it can deploy cleanly without native SQLite build errors.

For a real public website, switch to PostgreSQL later, because Render free services can lose local file changes after redeploys unless you use persistent storage.
