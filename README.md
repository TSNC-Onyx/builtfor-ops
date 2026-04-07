# BuiltFor Ops

CRM pipeline dashboard for BuiltFor — done-for-you business systems for the trades.

> **Design/test sandbox** — connected to Lovable for live preview.
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
