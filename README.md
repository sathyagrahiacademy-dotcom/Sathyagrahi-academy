# Sathyagrahi Academy Website

Simple, clean student portal built with Vite + vanilla JavaScript + Supabase.

## Included
- Home page
- Student login
- Protected student dashboard
- Supabase authentication
- Profile fetch from `public.profiles`
- Logout
- Mobile responsive layout

## Supabase requirements
The current code expects:
- Email/password authentication enabled
- `public.profiles` table with columns:
  - `id` uuid (linked to `auth.users.id`)
  - `full_name` text
  - `role` text
  - `created_at` timestamptz
- RLS policies allowing authenticated users to read/update/insert their own row where `auth.uid() = id`

## Local setup

1. Copy `.env.example` to `.env`
2. Add your Supabase Project URL and **public anon key**
3. Run:

```bash
npm install
npm run dev
```

## Important
Never put the Supabase service-role key in this project or in GitHub.
Only use the public anon key in the browser frontend.

## Deployment
This project is suitable for static deployment on Cloudflare Pages.
Build command: `npm run build`
Output directory: `dist`
