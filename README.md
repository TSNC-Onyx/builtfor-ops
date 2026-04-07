# BuiltFor Ops

CRM pipeline dashboard for BuiltFor — done-for-you business systems for the trades.

> **Design/test sandbox** — connected to Bolt.new for live visual preview.
> Production source of truth: [TSNC-Onyx/builtfor](https://github.com/TSNC-Onyx/builtfor)

## Stack
- Vite + React + TypeScript
- Tailwind CSS
- Supabase (project `tsdcxvmywimqfpdkevdx`)
- TanStack Query

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```

## Routes
- `/` — Dashboard
- `/pipeline` — CRM Kanban board
- `/clients` — Active clients

## Features
- Discord live feed: floating bubble (bottom-right, all authenticated pages) opens a `#general` panel via Supabase Edge Function `discord-messages`
- Auth bypassed automatically in Bolt.new preview (no env vars = placeholder Supabase URL detected)
