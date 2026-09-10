# The property library's database

The four listing builders — Showsheet, Brochure, Buyer Package, Seller Pitch & CMA — share one
saved property each. This folder holds the schema for that shared store.

- **Project:** `hoszxrrlfhzbbrzenqvp` (Supabase, free tier, region `us-west-2`)
- **Client config:** `assets/js/supabase-config.js` — the project URL and the publishable key,
  both of which are meant to be public.
- **Migrations:** `migrations/*.sql`, applied in filename order.

## What is in it

| Table | Holds |
|---|---|
| `properties` | One row per address. `core` is the facts every builder shares: address, city/state/zip, price, beds, baths, sqft, description, features, agents, comps. |
| `documents` | One saved document per tool per property (`showsheet`, `brochure`, `seller`, `buyer`). `state` is stored verbatim and handed back untouched. |
| `photos` | The index of the photo shelf. The files themselves live in the private `property-photos` bucket; pages render them through short-lived signed URLs. |

A property may have no documents at all — core facts alone are a perfectly normal property, and
whichever tool an agent opens first is the one that creates it.

## Who can read it

Nobody, unless they are signed in. Row level security is on for all three tables and the storage
bucket, and every policy requires the `authenticated` role. This site is public, so an anonymous
visitor hitting the API gets an empty list.

The whole team shares one account, `team@gvcrealestateteam.com`. Agents type the password once and
the browser holds the session. **The password is not in this repo and must not be** — change it
from the Supabase dashboard under Authentication → Users.

The trade-off that came with that decision: anyone who has the password can read every property,
and nothing records who saved or archived what. If the library ever holds more than listing facts,
that is the first thing to revisit.

## Managing it

`tools/properties/` is the library's own page — every property including the archived ones,
renaming, status, the photo storage read-out, and "Free up photos". The three builders that
bind to a property — the Showsheet, the Brochure and the Seller Pitch — can only load and
save; anything else is there. The Buyer Package is the fourth builder but has no property at
all, so it never touches the library.

Two conventions that page relies on:

- **`core.displayLabel`** — a property's `label` is normally derived from its address, and
  `saveCore` rebuilds it on every save. A name typed on the Properties page is stored here as
  well, and `saveCore` prefers it, so a rename survives the next time a builder saves facts.
  The `slug` is never touched by a rename: the address is the identity and duplicate detection
  matches on it.
- **Freeing photos deletes files before rows.** A row whose file is already gone is harmless —
  `hydrate()` resolves its token to an empty string. A file with no row is not: it consumes
  quota with nothing pointing at it. Keep that order in anything new.

## Applying a migration

The direct database host (`db.<ref>.supabase.co`) is IPv6-only, so on an IPv4 network it will not
resolve at all. Use the pooler instead:

    host      aws-0-us-west-2.pooler.supabase.com
    port      5432                       (session mode — needed for DDL)
    user      postgres.hoszxrrlfhzbbrzenqvp
    database  postgres

TLS is served by Supabase's own root, which is not in the system trust store. Download it once —
`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt` — and pass
it as the CA rather than turning verification off.

Or, with the CLI:

    supabase login
    supabase link --project-ref hoszxrrlfhzbbrzenqvp
    supabase db push

## Free-tier limits worth knowing

- **1 GB** of file storage. Photos are downscaled to 2000 px on the long edge on the way in, so a
  ten-photo property is about 7 MB — roughly 140 properties before it needs paying for.
  `tools/properties/` shows how much of it is gone and turns red past 80%.
- **500 MB** of database, **5 GB** of transfer a month. Every property load pulls its photos.
- A free project **pauses after a week with no activity** and needs a click in the dashboard to
  wake up.
