# worries

A black-and-white Linktree-style website for online people. Built with Node, Express, EJS, SQLite, and sessions.

## Features

- Landing page for `worries`
- Register/login/logout
- Dashboard profile editor
- Public pages at `/u/username`
- Custom profile picture URL
- Custom banner URL
- Custom bio
- Custom buttons/links
- Optional custom icons for buttons
- Manual Discord status display
- Free/VIP system
- VIP-only custom fonts and music URL
- Basic view counter
- Mobile-friendly black/white aesthetic

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

## Render deployment

1. Push this folder to GitHub.
2. Create a new Render Web Service.
3. Connect the GitHub repo.
4. Set build command:

```bash
npm install
```

5. Set start command:

```bash
npm start
```

6. Add environment variables:

```text
SESSION_SECRET=make-this-a-long-random-secret
BASE_URL=https://your-render-url.onrender.com
NODE_ENV=production
```

## Important Render note

This starter uses SQLite because it is simple. On Render, normal app storage can reset when the service redeploys unless you use a persistent disk. For a real public website, upgrade the database to PostgreSQL or attach a Render persistent disk.

## VIP payments

The VIP button is currently a demo upgrade button. Replace `/vip/demo-upgrade` with a real payment provider later, such as Stripe, Coinbase Commerce, PayPal, or another processor.

## Uploads

This starter uses image/song URLs instead of file uploads. That is better for Render because local uploads can disappear without persistent storage. Later, use Cloudinary, UploadThing, S3, or another file storage service for profile pictures, banners, icons, and music files.
