# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain static HTML, CSS and JavaScript. No build step, no installation. Shared chrome is injected by JS, GSAP comes from a CDN, fonts are self-hosted static files (so printed PDFs embed them). Published straight from `main` on GitHub Pages at matthewgvc.github.io.

## Users

Matt Bloomfield, graphic/design assistant for The GVC Team (Gasdaska Verdiglione Conlon) at Douglas Elliman. The site, GVC Workspace, serves two audiences:

1. **GVC team members** who run the production tools during listing and marketing prep, mostly on desktop. They build a document, then print or save it as a PDF.
2. **People evaluating Matt's work**: real-estate colleagues, collaborators and prospective employers, browsing on any device.

The printed packages (buyer package, seller pitch and CMA, brochure, showsheet, destination guide, NJ footprint, New Development) are made by GVC agents and handed to clients: buyers, sellers and prospects. Clients never touch the tools; they read the print. Matt (the owner) publishes straight to `main`; other teammates send a pull request for him to review.

## Product Purpose

A single, fast, build-less static site that does two jobs at once: it showcases Matt's real-estate web and design work (property websites as case studies, before/after photo-editing galleries) and hosts the working tools he built for GVC listing and marketing production. Success means it reads as a polished, credible body of work and the tools are genuinely usable day to day, producing client-ready printed pages.

## Positioning

Built in-house for GVC's own listings. Every builder is made for this team's exact collateral: market-specific New Jersey, New York City and Florida copy, the real agents and their real photography, and output that prints straight to PDF. A generic template site could not truthfully claim any of that.

## Operating Context

- Tools live under `tools/`: showsheet generator, brochure, buyer package, seller pitch and CMA, destination guide, NJ footprint, New Development, agent info, calculator, floorplan converter, map studio, watermark, properties, CMA. Photo galleries live under `photos/`.
- Printed pages are fixed-size canvases (the packages are US Letter portrait), previewed on screen and printed or saved as PDF through the browser. Print output is checked in Chromium and WebKit, including a rasterized printed PDF.
- Markets are kept independent: New Jersey, New York City and Florida each have their own copy and page set, and a change for one must not alter another.
- Copy for agents, bios, testimonials, referral partners and listings comes from real GVC sources; the shared drives hold headshots, stock and film originals.
- Workflow: work on a branch, verify with `scripts/verify-local.js`, `interact-local.js` and `dnd-local.js`, then merge to `main`. Never force-push. The live site updates within about a minute of a merge.

## Capabilities and Constraints

- Static hosting, a local preview server for development (`file://` breaks the Word-document reader and image handling), Supabase for the New Development library only.
- Placeholder stamps are deliberate and stay visible until real content arrives ("Work in progress" on NJ agent pages, "List needed" and "Partner to be added" on Marli's referral page, red "Check" tags on NJ 50 Things items).
- Standing decisions: the NJ seller deck uses NJ stock photos only, never specific home shots; the NYC buyer packet keeps Don't Forget to Ask and the FAQs; the seller Professional Videos page keeps its justified-text spacing.
- Frozen outputs stay frozen: print- and pixel-verified generated artifacts (such as the showsheet's `.sheet`) are never restyled.
- Open product facts: Marli's referral partner list, the NJ 50 Things items still marked Check, and a team decision on including the tiered showing service in the marketing package.

## Brand Commitments

- **Name and personality:** "GVC Editorial": restrained, editorial, confident, a well-set print spread, calm and precise, not a flashy SaaS landing. Navy ink on paper with a single sky/cyan accent. Fraunces for display on the site (the printed packages set their display serif in Playfair Display), Raleway for body, Nunito Sans for labels, JetBrains Mono for meta.
- **Voice:** plain and functional. Headings name the actual thing; labels carry real data only.
- **Explicitly rejected (Matt's direction):** AI-style slop copy such as fake-deep taglines ("Work, made useful."), decorative meta-text or eyebrows on every section, and invented mottos. Also a generic SaaS/startup look: gradient text, hero-metric templates, identical card grids, glassmorphism by default.
- **One system everywhere:** the tools must not read as a separate product from the showcase. The same chrome, tokens and type carry across homepage, case studies, galleries and tools.
- **Team assets:** the GVC Team lockup, Douglas Elliman affiliation and legal footer, and the team QR codes appear as fixed boilerplate that no builder lets users edit.

## Evidence on Hand

- Real property sites and before/after photo galleries (`projects/`, `photos/`), real agent headshots and cut-outs, GVC film stills and Matt's own marketing mockups.
- Real testimonials exist for some agents; none exist yet for Katie, Nicole, Gary, Ayuen or TJ. Do not invent quotes, names, testimonials or referral partners.
- Stock photography is used only when verifiably of the stated place (Pexels or Unsplash, free licence), with the photo IDs recorded in a code comment.
- Sample files for testing the showsheet are in `tools/showsheet/sample/`.

## Product Principles

- **One system, everywhere.** The same editorial chrome, tokens and type carry across the site, the tools and every printed page. No surface is an island.
- **Real over atmospheric.** Every heading and label states the actual thing; copy is functional and factual, never decorative filler, and never invented.
- **Restraint with one accent.** Navy on paper; sky is for hairlines, hover and active states only, never body text on paper.
- **Build-less and fast.** Static files, shared chrome injected by JS, performance and verbatim serving matter.
- **Print is the product.** A tool is finished when its printed PDF is right, in every market it supports, with no half-empty or overflowing page.

## Accessibility & Inclusion

- WCAG AA contrast: body at least 4.5:1, large text at least 3:1. Encoded in `tokens.css` (`--ink-soft` passes AA on paper; `--sky` is decorative only, never text on paper; placeholders meet 4.5:1). The packages hold their running footers and labels to the same standard.
- Full `prefers-reduced-motion` support (`base.css` disables animation; `motion.js` no-ops).
- Keyboard access: `:focus-visible` sky outlines on all interactive elements; tap targets of at least 40px on mobile.
- Semantic HTML and ARIA: `aria-current` nav, roles and labels on controls, a visually-hidden page `h1`.
