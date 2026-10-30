# Palette and type

Source of truth: `assets/css/tokens.css` (site) and the `:root` block at the top of `assets/css/builder.css` (printed pages). If this file and those disagree, the CSS wins; update this file.

## Brand colours

| Name | Hex | Token (site) | Token (print, builder.css) | Use |
|---|---|---|---|---|
| GVC Navy | `#00273A` | `--ink` | `--navy` | All text on paper; primary ink; buttons |
| Sky | `#53C7DC` | `--sky` | `--sky` | Hairlines, hovers, active states, focus outlines. Never text on Paper (1.7:1) |
| Cyan | `#00A1C4` | `--cyan` | `--sky2` | Accents and meta text on Navy (5:1). On Paper, decorative only |
| Bone | `#E5E5E5` | `--bone` | `--ow` | Text and elements on Navy |
| Paper | `#EFEDE8` | `--paper` | `--page` | Page background |

Supporting neutrals (site tokens):

| Token | Hex | Use |
|---|---|---|
| `--paper-2` | `#E7E4DC` | Secondary surface on Paper |
| `--rule` | `#D3D4D0` | Hairline borders |
| `--ink-soft` | `#33525F` | Secondary text on Paper (7.1:1, passes AA) |
| `--danger` | `#8C3A2B` | Destructive actions, remove, error |

Print UI helpers (`builder.css`): `--ui-paper-2`, `--ui-rule`, `--ui-ink-soft`. Use these in the editor panel of a builder, not on the printed page.

## Which combinations are allowed

| Text colour | On Navy | On Paper | On white |
|---|---|---|---|
| Bone `#E5E5E5` | Yes | No (contrast too low) | No |
| Cyan `#00A1C4` | Yes (5:1) | Decorative only | No |
| Sky `#53C7DC` | Decorative / hairlines | **Never** | No |
| Navy `#00273A` | No | Yes | Yes |
| `--ink-soft` `#33525F` | No | Yes (7.1:1) | Yes |

Large text needs 3:1 minimum; body text needs 4.5:1. Verify any new pairing with a contrast calculator rather than by eye.

## Colour use across a set

- Give Cyan real presence in every set: a fill, a band, an accent rule. Cyan that appears only in a footnote does not count.
- Include at least one Paper-ground piece with Navy ink in any set of more than two pieces.
- Sky and Bone on Navy are the default pairing for dark pieces. Do not make every piece Bone and Sky on Navy.

## Type

| Role | Site face | Print face | Notes |
|---|---|---|---|
| Display / headings | Fraunces (`--serif` on site) | Playfair Display (`--serif` in builders) | Site uses Fraunces (static faces); printed packages use Playfair |
| Labels, captions, buttons | Nunito Sans 800, caps, tracked (`--sans-display`) | Nunito Sans (`--sans` in builders) | Typically 9–11px in UI, larger on print |
| Body | Raleway (`--sans-body`) | Raleway (`--body` in builders) | |
| Meta, hints, code-like values | JetBrains Mono (`--mono`, `--ui-mono`) | Same | Labels only, never running text |

Fonts load only from `assets/css/fonts.css`. That file uses static font faces, so Chrome embeds them when printing. Do not add a `fonts.googleapis.com` link to a tool page. Do not add a font family that is not in `fonts.css` without updating it.

Headline sizing: pick sizes in `in` or `pt` on printed pages so they hold at both paper sizes. The showsheet's design canvas is 11in wide; A5 scales it down and Letter prints it at full size.

## Spacing and motion tokens

- Site: `--pad-x: 40px` (16px at 640px and below), `--mast-h: 64px`.
- Motion: `--ease: cubic-bezier(0.2, 0.8, 0.2, 1)`; durations `--dur-1` 180ms (hover), `--dur-2` 360ms (reveal), `--dur-3` 700ms (entrance). Keep to these; `base.css` disables animation under `prefers-reduced-motion`.

## Things that look like brand but are not

- Douglas Elliman marks: use the badge file (`assets/logos/sheet/badge-de.svg`) exactly as supplied. Do not recolour it or rebuild it.
- Hex values in older tools' `<style>` blocks are legacy. `check-tools.js` warns about them; do not add more.
