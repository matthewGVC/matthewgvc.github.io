# Made-up Asana fixtures

Raw Asana API responses (`{ data: [...], next_page: null }`) with invented addresses, people
("Agent A", "Agent B") and prices, so the repo's tests never hold real job data (plan D2).
Real recordings go in `helper/fixtures/recorded/<date>/` (gitignored), and only ever hold what
`helper/asana/allow.js` kept.

Files:
- `tasks-<projectGid>.json`: the tasks of one project, same gids as the helper's config.
  - `1209188026968555` (NYC): one task per Listing Status (Lead, In Prep to List, Active, Accepted Offer,
    In Contract, Post-Closing, Complete, Graveyard, TOTM), a rental, a Buy-Side row, and one address twice
    (a short-name Active task and a long-name Graveyard task from 2025).
  - `1209188026968552` (NJ): town-style names, MoreMLS, a land row and a house row at one address
    (both in TJ New Dev), and a row with no Listing Status.
  - `1210736852899934` (a development): 12 tasks ticked within one hour of one day (a batch day), one
    task ticked before its own due date, one still open.
  - `1211384244337827`, `1211306429530596`, `1209322192180451`: one loose task each (one done, two open).
- `people-1209434796793215.json`: five People tasks, one in "Past Team Members".
- `stories-sample.json`: the activity on one task, including a comment and a price-field change
  that must be dropped.
- `me.json`: the `/users/me` answer.

Planted on purpose, so tests can prove they are dropped: client name, GCI, contract price, source of
business, `notes` and `html_notes` on every task; comment text; People phone, birthday, GVC email and
the free-text Agent Title.

Shape notes: custom fields come as `{ name, display_value, number_value, date_value: { date },
enum_value: { name }, multi_enum_values: [{ name }] }`; a field a task has but left empty has all of
them null.
