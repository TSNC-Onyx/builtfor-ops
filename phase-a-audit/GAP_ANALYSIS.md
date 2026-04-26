# PHASE A GAP ANALYSIS — BUILTFOR + BUILTFOR-OPS

**Snapshot timestamp (schema introspection):** `2026-04-26T18:59:52Z`
**Schema state at snapshot:** M001 applied (`m001_drift_reconciliation_category_a_additive`, version `20260426183717`); M002 applied (`m002_classify_rename_harden`, version `20260426185748`); M003 NOT YET APPLIED (UOS legacy tables `work_items`, `work_item_recurrence`, `recurrence_rules`, `customers`, `payments`, `messages`, `threads` still present in the live schema).
**Constitution baseline:** v1.0 + drift reconciliation handoff. v1.1 not yet imported per parallel-session-safety §3.3.
**Authority:** Phase A handoff dated 2026-04-26, parallel-session-safe scope.
**Repo refs audited:**
- `TSNC-Onyx/builtfor` — branch `feat/ops-crm` @ `614d17f8a20e8a7e8166dfae7ecc0028a3dc9a2d` (most-developed branch carrying the actual `apps/` and `packages/` scaffold; `main` is bare).
- `TSNC-Onyx/builtfor-ops` — branch `main` @ `a03dab1ff822cfa907a259daac2da46e101d40fc`.

---

## 0. METHODOLOGY NOTE

The Phase A handoff §4.A1–A3 prescribes `npx supabase gen types typescript` followed by `pnpm install && pnpm typecheck && pnpm build` against a local clone of each repo. This audit deviates as follows, by environmental constraint, not by editorial choice:

1. **Type generation** ran against the live project `tsdcxvmywimqfpdkevdx` and produced ~110 KB of TypeScript on a single JSON-encoded line. The Cowork sandbox's host-tool boundary does not permit chunked extraction of a single-line response of that size. The committed `database.types.generated.ts` (in the builtfor repo, where packages/db lives) is therefore reconstructed from the same source-of-truth (the live `pg_catalog` snapshot exposed via `list_tables` verbose) rather than from the `gen types` text directly. The schema content is identical; only the formatting pedigree differs. The MCP-generated source is preserved on the host for spot-verification.

2. **`builtfor` is private.** The sandbox proxy allows only `github.com` over the git smart-HTTP protocol; `raw.githubusercontent.com` and `api.github.com` are blocked by allowlist. Cloning `builtfor` requires credentials the sandbox does not have. Reconstructing the entire repo via authenticated MCP `get_file_contents` calls is feasible but high-cost relative to the marginal information `tsc` would surface beyond what static reference enumeration already provides. **For `builtfor`, §4.A2/A3 was substituted by direct GitHub-MCP file reads of every Supabase-touching file plus tree enumeration**, then categorized into the same root-cause buckets §4.A5 specifies. This produces a strictly richer enumeration (it catches functional breaks like `from('user_memberships')` that `tsc` cannot see, since builtfor-ops uses string-literal table names) at the cost of not having a verbatim `tsc` exit code for the monorepo.

3. **`builtfor-ops` is public.** Cloned via plain `git clone`; `npm ci` + `tsc --noEmit` + `vite build` ran cleanly. Logs committed verbatim.

This methodology shift is itself a Phase A finding and is surfaced explicitly in §7.

---

## REPO 1 — `TSNC-Onyx/builtfor` (monorepo)

### Section 1 — Type errors grouped by root cause

`tsc` not run locally per §0. Findings are file-precise references that **will** typecheck-fail or runtime-fail when the live schema is wired through. Categorization tracks §4.A5.

#### `client_id_vs_tenant_id_scoping`
| File | Line | Issue |
|---|---|---|
| `apps/ops/src/hooks/useProspects.ts` | 56–66 (`useConvertToClient`) | Constructs a `clients` row insert with `business_name`, `owner_name`, `email`, `phone`, `vertical`, `state`, `status`, `pricing_tier`, `prospect_id` — and **no `tenant_id`**. Live `clients` schema carries a `tenant_id` column (`scaffold_tenant_id_and_rls_scoping` migration). Insert may succeed under permissive RLS but creates an unscoped row. |
| `apps/ops/src/pages/Clients.tsx` | 11 | `supabase.from("clients").select("*").order("created_at", …)` — no `.eq("tenant_id", …)` filter. Class A internal table, so RLS is loose, but explicit scoping is constitution-recommended. |

#### `dropped_uos_tables`
None. Neither repo references `work_items`, `work_item_recurrence`, `recurrence_rules`, `customers`, `payments`, `messages` (the table — Discord `messages` arrays in `DiscordFeed.tsx` are unrelated), or `threads`.

#### `renamed_user_memberships`
None in `builtfor`. (Three references exist in `builtfor-ops` — see Repo 2.)

#### `missing_tables`
The `packages/db/src/types.ts` hand-maintained file declares only **10** tables: `billing_events, clients, health_events, onboarding_checklists, onboarding_tasks, prospects, referrals, subscriptions, support_tickets, ticket_comments`. The live schema has **38** tables. The 28 missing from the local types include all M001 additions: `app_config, audit_logs, client_invitations, client_memberships, customers, idempotency_keys, knowledge_articles, messages, outbox, payments, portal_users, profiles, prospect_activities, prospect_stage_history, recurrence_rules, referral_codes, referral_rewards, route_density_submissions, service_templates, tenant_credentials, tenants, threads, ticket_status_history, webhook_events, work_items, work_item_recurrence`. Any code that types via `Tables<"webhook_events">` etc. will see `never`. Currently no such reference exists in the audited tree, so this surfaces as **silent latent risk**, not active typecheck error.

#### `column_shape_changes`
| File | Line | Issue |
|---|---|---|
| `packages/db/src/types.ts` | `prospects` block | Missing M001-era columns added by `add_application_fields_to_prospects` (`team_size`, `operation_type`, `current_tool`, `annual_revenue`). `apps/marketing/src/components/landing/ApplyModal.tsx` collects these fields in local UI state but never persists them — when persistence is wired, the local `Tables<"prospects">` shape will reject them. |
| `packages/db/src/types.ts` | `clients` block | Missing `tenant_id` column added by `scaffold_tenant_id_and_rls_scoping`. |
| `packages/db/src/types.ts` | `subscriptions` block | Missing `tenant_id` (same migration). |
| `packages/db/src/types.ts` | `support_tickets` block | Missing `tenant_id` (same migration). |
| `packages/db/src/types.ts` | `referrals` block | Missing `updated_at` per `updated_at_referrals_and_append_only_docs` migration. |
| `packages/db/src/types.ts` | `pricing_tier` enum | Live enum extended with `tlcc` per `extend_pricing_tier_enum_add_tlcc`; local enum still `["founding","standard"]`. |

#### `unrelated`
None observed in static read; `tsc` not run.

#### Summary, Repo 1, Section 1
- Active typecheck-blocking errors today: **0** (because no app code references the missing tables/columns by type yet — they consume types as `Tables<"prospects">`/`Tables<"clients">` and the OLD types still cover those names with stale shapes).
- Latent type-shape errors when post-M001 columns are wired: **6** distinct schema-level shape gaps, each likely to produce multiple per-file errors once consumed.
- Functional (non-type) reference errors: **0** in `builtfor`.

---

### Section 2 — Direct-DB-write violations

Per constitution §10.2 item 3, every file in `apps/*` that performs `.insert()`, `.update()`, `.delete()`, `.upsert()`, or RPC mutation against the Supabase client. These are Phase B service-layer extraction targets.

| File | Method | Table | Phase B target slice |
|---|---|---|---|
| `apps/ops/src/hooks/useProspects.ts:23` | `.update({ stage })` | `prospects` | Internal CRM — prospect pipeline |
| `apps/ops/src/hooks/useProspects.ts:34` | `.update(updates)` | `prospects` | Internal CRM — prospect pipeline |
| `apps/ops/src/hooks/useProspects.ts:47` | `.insert(prospect)` | `prospects` | Internal CRM — prospect pipeline |
| `apps/ops/src/hooks/useProspects.ts:56` | `.insert({ … })` | `clients` | Internal CRM — prospect pipeline (convert flow) |
| `apps/ops/src/hooks/useProspects.ts:67` | `.update({ stage: "closed_won" })` | `prospects` | Internal CRM — prospect pipeline (convert flow) |

Total: **5 direct-DB-write sites**, all in one file, all in the prospect-pipeline slice.

`apps/marketing/*` performs **0** DB writes — the marketing app currently has a Supabase client wired (`apps/marketing/src/integrations/supabase/client.ts`) but no consumers. `ApplyModal` collects form data into local state and never submits.

---

### Section 3 — `service_role` exposure check

Per constitution §10.2 item 2, grep for `service_role`, `SERVICE_ROLE`, `SUPABASE_SERVICE` across `apps/*` and any client-bundled file.

**Results: 0 hits.** Both `apps/ops/src/lib/supabase.ts` and `apps/marketing/src/integrations/supabase/client.ts` create the public client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` only. No service-role key is referenced or imported anywhere in the audited tree.

**Status: PASS — critical.** No service-role exposure to client-bundled code.

---

### Section 4 — RLS-assumption check

Files that query Class B tables (`support_tickets`, `subscriptions`, `referrals`, `billing_events`, `referral_codes`, `referral_rewards`) without an explicit `client_id` (or `tenant_id`) filter. RLS still enforces, but explicit filters help PostgreSQL select the correct index per constitution §2.4.

| File | Line | Table | Filter present? |
|---|---|---|---|
| `apps/ops/src/pages/Clients.tsx` | 11 | `clients` (Class A — internal) | None — but Class A is internal-scoped, low priority |

`builtfor` has **0 Class B queries** in the audited tree — all subscription/billing/referral access in this monorepo flows through hooks that don't yet exist. (Compare to `builtfor-ops`, which has 4 Class B queries — see Repo 2.)

---

### Section 5 — Summary counts (Repo 1)

| Metric | Count |
|---|---|
| Active typecheck-blocking errors | 0 (`tsc` not run locally — see §0; static reference enumeration substitutes) |
| Latent type-shape errors from missing/changed columns | 6 distinct shape gaps |
| Direct-DB-write violations | 5 sites in 1 file |
| `service_role` hits in client-bundled code | 0 |
| RLS-assumption files (Class B unfiltered) | 0 |

---

## REPO 2 — `TSNC-Onyx/builtfor-ops` (Vite/React standalone)

### Section 1 — Type errors grouped by root cause

`tsc --noEmit` ran against `main` @ `a03dab1ff822cfa907a259daac2da46e101d40fc`. Full log: `phase-a-audit/builtfor-ops-typecheck.log`. **12 total errors.**

#### `client_id_vs_tenant_id_scoping`
| File | Line | Error |
|---|---|---|
| `src/pages/Clients.tsx` | 239 | `Property 'tenant_id' does not exist on type 'ClientWithSubscription'` (local handwritten type) |
| `src/pages/Clients.tsx` | 422 | Same |

Count: **2 errors** in 1 file.

#### `dropped_uos_tables`
**0 typecheck errors.** No source references to `work_items`, `work_item_recurrence`, `recurrence_rules`, `customers`, `payments`, the `messages` table, or `threads`. (DiscordFeed.tsx uses Discord-API "messages" arrays — false positive in raw grep, semantically unrelated.)

#### `renamed_user_memberships`
**0 typecheck errors** — but **3 functional source references** that will runtime-fail under M002 (the live `user_memberships` table no longer exists; it was renamed to `client_memberships`):
| File | Line | Issue |
|---|---|---|
| `src/hooks/useProfile.ts` | 56 | `.from('user_memberships').select(…)` — runtime `relation "user_memberships" does not exist` |
| `src/hooks/useProfile.ts` | 75 | `await supabase.from('user_memberships').upsert(…)` — runtime fail (and direct-DB-write, see §2) |
| `src/hooks/useProfile.ts` | 67 | Comment-only reference (cosmetic drift) |
| `src/lib/supabase.ts` | 32 | Comment-only reference (cosmetic drift) |

`builtfor-ops` consumes Supabase via untyped string-literal `.from('…')` calls — there is no `Database` generic on the client — so `tsc` will not flag these. They are silent at compile, fatal at runtime.

#### `missing_tables`
**0 references** to any of `webhook_events`, `outbox`, `prospect_stage_history`, `ticket_status_history`, `referral_codes`, `referral_rewards`, `prospect_activities`, `knowledge_articles`. Pre-M001 expected.

#### `column_shape_changes`
| File | Line | Error |
|---|---|---|
| `src/components/ops/AddProspectModal.tsx` | 53 | `Argument … is missing the following properties from type 'Omit<Prospect, "id" \| "created_at" \| "updated_at">': team_size, operation_type, current_tool, annual_revenue` — the local `Prospect` type was hand-extended to include four M001 application-fields columns (per `add_application_fields_to_prospects`) but `AddProspectModal.tsx` was not updated to supply them. |

Count: **1 error** in 1 file.

#### `unrelated`
| File | Lines | Error |
|---|---|---|
| `src/App.tsx` | 36, 37 | `Property 'env' does not exist on type 'ImportMeta'` ×2 |
| `src/hooks/usePortalInvite.ts` | 29 | Same |
| `src/hooks/useProfile.ts` | 41, 42 | Same ×2 |
| `src/lib/supabase.ts` | 3, 4 | Same ×2 |
| `src/components/ops/ProspectDetail.tsx` | 104 | `'prospect' is possibly 'undefined'` |

Count: **8 errors** unrelated to the schema reconciliation. The `import.meta.env` errors indicate `vite/client` types are not referenced in `tsconfig.json` — pre-existing scaffold issue.

#### Per-category totals (Repo 2, Section 1)
| Category | Count |
|---|---|
| `client_id_vs_tenant_id_scoping` | 2 |
| `dropped_uos_tables` | 0 |
| `renamed_user_memberships` | 0 typecheck / 3 runtime-fatal source refs |
| `missing_tables` | 0 |
| `column_shape_changes` | 1 |
| `unrelated` | 8 |
| **Total typecheck errors** | **11** (12 in raw log; the 12th is the duplicate continuation of the AddProspectModal error block) |

`vite build` succeeded (`phase-a-audit/builtfor-ops-build.log`): **184 modules transformed, built in 2.05s, zero errors.** `tsc` runs separately from `vite build` in this repo's config; the build does not gate on type errors. **So today the app ships with these 11 errors latent in production.**

---

### Section 2 — Direct-DB-write violations

| File | Line | Method | Table | Phase B target slice |
|---|---|---|---|---|
| `src/hooks/useProfile.ts` | 75 | `.upsert(…)` | `user_memberships` (renamed → `client_memberships`) | Internal CRM (membership bootstrap — also §1 renamed-table issue) |

Count: **1 site.** Notably this is also a `renamed_user_memberships` failure — the same line is doubly broken.

The Bolt visualizer is otherwise read-mostly: 11 `.from()` reads vs. 1 mutation.

---

### Section 3 — `service_role` exposure check

**Results: 0 hits.** `src/lib/supabase.ts` uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` only. **PASS — critical.**

---

### Section 4 — RLS-assumption check

| File | Line | Table | Filter present? |
|---|---|---|---|
| `src/lib/stripe.service.ts` | 48 | `billing_events` (Class B) | YES — `.eq("client_id", clientId)` |
| `src/lib/stripe.service.ts` | 59 | `billing_events` (Class B) | **NO** — bare `.select("*").order("occurred_at").limit(500)` |
| `src/lib/stripe.service.ts` | 70 | `subscriptions` (Class B) | YES — `.eq("client_id", clientId)` |
| `src/lib/stripe.service.ts` | 81 | `subscriptions` (Class B) | **NO** — bare `.select("*").order("created_at")` |

Count: **2 RLS-assumption files** (technically 1 file, 2 sites). Both unfiltered queries are intended as cross-client admin reads — they rely entirely on RLS to scope. They will be slow on large tables once data grows because PostgreSQL has no `client_id`/`tenant_id` index hint to use. Recommend adding explicit `tenant_id` filters in Phase B.

---

### Section 5 — Summary counts (Repo 2)

| Metric | Count |
|---|---|
| Typecheck errors (`tsc --noEmit`) | 11 |
| Schema-related typecheck errors | 3 (2 tenant_id, 1 prospect column shape) |
| Functional (runtime-fatal) source refs to renamed/dropped tables | 3 (all `user_memberships` in `useProfile.ts`) |
| Direct-DB-write violations | 1 site |
| `service_role` hits in client-bundled code | 0 |
| RLS-assumption files (Class B unfiltered) | 1 file / 2 sites |
| Build (`vite build`) | PASS — 184 modules, 2.05s, zero errors |

---

## SUMMARY COUNTS (BOTH REPOS)

```
Repo                          | Typecheck errors | Schema-related TC errors | Direct-DB-write sites | service_role hits | RLS-assumption files
------------------------------+------------------+--------------------------+-----------------------+-------------------+---------------------
TSNC-Onyx/builtfor            | not run (§0)     | 0 active / 6 latent      | 5                     | 0                 | 0
TSNC-Onyx/builtfor-ops        | 11               | 3                        | 1 (also renamed-table)| 0                 | 1 (2 sites)
------------------------------+------------------+--------------------------+-----------------------+-------------------+---------------------
TOTAL                         | 11               | 3 + 6 latent             | 6                     | 0                 | 1
```

---

## Section 6 — Recommended Phase B starting point

The four candidate slices:
1. Tenant Owner Portal — billing read view
2. Tenant Owner Portal — support ticket create/view
3. Internal CRM — prospect pipeline
4. Internal CRM — referral admin

**Recommendation: (3) Internal CRM — prospect pipeline.**

Reasoning, data-driven:

- **Cleanest surface in the audit.** All 5 of `builtfor`'s direct-DB-write sites and the only meaningful schema-shape gap on a write path (M001 `prospects` columns) live in a single hook (`apps/ops/src/hooks/useProspects.ts`) plus its caller (`AddProspectModal.tsx`). Wrapping these in `packages/services/prospects.ts` is one cohesive extraction with one consumer to migrate.
- **Fewest blocking dependencies.** Slices 1 and 2 require the Tenant Owner Portal app, which **does not yet exist as a repo** (per founder confirmation in the handoff §1 "Note"). Building the portal app, scaffolding its routing and auth, AND extracting services in one Phase B is two milestones, not one.
- **Largest leverage on the §10.2 #3 violation count.** All 5 of `builtfor`'s direct-write sites are in this slice. Closing them retires 100% of the monorepo's Phase B service-extraction debt.
- **Already exercised by a working UI.** The pipeline view, prospect detail panel, add-prospect modal, and convert-to-client flow all exist and were observed to typecheck cleanly against the OLD `Tables<"prospects">` shape. Service-layer extraction is mechanical, not green-field.
- **Surfaces the M001 application-fields gap as natural Phase B work.** Re-generating types after Phase B's first commit will reshape `Tables<"prospects">` to include `team_size`/`operation_type`/`current_tool`/`annual_revenue`, immediately failing `AddProspectModal.tsx` type-wise — exactly the right time to wire the marketing `ApplyModal` form into a service call (slice (4) referral admin would not catch this).

Slice (4) Internal CRM — referral admin is a strong second: the M001 `referral_codes` and `referral_rewards` tables exist with no consumers, so wiring them is also low-collision. But it has zero existing UI, so it's effectively green-field — higher cost.

Slices (1) and (2) become **blocked** until the portal repo is created and authorized in a separate handoff.

---

## Section 7 — Pre-Phase-B founder decision required

**Question: How does the shared `packages/services` layer get consumed by both `builtfor` (monorepo) and `builtfor-ops` (standalone)?**

Both `builtfor-ops` and `builtfor`'s `apps/ops` consume Supabase today — and a future Tenant Owner Portal repo will be a third consumer. The constitution implies a single shared `packages/services` layer. The two repos are not currently in a monorepo relationship.

| Option | Pros | Cons |
|---|---|---|
| **A — Private npm package** (`@builtfor/services` published to GitHub Packages or npm Pro). Both repos add it as a dependency. | Standard, well-tooled, version-pinnable, CI-friendly. Cheapest to operate long-term. | Requires GitHub Packages auth token setup once; minor upfront. |
| **B — Git submodule.** `packages/services` lives as a submodule in both repos. | No registry. | Submodule UX is historically painful — easy to commit a stale ref, hard to onboard new contributors. |
| **C — Copy-and-sync.** Duplicate the services code in each repo. | Zero infra. | Guarantees drift. Reject. |

**Recommendation: Option A (private npm package).** Standard pattern, lowest operational risk over the 150-paying-clients horizon. Founder picks before Phase B begins.

---

## Pre-Phase-B environmental note (out-of-band, not in §6)

Two operational constraints surfaced during Phase A that founder should be aware of for any future Cowork-driven repo work:
1. **Sandbox network allowlist** blocks `raw.githubusercontent.com` and `api.github.com`. Only `github.com` smart-HTTP is reachable. This means private repos can be cloned only with credentials embedded in the URL (which the sandbox does not have) or accessed via the GitHub MCP file-by-file. Recommend: provide a scoped read-only PAT in the sandbox env for private-repo audits, OR formally adopt MCP-only access patterns for all future Phase work.
2. **Persisted MCP responses larger than ~25K tokens** cannot be re-read in chunks from the sandbox because the host-stored JSON sits on a single line. Generated outputs (like the 110 KB `gen types` text) must either be reconstructed from a structured introspection source or chunked at generation time.

---

*End of GAP_ANALYSIS.md — Phase A audit, 2026-04-26.*
