# The helper makes pieces from a job (design note, 2026-10-29)

Branch `piece-helper-bigger-change`. Overturns D89 (the browser fills the piece and one press in the
open sheet saves it) and D91 (the browser hands the helper a finished sheet; without the helper, the
print dialog still records the piece as made).

## What the helper does
- Keeps a short queue of piece requests (new table `piece_requests`, migration 0017). Every 15 seconds,
  and at once when the workspace on the same desktop pokes it, it takes the oldest waiting request.
- For each one it reads the job, the piece's saved wording, crops and layout, and the job folder on
  G:\ itself (Photos, Floorplan and Marketing only; paperwork is never opened).
- It opens the piece's own page in its hidden browser, lays the piece the same way the page does
  when Matt opens it from the job, then prints it with the existing drawing code, so the PDF is the
  same as before.
- It writes the PDF into the job's folder under the existing rules (never overwriting, its own older
  file to Archive), records it on the piece as made by the helper, logs "Showsheet made · Helper,
  asked by <name>", and marks the request done, or failed with a plain reason.
- Pieces: Showsheet, Brochure, both Postcards, Seller Package, Signage. The map stays in Map Studio.

## What the workspace does
- Job page: each piece row has one button. Stale: **Rebuild**. Not made: **Make**. One click adds a
  request; the row then says Waiting for the helper, Making it, Made, or Couldn't make it: <reason>.
  "Rebuild n stale" in the header queues every stale piece. Anyone who may change facts (owner, admin,
  marketing, the team account) may ask, from any device. **Open** still opens the piece to edit it.
- The piece page: Save sheet as before (owner). **Make PDF** saves, then asks the helper; it is
  greyed out, with the reason, when the helper would certainly refuse (no Drive folder linked). On
  Matt's desktop the page reads photos through the helper, so Drive never needs connecting in the
  browser; Connect Drive is offered only when there is no helper. Print is a plain print and never
  marks a piece made.
- A change to the job that the piece doesn't print no longer blocks a save: the helper lays the job
  as it is when it builds.

## When the helper is offline
Requests wait. The row says "Waiting for the helper on Matt's desktop (asked 3:12 pm)". When the
helper starts it works through them, oldest first, each from the job as it is then. Asking twice
for the same piece joins the one already waiting.

## How a rebuild is triggered
Only by a person: Rebuild, Make, Rebuild n stale, or Make PDF. Nothing rebuilds by itself when a
fact changes; stale stays a flag until someone asks.
