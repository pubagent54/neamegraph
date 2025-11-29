# NeameGraph – Schema Quality Charter

## 1. Purpose

NeameGraph's job is to publish **world-class structured data** that:

* Makes it unambiguous **who** Shepherd Neame is
* Makes it clear **what** each page is about
* Connects **all pages, beers, pubs and entities** into a coherent graph
* Only states facts that are **visible or clearly implied** on the page

This Charter applies to **every schema run**, across **Corporate**, **Beers**, and **Pubs**.

## 2. Core Quality Principles

NeameGraph schema must always be:

### 2.1 Technically Clean

* Valid JSON-LD, no syntax errors
* Uses real, fully qualified URLs for `@id` and `url`
* Uses only valid Schema.org types and properties
* No internal contradictions (e.g. a `LocalBusiness` schema on a pure blog page)

### 2.2 Faithful to the Page

* All key facts in schema are visible on the page or obviously implied
* FAQ schema mirrors on-page FAQs **word-for-word**
* No wishful or invented data (awards, ratings, service areas, prices, etc.)

### 2.3 Complete Enough to Be Useful

* **Website / Corporate pages**: organization details, page purpose, and key relationships
* **Beers**: ABV, style, tasting notes, pack/format, brand, manufacturer
* **Pubs**: NAP, geo, opening hours, amenities, booking/menu links
* Includes `image` where possible for richer results

### 2.4 Connected into a Graph

* Everything links back to a **single canonical Organization** node
* Entities are joined with `@id` references instead of being duplicated
* External IDs and profiles are linked with `sameAs`
* Internal relationships are explicit (beer → brand → brewery → pub)

## 3. Authority & Trust

Schema does not magically create authority; it **clarifies and consolidates** it.

NeameGraph should always:

* Represent **Shepherd Neame** as a single, stable entity with:

  * Legal/trading name, address, contact details
  * Logo and primary website
  * `sameAs` to key profiles (e.g. Wikipedia/Wikidata, social, Companies House, etc.)
* Ensure all beers and pubs **explicitly reference** this Organization via:

  * `publisher`
  * `brand`
  * `manufacturer`
  * `parentOrganization`
* Only use:

  * `AggregateRating` when visible and genuinely supported
  * `Review` when real reviews are shown
  * `award` when explicit awards are stated

If in doubt, **leave it out** rather than over-claim.

## 4. ID & Graph Conventions

NeameGraph must use **stable, predictable `@id` patterns**:

* Organization:
  `https://www.shepherdneame.co.uk/#organization`
* Website:
  `https://www.shepherdneame.co.uk/#website`
* Corporate pages:
  `https://www.shepherdneame.co.uk{PATH}#webpage`
* Beers:
  `https://www.shepherdneame.co.uk/beers/{BEER-SLUG}#product`
* Pubs (example pattern):
  `https://www.shepherdneame.co.uk/pubs/{PUB-SLUG}#pub`

Rules:

* Never create two different `@id`s for the **same real-world thing**
* Prefer linking to an existing `@id` over creating a new duplicate node
* Use `isPartOf` to connect `WebPage` → `WebSite`
* Use `mainEntity` / `about` to connect `WebPage` → core entity (beer, pub, etc.)

## 5. Page-Type Expectations

### 5.1 Corporate pages

* Use `WebPage` or a suitable subtype (e.g. `AboutPage`, `ContactPage`, `FAQPage`, `CollectionPage`)
* Must:

  * Be `isPartOf` the main `WebSite`
  * Reference the Organization via `publisher` and/or `about`
  * Clearly identify the page's purpose via `name`, `description`, and `about`

If the page contains a Q&A block, generate an `FAQPage` / `FAQ` node that matches the on-page text exactly.

### 5.2 Beers

* Use `Product` with `brand` and `manufacturer`
* Should include where available:

  * `name`, `description`
  * `image`
  * `brand` → Shepherd Neame Organization / Brand node
  * `manufacturer` → Shepherd Neame Organization
  * `alcoholByVolume`, style, serving suggestions
  * Pack formats, GTINs (when known)
* Always link back to:

  * Organization `@id`
  * WebPage `@id` that describes the beer

### 5.3 Pubs / Venues

* Use appropriate localbusiness-type (`BarOrPub`, `Restaurant`, `Hotel`, etc.)
* Should include:

  * Name, address, geo
  * Phone, website, opening hours
  * Key amenities (garden, rooms, dog-friendly, parking, EV)
  * Links to menus and booking pages where available
* Always link back to:

  * Shepherd Neame Organization (e.g. `parentOrganization`, `brand`)
  * WebPage `@id` for the pub page

## 6. Non-Negotiable Checks per Run

For every schema run NeameGraph should conceptually ask:

1. Is the JSON-LD valid and using real URLs?
2. Does every fact appear on (or is clearly implied by) the page?
3. Is there a clear connection to the **canonical Organization** and **WebSite** nodes?
4. Are we using the correct Schema.org types and properties for this page type?
5. Have we avoided duplication by using existing `@id`s wherever possible?

## If any answer is "no" → treat as a schema quality issue to fix.
