# NZ Services Directory — Supabase Setup Guide

## Quick Start

The site works out of the box in **demo mode** using the sample data in `data.js`. To enable the full Supabase backend (real auth, database, registration), follow the steps below.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up / sign in.
2. Click **New Project**.
3. Choose an organisation, give it a name (e.g. `nz-services-directory`), set a database password, and pick the **Sydney (ap-southeast-2)** region for lowest latency from NZ.
4. Wait for the project to finish provisioning (~1 minute).

## 2. Get Your API Credentials

1. In your Supabase dashboard, go to **Settings → API**.
2. Copy the **Project URL** (e.g. `https://abcdefghij.supabase.co`).
3. Copy the **anon / public** key (starts with `eyJ...`).

## 3. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**.
2. Click **New query**.
3. Open the file `schema.sql` from this project and paste the entire contents into the editor.
4. Click **Run** (or press Ctrl+Enter).
5. This creates all tables, indexes, RLS policies, triggers, and seeds the database with 15 regions, 20 categories, and 22 sample listings.

## 4. Configure the Frontend

Open `supabase-client.js` and fill in your credentials on lines 4–5:

```js
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';
```

Save the file. The site will now use Supabase for all data operations.

## 5. Enable Email Auth (Optional)

By default, Supabase sends a confirmation email when users register. To test locally without email:

1. Go to **Authentication → Providers → Email** in your Supabase dashboard.
2. Toggle **Confirm email** OFF (for development only — turn it back on for production).

## 6. Deploy

Commit and push your changes:

```bash
git add -A
git commit -m "Add Supabase backend integration"
git push origin master
```

Your GitHub Pages site at `https://bill188.github.io/nz-services-directory/` will update automatically.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Frontend (GitHub Pages)                     │
│  index.html · styles.css · app.js           │
│  supabase-client.js · data.js (fallback)    │
└──────────────┬──────────────────────────────┘
               │  Supabase JS SDK (CDN)
               ▼
┌─────────────────────────────────────────────┐
│  Supabase (Backend-as-a-Service)            │
│  ┌────────────┐  ┌──────────────┐           │
│  │ PostgreSQL  │  │  Auth (JWT)  │           │
│  │ + RLS       │  │  Email/Pass  │           │
│  └────────────┘  └──────────────┘           │
│  ┌────────────────────────────────┐         │
│  │  Full-Text Search (tsvector)   │         │
│  └────────────────────────────────┘         │
└─────────────────────────────────────────────┘
```

### How it works

- **Without Supabase configured** (empty URL/key): The app falls back to `data.js` with 40 sample listings. Auth and listing submission work in demo mode (toast messages only).
- **With Supabase configured**: All listings are fetched from PostgreSQL with server-side filtering, sorting, and pagination. Users can register/sign in with email+password. Signed-in users can submit real listings (status = `pending` until approved).

### Database Tables

| Table | Purpose |
|-------|---------|
| `regions` | 15 NZ regions (reference data) |
| `categories` | 20 service categories (reference data) |
| `profiles` | User profiles (auto-created on signup) |
| `listings` | Service providers (the main data) |
| `reviews` | User reviews (auto-updates listing rating) |
| `enquiries` | Contact form submissions |

### Row Level Security (RLS)

All tables have RLS enabled:
- **Listings**: Anyone can view approved listings. Signed-in users can create/edit/delete their own.
- **Reviews**: Anyone can read. Signed-in users can create/edit/delete their own.
- **Enquiries**: Anyone can submit. Providers can only view enquiries for their own listings.

---

## Files Reference

| File | Purpose |
|------|---------|
| `schema.sql` | Full database schema — run in Supabase SQL Editor |
| `supabase-client.js` | Supabase client wrapper — configure URL + key here |
| `data.js` | Local fallback data (used when Supabase is not configured) |
| `app.js` | Main application logic (auto-detects Supabase vs local mode) |
| `index.html` | Main page (includes Supabase JS SDK via CDN) |
| `styles.css` | All styles including auth UI |
