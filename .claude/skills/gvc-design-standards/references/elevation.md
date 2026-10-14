# Elevation: from working to finished

Work in order. Do not start elevating before the output is correct, complete and verified.

## Phase A: functional

- Real content in every slot, or a stamp where content is missing.
- Correct tokens for the surface; no new hex.
- Correct paper size(s) and markets. Printed PDF checks pass (see `print-and-verify.md`).
- Tool wiring and test lists done (`building-gvc-tools`).

## Phase B: one elevation pass

Run the checklist below against the functional version. Make only the changes that answer a "no" or "weak". Then stop.

### Design checklist

**Hierarchy**
- [ ] One clear primary element per page or screen. Could a reader say what it is in three seconds?
- [ ] Headings name the thing. Labels are small, tracked caps (Nunito Sans 800), not body text.
- [ ] Scale contrast is deliberate: one large type moment, not many medium ones.

**Colour**
- [ ] Navy ink on Paper, one accent. Sky is not text on Paper; Cyan is decorative on Paper.
- [ ] In a set, all five GVC colours appear with a real role, and there is a Paper-ground piece.
- [ ] Contrast meets AA (4.5:1 body, 3:1 large).

**Type**
- [ ] Printed headings use the print serif; site headings use the site display face. No third face.
- [ ] Line length and leading readable at print size. No text smaller than the print minimum the surface sets.
- [ ] Figures and numbers aligned consistently (tabular where columns line up).

**Space and grid**
- [ ] Margins generous and even on each edge. Nothing closer than the safe area (8% for screens).
- [ ] Alignment to one grid. Items that line up actually line up.
- [ ] Empty space is deliberate: no orphaned rule, no half-empty page, no single line stranded at a page break.

**Imagery**
- [ ] Every image is real, verified, high-resolution, and captioned or credited where the packages credit photos.
- [ ] Image crops keep faces and key subject in frame at both paper sizes.

**Detail**
- [ ] Hairlines, rules and borders use `--rule` or the print rule token; they are consistent in weight.
- [ ] Hover, focus and active states exist and use Sky outlines (`:focus-visible`).
- [ ] Motion is slow and respects `prefers-reduced-motion`.

**Restraint**
- [ ] No gradient text, glass panels, hero metrics, identical card grids or icon filler.
- [ ] At most one bold move per screen. Nothing animated that does not need to be.

## Elevation moves that fit the brand

Choose from these by the failure you found, not all at once.

| Move | Use when | Example |
|---|---|---|
| Scale contrast | Everything reads the same size | One large serif headline over small caps labels |
| Hairline rule | Sections blur together | A Sky or `--rule` hairline between sections |
| Paper-ground inversion | A set is all dark | One piece on Paper with Navy ink |
| Cyan band or fill | Cyan has no presence | A Cyan block as a single accent, not a gradient |
| Generous margin | Page feels crowded | Increase the outer margin before reducing type |
| Single big shape | A loop or cover feels busy | One large monogram or tile moving at a time |
| Tracked caps label | Captions lack structure | Nunito Sans 800 caps, letter-spaced, small |
| Texture on a simple field | A flat field feels dead | Fine grain, blur or a soft overlay (not a gradient) |

## Moves that do not fit (rejected direction)

- Gradient text, glassmorphism by default, neon or glow.
- Decorative taglines, mottos, eyebrows on every section.
- Stock "hero" imagery of unrelated places or people.
- Cards with identical padding, radius and shadow in a grid of six.
- Extra colours outside the five-colour palette.
- Animation for its own sake, or continuous motion behind text.

## Stop rules

- Stop when the next change is taste rather than a defect. Say so in one line.
- If elevation needs new content, a new asset or a new colour, stop and ask. Those are not design decisions.
- Two elevation passes at most before handing back. More rounds usually mean the functional version has a structural problem; fix that instead.
