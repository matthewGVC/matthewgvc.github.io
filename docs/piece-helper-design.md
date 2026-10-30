# The helper makes pieces from a job (design note, 2026-10-29)

Overturns D89 (the open sheet is filled in the browser and one press there saves it) and D91 (the
helper writes the showsheet PDF into the linked folder; without the helper the print dialog still marks it made).

## What the helper does
- Works through a queue of piece requests (table `piece_requests`, migration 0017), oldest first:
  every 15 seconds, and at once when the workspace on the same desktop pokes it.
- For each request it reads the job, the piece's saved wording, crops and layout, and the job folder
  on G:\ itself (Photos, Floorplan, Marketing; paperwork is never opened).
- It opens the piece's own page in its hidden browser, which lays the piece exactly as it does when
  opened from the job, then prints it with the existing drawing code, so the PDF is unchanged.
- It saves the PDF into the job folder under the existing rules (never overwriting; its own older
  file to Archive), records the piece as made, logs "<piece> made · Helper, asked by <name>", and
  marks the request done, or failed with a plain reason.
- Pieces: Showsheet, Brochure, both Postcards, Seller Package, Signage. The map stays in Map Studio.

## What the workspace does
- Job page: one click per piece. Stale shows **Rebuild**, not made shows **Make**; "Rebuild n stale"
  queues them all. The button only shows when the job has a Drive folder linked; the remaining editor link is for the map only (Map Studio). The row then says waiting, making, made, or why it couldn't. Owner, admin,
  marketing and the team account may ask, from any device. **Open** still edits the piece.
- Piece page: Save sheet as before. **Make PDF** saves, then asks the helper; it is greyed out with
  the reason when the helper would certainly refuse (no Drive folder linked). On Matt's desktop the
  page reads photos through the browser's Drive when it is connected, otherwise through the helper. Print is a plain
  print and never marks a piece made.
- A job change the piece doesn't print no longer blocks saving.

## When the helper is offline
Requests wait ("Waiting for the helper on Matt's desktop, asked 3:12 pm"). When it starts, the
helper works through them, each from the job as it is then. Asking again joins the waiting request.

## How a rebuild is triggered
Only by a person: Make, Rebuild, Rebuild n stale, or Make PDF. A changed fact makes a piece stale;
it never rebuilds by itself.
