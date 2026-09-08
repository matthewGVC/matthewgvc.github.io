# Product

## Register

brand

## Users

Matt Bloomfield — graphic/design assistant for The GVC Team (Gasdaska Verdiglione Conlon) at Douglas Elliman. The site — GVC Workspace — is both a showcase of his work and a hub for the production tools he built for the team. Two audiences: (1) people evaluating his work — real-estate colleagues, collaborators, prospective employers — browsing on any device; (2) GVC team members who actually use the tools (showsheet generator, feet-and-inches calculator, 3D map studio, floorplan converter) during listing and marketing prep, mostly on desktop.

## Product Purpose

A single, fast, build-less static site that does two jobs at once: showcases Matt's real-estate web and design work (property websites as case studies, before/after photo-editing galleries) and hosts the working tools he built for GVC listing/marketing production. Success means it reads as a polished, credible body of work *and* the tools are genuinely usable day to day.

## Brand Personality

"GVC Editorial": restrained, editorial, confident. Navy ink on paper with a single sky/cyan accent; Fraunces for display, Raleway for body, Nunito Sans for labels, JetBrains Mono for meta. The feel is a well-set print spread, calm and precise, not a flashy SaaS landing. Voice is plain and functional.

## Anti-references

- No AI-style slop copy: no fake-deep taglines ("Work, made useful."), no decorative meta-text or eyebrows on every section, no invented mottos. Headings name the actual thing; labels carry real data only. (Matt's explicit direction.)
- Not a generic SaaS/startup look: no gradient text, no hero-metric template, no identical card grids, no glassmorphism by default.
- The tools must not read as a separate product from the showcase. One consistent system across everything — the reason this revision exists is that Map Studio shipped as a dark dashboard while the rest of the site is light editorial.

## Design Principles

- One system, everywhere. The same GVC Editorial chrome, tokens, and type carry across the homepage, case studies, galleries, and the tools. No surface is an island.
- Real over atmospheric. Every heading and label states the actual thing; copy is functional, never decorative filler.
- Restraint with one accent. Navy on paper; sky is for hairlines, hover, and active states only — never body text on paper.
- Build-less and fast. Static HTML/CSS/JS, shared chrome injected by JS, GSAP via CDN. Performance and verbatim serving matter.
- Frozen outputs stay frozen. Print/pixel-verified generated artifacts (e.g. the showsheet's `.sheet`) are never restyled.

## Accessibility & Inclusion

- WCAG AA contrast: body ≥4.5:1, large text ≥3:1. Encoded in `tokens.css` (`--ink-soft` passes AA on paper; `--sky` is decorative only, never text on paper; placeholders meet 4.5:1).
- Full `prefers-reduced-motion` support (`base.css` disables animation; `motion.js` no-ops).
- Keyboard access: `:focus-visible` sky outlines on all interactive elements; ≥40px tap targets on mobile.
- Semantic HTML and ARIA: `aria-current` nav, roles/labels on controls, a visually-hidden page `h1`.
