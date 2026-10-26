# Workspace v2 mockups: notes

Served at http://localhost:8093/tmp/mockups/ (or :8080). Start at `index.html`.

## Round 1 (2026-10-19): shown to Matt

| Screen | File |
|---|---|
| Overview A: the ledger (status band, work letters, heat strip, to-do mixes flags + Matt's list) | `overview-a.html` |
| Overview B: the line (one line per job, grouped by what needs you, Next column, folding to-do) | `overview-b.html` |
| Job page: 1050 Park 13C | `job.html` |
| Shell: top bar + Jobs list + Team/Reference | `shell.js`, `jobs.html`, `team.html` |

Data: folder dates from the traces + DE's team page read 2026-10-19 (prices, beds/baths, status).
Dates not in the traces are drawn dashed/faded. Agents are blank except 176 E71 (Elyse Gutman);
the details doc wasn't read, so money facts show "From details doc".

## Matt's notes

- 2026-10-19: Matt didn't like either overview direction (A ledger, B line) or the job page as drawn.
- He'll make the UI in Google Stitch instead. Asked for a plain-facts brief with no design language: tools, page connections, job fields, stats. Written to `STITCH-BRIEF.md`.

## Direction picked

None of the mockups. The UI will come from Google Stitch, using `STITCH-BRIEF.md`.

2026-10-19: Stitch is generating mockup screens for several pages from the brief. Next: Matt brings those screens back to build from.

## Stitch round 1 (2026-10-19): review

Files: `stitch/stitch_minimalist_clean_ui_design/` (overview, jobs directory, job detail, team; Tailwind CDN + Inter, AI stock images).

What Stitch took from the brief: the nav (Overview, Jobs, Team, Reference, Tasks), Drive status + sync, Open folder / Copy link on a job, a stage stepper, a list of pieces with actions, an event history, a folder-health box, a calculator on Team.

What it ignored or invented:
- No real jobs, agents or markets: "Project Alpha", "Region A/B/C", "Lead A", fake people (Jordan Davis…).
- Invented metrics: total valuation, milestone rate, desk utilization, pipeline velocity, latency, "+8.4% this quarter".
- Generic 6 stages (Intake → Delivery) instead of Pitch → … → Archived; no development milestones.
- No dated timeline on the overview (progress % bars instead); no folder activity, gaps, DE markers.
- Kit has no made / stale / not made and no "built from"; no floorplan versions × layouts × renders; no photo sets / hero; no facts list; no agents on the job; no change log with "who asked"; no to-do flags.
- AI stock interiors and a map image; Team page invents facilities, design tokens, "Reserve Workshop Slot".
- Its own look (white, slate, cobalt blue, emerald/amber, Inter), not GVC's.

## Round 3 (2026-10-19): Stitch layouts, GVC brand

Matt: "Stitch's UI, GVC brand colors and text." Built in `v2/` (index = Overview, jobs, job, team), at
http://localhost:8093/tmp/mockups/v2/. Repo tokens + fonts.css, no Tailwind, no Google Fonts, no stock images;
real jobs (data.js), real roster + headshots. Every job link opens the 1050 Park 13C page (with a note).
Screenshots in `v2/shots/`.

**LOCKED (Matt, 2026-10-19): the v2 screens are the design direction.** Open item for the build: job pages render per job (mockup shows 1050 Park 13C for every job).
