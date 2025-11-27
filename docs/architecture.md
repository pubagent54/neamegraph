# NeameGraph Architecture

> **Purpose:** Corporate schema control app for managing JSON-LD schema generation across ~200 corporate pages of shepherdneame.co.uk

---

## Domain Model: Three Lanes

The app uses a **three-lane architecture** to handle different page types:

### 1. **Corporate Lane** (Primary)
- **Domain:** `'Corporate'`
- **Engine:** Rules-based v2 schema generator
- **Metadata:** `page_type`, `category`, `logo_url`, `hero_image_url`, `faq_mode`
- **Rules Matching:** Active rule selected by `(page_type, category)` pair
- **UI:** Full metadata panel in PageDetail, rules coverage dashboard
- **Examples:** About pages, history, sustainability, careers, news articles

### 2. **Beer Lane** (Active)
- **Domain:** `'Beer'`
- **Engine:** Same rules-based engine as Corporate
- **Metadata:** All Corporate fields PLUS `beer_abv`, `beer_style`, `beer_launch_year`, `beer_official_url`
- **Rules Matching:** Same `(page_type, category)` logic as Corporate
- **UI:** Beer metadata panel in PageDetail
- **Examples:** Beer brand pages (e.g., Whitstable Bay, Spitfire)
- **Note:** Beer fields currently stored in `pages` table; may move to dedicated table later

### 3. **Pub Lane** (Phase 2 Placeholder)
- **Domain:** `'Pub'`
- **Engine:** Not implemented yet
- **UI:** Placeholder message, schema generation disabled
- **Examples:** Individual pub/hotel venue pages
- **Status:** Future release

---

## Pages Data Model

**Table:** `pages` (Supabase)

### Core Fields
- `id` (uuid, PK)
- `path` (text, unique) – URL path like `/beers/spitfire`
- `domain` (text) – `'Corporate'`, `'Beer'`, or `'Pub'`
- `status` (enum) – Workflow state: `not_started` → `ai_draft` → `needs_review` → `approved` → `implemented`

### v2 Metadata (Corporate/Beer)
- `page_type` (text) – e.g., `'Beers'`, `'About'`, `'News'`
- `category` (text) – e.g., `'Drink Brands'`, `'Legal'`, `'Community'`
- `logo_url` (text, nullable)
- `hero_image_url` (text, nullable)
- `faq_mode` (text) – `'auto'` or `'ignore'`
- `is_home_page` (boolean) – Special flag for homepage (manual schema only)

### Beer-Specific Fields
- `beer_abv` (numeric, nullable)
- `beer_style` (text, nullable)
- `beer_launch_year` (integer, nullable)
- `beer_official_url` (text, nullable)

### Tracking Fields
- `last_crawled_at` (timestamp) – When HTML was fetched
- `last_schema_generated_at` (timestamp) – When schema was last generated
- `last_html_hash` (text) – SHA hash of fetched HTML
- `last_schema_hash` (text) – SHA hash of generated schema
- `created_by_user_id`, `last_modified_by_user_id` (FK to users)

---

## Rules Engine

**Table:** `rules` (Supabase)

### How Rules Work

1. **Rule Structure:**
   - `id` (uuid, PK)
   - `name` (text) – Human-readable name like "Beer Drink Brands"
   - `body` (text) – The actual prompt sent to NeameGraph Brain (LLM)
   - `page_type` (text, nullable) – e.g., `'Beers'`
   - `category` (text, nullable) – e.g., `'Drink Brands'`
   - `is_active` (boolean) – Only one rule per `(page_type, category)` can be active
   - `rules_backup` (text, nullable) – Previous version for rollback

2. **Matching Algorithm:**
   ```
   When generating schema for a page:
   1. Try exact match: Find active rule where 
      rules.page_type = page.page_type AND rules.category = page.category
   2. If no match: Fall back to active DEFAULT rule where 
      rules.page_type IS NULL AND rules.category IS NULL
   3. Edge function injects matched rule body as system prompt to LLM
   ```

3. **Rule Types:**
   - **Specific rules:** `page_type` and/or `category` set → applies to matching pages
   - **Default rule:** Both `page_type` AND `category` are NULL → global fallback

4. **Rule Features:**
   - **Backup/Restore:** When editing, old body saved to `rules_backup`
   - **Coverage Dashboard:** Shows which rule covers each page type/category combo
   - **Preview/Test:** Admins can test which rule would apply before generating

### Rules UI Components

- **Rules.tsx:** Main rules management screen
  - Rules list with inline editing (admins only)
  - Coverage table showing rule assignments
  - Preview/test tool for rule selection

---

## Schema Generation Pipeline

### 1. HTML Fetching
- **Trigger:** User clicks "Fetch HTML" in PageDetail
- **Edge Function:** `fetch-html`
- **Process:**
  1. Fetches from `settings.fetch_base_url + page.path`
  2. Calculates SHA hash of HTML
  3. Compares with `page.last_html_hash`
  4. Updates `pages.last_crawled_at` and `last_html_hash`

### 2. Schema Generation
- **Trigger:** User clicks "Generate Schema" in PageDetail
- **Requirements:**
  - HTML must be fetched first (`last_html_hash` must exist)
  - `page_type` must be set (except for homepage)
  - Domain must be `'Corporate'` or `'Beer'` (not `'Pub'`)
- **Edge Function:** `generate-schema`
- **Process:**
  1. **Load context:** Page data, settings, HTML content
  2. **Select rule:** Match by `(page_type, category)` or use default
  3. **Call LLM:** Send rule body as system prompt + page data
  4. **Validate:** Check JSON-LD structure, Organization node, no commerce schema for beer brands
  5. **Save:** Create new `schema_versions` row with status `'draft'`
  6. **Update page:** Set `status = 'ai_draft'`, update `last_schema_generated_at`

### 3. Special Cases

#### Homepage Protection
- **Constraint:** `is_home_page = true` pages CANNOT use AI generation
- **UI:** "Generate Schema" button disabled with tooltip
- **Backend:** Edge function returns 400 error if called for homepage
- **Editing:** Admins can manually edit homepage schema JSON in PageDetail

#### Domain-Specific Behavior
- **Corporate:** Full v2 metadata panel, rules-based generation
- **Beer:** Beer metadata panel + Corporate metadata, same rules engine
- **Pub:** Placeholder message, generation disabled

### 4. Schema Versioning & Approval

**Table:** `schema_versions`

- Each page can have multiple schema versions
- **Workflow:**
  ```
  draft → approved (admin only) OR rejected (editor/admin)
  When approved: Page status becomes 'approved', old versions marked 'deprecated'
  ```
- **Version Fields:**
  - `version_number` (integer) – Auto-incremented per page
  - `jsonld` (text) – Raw JSON-LD string
  - `status` (enum) – `'draft'`, `'approved'`, `'deprecated'`, `'rejected'`
  - `created_by_user_id`, `approved_by_user_id`
  - `rules_id` (FK, nullable) – Which rule was used for generation

---

## Key UI Components

### Pages.tsx
- **Purpose:** Main pages list with filters and bulk actions
- **Features:**
  - Search, filter by status/page_type/domain
  - Inline editing: page_type, category, status, priority
  - Bulk actions: update section/page_type/status, delete
  - Status shown as icon-only dot with tooltip
  - Path column is clickable link to PageDetail

### PageDetail.tsx
- **Purpose:** Single page view with metadata editing and schema versions
- **Sections:**
  1. **Page header:** Path, status, stats cards
  2. **Domain selector:** Switch between Corporate/Beer/Pub lanes
  3. **Metadata panels:** Domain-specific (Corporate v2, Beer, Pub placeholder)
  4. **Action buttons:** Fetch HTML, Generate Schema, Mark Implemented
  5. **Schema Versions tabs:** Summary, Story, JSON with copy buttons

### Rules.tsx
- **Purpose:** Rules management for admins
- **Three sections (stacked vertically):**
  1. **Rules List:** Create, edit, duplicate, delete, set active
  2. **Coverage Table:** Shows which rule applies to each page type/category
  3. **Preview/Test Tool:** Test rule selection before generating

### Layout.tsx
- **Purpose:** App shell with header, nav, user dropdown, theme toggle
- **Navigation:** Dashboard, Pages, Graph, Audit Log, Rules (admin), Settings (admin)
- **Header:** Prominent NeameGraph logo, role badge, dark mode toggle

### DomainBadge.tsx
- **Purpose:** Reusable badge for displaying page domain
- **Styling:** Corporate (blue), Beer (amber), Pub (purple) with dark mode support

---

## Status Workflow

```
not_started (gray)
    ↓
ai_draft (yellow, "Brain Draft")  ← Generated by NeameGraph Brain
    ↓
needs_review (orange)  ← Editor/Admin reviews
    ↓ ↑
approved (green)  ← Admin approves    |  needs_rework (red) ← Rejected, needs fixes
    ↓
implemented (teal)  ← Admin marks as live
```

**Access Control:**
- **Viewer:** Read-only
- **Editor:** Can generate schema, set status to draft/needs_review/needs_rework
- **Admin:** All Editor permissions + approve, mark implemented, manage rules/users/settings

---

## Authentication & Users

**Table:** `users`

- Roles: `'admin'`, `'editor'`, `'viewer'`
- Auth method: Email/password via Supabase Auth
- Sign up: **Invitation-only** (no self-service registration)
- RLS policies enforce role-based access

---

## Design System

**Files:** `src/index.css`, `tailwind.config.ts`

- **Tokens:** All colors defined as HSL semantic tokens (no hardcoded colors)
- **Status colors:**
  - `--status-draft`: Yellow (Brain Draft)
  - `--status-review`: Orange (Needs Review)
  - `--status-approved`: Green (Approved)
  - `--status-implemented`: Teal (Implemented)
  - `--status-error`: Red (Needs Rework)
- **Theme:** Light/dark mode via `next-themes`
- **Styling:** Rounded corners (`rounded-2xl`, `rounded-full`), shadcn/ui components

---

## Database Schema Overview

### Main Tables
- `pages` – Corporate pages with domain, metadata, tracking fields
- `rules` – Schema generation prompts matched by page_type/category
- `schema_versions` – Versioned JSON-LD per page with approval workflow
- `users` – App users with roles
- `settings` – Global settings (fetch/canonical URLs, sitemap)
- `audit_log` – All user actions (create, update, approve, delete)
- `graph_nodes`, `graph_edges` – Knowledge graph visualization (not covered in this doc)

### Foreign Keys
- `pages.created_by_user_id → users.id`
- `pages.last_modified_by_user_id → users.id`
- `schema_versions.page_id → pages.id`
- `schema_versions.rules_id → rules.id`
- `schema_versions.created_by_user_id → users.id`
- `schema_versions.approved_by_user_id → users.id`

---

## Edge Functions

Located in `supabase/functions/`

1. **fetch-html** – Fetches HTML from preview site, stores hash
2. **generate-schema** – Rules-based LLM schema generation
3. **generate-schema-story** – Generates human-readable narrative from JSON-LD (used in "Story" tab)

---

## Future Considerations

- **Pub Lane:** Phase 2 – individual venue schema generation
- **Beer Fields:** May move to dedicated `beers` entity table
- **Graph Visualization:** Already has tables, UI implementation TBD
- **Sitemap Sync:** Admin tool to auto-discover pages from sitemap XML

---

## Getting Started (New Developers)

1. **Key files to read first:**
   - This document (`docs/architecture.md`)
   - `src/pages/Pages.tsx` – Main pages list
   - `src/pages/Rules.tsx` – Rules management
   - `src/pages/PageDetail.tsx` – Schema generation workflow

2. **Understanding the flow:**
   ```
   Add page → Set domain & page_type → Fetch HTML → 
   Generate Schema (Brain uses matching rule) → 
   Review schema → Approve → Mark implemented
   ```

3. **Local development:**
   - Supabase Cloud (Lovable Cloud) handles backend
   - Edge functions deploy automatically
   - See `.env` for environment variables (auto-generated)

4. **Making changes:**
   - UI changes: Modify React components
   - Rules changes: Edit via Rules screen (admin only)
   - Database schema: Use Supabase migrations (never edit types.ts directly)
   - Edge functions: Edit in `supabase/functions/`, auto-deploy on save
