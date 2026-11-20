# LifeFlow Blood Bank — Vercel deployment

This folder contains the existing Express + static HTML/CSS/JS application prepared for Vercel.

## Vercel project settings
- Root Directory: this folder (the folder containing package.json and vercel.json)
- Framework Preset: Other
- Build Command: leave blank
- Install Command: `npm install` (or leave the default)
- Output Directory: leave blank

## Environment variables
Add these in Vercel → Project → Settings → Environment Variables:
- `MYSQLHOST`: Railway public host
- `MYSQLPORT`: Railway public port
- `MYSQLUSER`: Railway MySQL username
- `MYSQLPASSWORD`: Railway MySQL password (never commit or share it)
- `MYSQLDATABASE`: `railway`
- `JWT_SECRET`: a long, unique random secret

Railway's public MySQL endpoint should be used for Vercel connectivity. TLS is enabled by default in `config.js`.

## Local development
Copy `.env.example` to `.env`, fill local values, and set `DB_SSL=false` for a local non-TLS MySQL server if needed. Run `npm install` then `npm start`.

Do not upload `.env`, database passwords, or `node_modules`.
