# The workspace's database

Everything the workspace knows about its jobs lives here: listings, pitches, developments, their pieces,
the change log, the Asana and DE caches, and the queue of pieces the desktop helper makes. Files stay on
Google Drive; the database keeps paths relative to `G:\Shared drives\`, never copies. It started as the
property library (0001) behind the Showsheet, Brochure and Seller Package, whose property bar still
uses it standalone. The Buyer Package does not use it.

- **Project:** `hoszxrrlfhzbbrzenqvp` (Supabase, free tier, region `us-west-2`)
- **Client config:** `assets/js/supabase-config.js` — the project URL and the publishable key,
  both of which are meant to be public.
- **Migrations:** `migrations/*.sql`, applied in filename order. Each opens with a comment saying what
  it adds; `node scripts/test-migrations.js` checks them. Back up the tables to
  `exports/supabase-backup-<date>/` before running one.

## What is in it

| Table | Holds | Since |
|---|---|---|
| `properties` | Listings: one row per address + unit. `core` (the facts the builders share, incl. `agentIds`), each fact's sources, stage, Drive folder, the Asana and DE snapshots, milestones, the Match result, the details doc last read. | 0001, grown by 0004–0007 |
| `documents` | One saved piece per tool per listing or pitch (`tool` is any lower-case slug, 0009): its wording and settings (`state`), what it printed from the job (`built_from`) and the files it made (`output`, `outputs`). | 0001, 0009, 0010 |
| `photos` | The property bar's photo shelf. The files live in the private `property-photos` bucket; pages render them through short-lived signed URLs. | 0001 |
| `developments` | The archived New Development tool's documents (`data`, stored verbatim). | 0002 |
| `todos` | Matt's to-do list behind `tools/todo/`, owner only (0008). | 0003 |
| `members` | Who may sign in, and their role: `owner`, `admin`, `marketing`, `team`, `helper`, `shared`. | 0004, 0011 |
| `pitches` | Seller pitches, linked to their Asana task; the outcome follows Asana (D55). | 0005 |
| `dev_projects` | Developments: milestones, the 🚧 Asana link and hints, the schedule (0015), `archived_at` (0018). | 0005 |
| `changes` | The change log: one row per change, with its source and who made it. | 0005 |
| `floorplans` | Floorplan versions × layouts per listing. | 0005 |
| `sync_runs` | Every run of the desktop helper (DE, Asana, People, budget, scan, backup). | 0005 |
| `de_listings` | What the DE sync knows about each DE listing, incl. the GVC-listed check. | 0005 |
| `asana_tasks` | The helper's read-only cache of Asana tasks (allowlisted fields only, D49). | 0006 |
| `asana_people` | The allowlisted 👋 People fields (D71): roster drift and M16. | 0006 |
| `match_claims` | Who claimed or fixed each error on the Errors page. | 0011 |
| `dev_budgets` | A development's pro-forma sheet link and what the helper keeps of it (D112). | 0015 |
| `piece_requests` | The queue of pieces to make from a job. Make or Rebuild adds a row; the desktop helper claims the oldest waiting row and marks it done or failed. | 0017 |

Saves go through database functions that check the row's `version` and write the change log in the
same step: `save_job` (0007), `save_piece_of` (0010), `save_piece_build` (0017).

## Who can read it

Nobody, unless they are signed in. Row level security is on for every table and the storage bucket, and
nothing is readable by an anonymous visitor: the site is public, so an anonymous request gets an empty
list.

Sign-in is per person (D3): each person has their own Supabase account, public sign-up is off, and only
an active row in `members` can read or write. Every write is stamped with who made it. The team's shared
account, `team@gvcrealestateteam.com`, is a member with role `shared` so the standalone tools keep working;
**its password is not in this repo and must not be.** Some writes are narrower than "any member":

- Only owner, admin, marketing and the helper link or change a job's Drive folder (0012, 0013).
- A plain `team` sign-in can't make a job or pitch, or change its facts by writing the table directly (0014).
- Development budgets: owner, admin and the helper write them; the shared account may read them (0015, 0016).
- Owner, admin, marketing and the shared account may ask for a piece (0017).
- To-dos: Matt reads and writes, the helper reads for the backup (0008).

## Managing it

Every listing is a job in the workspace (`workspace/`); the old Properties page is retired and
redirects there. The builders' property bar can only load and save. To see how much photo storage
is used, look in the Supabase dashboard (Storage).

Two conventions the library keeps:

- **`core.displayLabel`** — a property's `label` is normally derived from its address, and
  `saveCore` rebuilds it on every save. A name stored here is preferred, so a rename survives the
  next time a builder saves facts. The `slug` is never touched by a rename: the address is the
  identity and duplicate detection matches on it.
- **Photos are deleted files first, rows second.** A row whose file is already gone is harmless —
  `hydrate()` resolves its token to an empty string. A file with no row is not: it consumes quota
  with nothing pointing at it. Keep that order in anything new.

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
  The Supabase dashboard (Storage) shows how much of it is gone.
- **500 MB** of database, **5 GB** of transfer a month. Every property load pulls its photos.
- A free project **pauses after a week with no activity** and needs a click in the dashboard to
  wake up.
