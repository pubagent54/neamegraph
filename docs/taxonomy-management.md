# Page Types & Categories Management

## Overview

NeameGraph v2 uses a database-driven taxonomy system for managing page types and categories. This provides a single canonical source of truth that can be edited through the admin UI without code changes.

## Architecture

### Database Tables

**`page_type_definitions`**
- `id` (TEXT, primary key): Immutable stable identifier (e.g., 'about', 'beers')
- `label` (TEXT): Human-readable display name (e.g., 'About', 'Beers')
- `description` (TEXT, nullable): Optional description
- `domain` (TEXT): Domain this type belongs to ('Corporate', 'Beer', 'Pub')
- `sort_order` (INTEGER): Display ordering
- `active` (BOOLEAN): Whether this type is active/available

**`page_category_definitions`**
- `id` (TEXT, primary key): Immutable stable identifier (e.g., 'about_general')
- `page_type_id` (TEXT, FK): References parent page type
- `label` (TEXT): Human-readable display name (e.g., 'General')
- `description` (TEXT, nullable): Optional description
- `sort_order` (INTEGER): Display ordering within page type
- `active` (BOOLEAN): Whether this category is active/available

### Code Structure

**Core modules:**
- `src/lib/taxonomy.ts`: Core async functions for loading taxonomy from database
- `src/hooks/use-taxonomy.ts`: React hooks for easy component integration
- `src/lib/domain-config.ts`: Legacy compatibility layer (deprecated)

**UI Components:**
- `src/pages/SettingsTaxonomy.tsx`: Main taxonomy management screen
- `src/components/taxonomy/TaxonomyAccordion.tsx`: Expandable page type display
- `src/components/taxonomy/CategoryRow.tsx`: Inline-editable category row

## Usage

### For Developers

**Loading taxonomy data:**

```typescript
import { usePageTypes, useCategoriesForPageType } from '@/hooks/use-taxonomy';

function MyComponent() {
  const { pageTypes, loading } = usePageTypes();
  const { categories } = useCategoriesForPageType('about');
  
  // Use pageTypes and categories
}
```

**Direct async access:**

```typescript
import { getPageTypesForDomain, getCategoriesForPageType } from '@/lib/taxonomy';

async function loadData() {
  const types = await getPageTypesForDomain('Corporate');
  const categories = await getCategoriesForPageType('about');
}
```

### For Admins

**Accessing the taxonomy manager:**
1. Navigate to Settings (admin only)
2. Click "Page Types & Categories" 
3. Or go directly to `/settings/taxonomy`

**Editing taxonomy:**
- Search and filter by domain, text, or active status
- Click a page type to expand and view its categories
- Edit labels, descriptions, sort order, and active status inline
- Add new categories using the "+ Add Category" button
- Delete categories using the trash icon (with confirmation)

**Applying changes:**
- After making edits, a banner appears: "You've updated Page Types & Categories"
- Click "Apply changes to pages" to synchronize taxonomy changes across the system
- This ensures any cached or derived data is refreshed

## Key Principles

1. **IDs are immutable** - Never change the `id` field; it's used throughout the system for referential integrity
2. **Labels are editable** - Change display text freely without breaking logic
3. **Active flag for deprecation** - Set `active = false` to deprecate without breaking existing pages
4. **Sort order controls display** - Lower numbers appear first
5. **Domain hierarchy** - Page types belong to domains; categories belong to page types

## Migration from Hardcoded Config

The system maintains backward compatibility with the old `DOMAIN_CONFIG` hardcoded object in `src/lib/domain-config.ts`. This file is marked as deprecated but continues to work for legacy code.

**Migration path:**
1. Existing hardcoded data was seeded into the database during initial migration
2. New code should use `src/lib/taxonomy.ts` functions
3. Old code using `DOMAIN_CONFIG` continues to work via the compatibility layer
4. Gradually refactor components to use async taxonomy functions

## Security

- All authenticated users can **read** taxonomy data
- Only **admins** can modify taxonomy definitions
- RLS policies enforce these permissions at the database level

## Future Enhancements

- Merge/redirect workflow for retiring IDs
- Bulk taxonomy operations
- Import/export taxonomy as JSON
- Taxonomy versioning and audit trail
- Automated synchronization with page metadata
