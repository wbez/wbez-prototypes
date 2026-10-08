# AGENTS.md

This is a Rails 8 application template for WBEZ-style prototyping. It uses:
- Rails 8
- Hotwire/Turbo
- Stimulus
- Bootstrap
- ERB partials
- Local WBEZ/Ferris brand assets (logos + icons)

The purpose of this project is to help build new Rails interfaces that feel consistent with WBEZ editorial and product patterns while remaining fast to prototype.

## Architecture rules
- Prefer Rails-native patterns first: ERB partials, helpers, Turbo, and Stimulus.
- Do not introduce React, Vue, Tailwind, daisyUI, or client-side component frameworks unless explicitly requested.
- Reuse shared UI partials in `app/views/shared/ui` before creating one-off markup.
- If a new UI pattern is likely to be reused, extract a partial instead of copying markup.
- Keep controllers thin; prefer helpers and partial composition for display logic.
- Do not modify the application root route when adding demo pages or internal reference pages.

## Design system rules
- Use Bootstrap for layout, spacing, forms, nav, tables, buttons, cards, alerts, badges, pagination, and responsive structure.
- Layer WBEZ styling on top of Bootstrap rather than replacing Bootstrap with a custom utility system.
- Use `docs/design-system/bootstrap-wbez.md` and `docs/design-system/cursor-native-guide.md` as the primary style references.
- Keep pages restrained, content-first, readable, and high-contrast.
- Prefer editorial hierarchy over generic “app chrome.”

## Typography rules
- Use Source Sans Pro / sans-serif for UI, labels, forms, nav, metadata, and utility text.
- Use Charter / serif styling for editorial headlines, subheads, long-form story titles, and pull quotes.
- Sun-Times headlines use Proxima Nova via Typekit (`qzq4qkv`) with Helvetica/Arial fallbacks; keep this scoped to `.suntimes-prototype`.
- Use `.prose-wbez` for article bodies and long-form content on WBEZ pages; use `.prose-suntimes` inside `.suntimes-prototype` for Sun-Times article bodies.
- Wrap brand-specific pages in `.wbez-prototype` or `.suntimes-prototype` so SCSS under `app/assets/stylesheets/brands/` applies predictably.
- Sun-Times multi-column homepage modules use `.suntimes-homepage` on the main content shell (see `shared/ui/suntimes/home/*`).

## Shared UI inventory
Prefer these before writing new markup:

**Brand chrome (mirrored paths under `shared/ui/wbez` and `shared/ui/suntimes`):**
- `shared/ui/wbez/site_header` (WBEZ masthead)
- `shared/ui/wbez/site_footer`
- `shared/ui/wbez/article_shell` (WBEZ article layout)
- `shared/ui/suntimes/site_header` (Chicago Sun-Times masthead; do not use WBEZ header on CST pages)
- `shared/ui/suntimes/site_footer`
- `shared/ui/suntimes/article_shell` (Sun-Times article layout)
- `shared/ui/suntimes/utility_dropdown`, `shared/ui/suntimes/nav_dropdown` (header chrome)

**Neutral / shared editorial modules** (stay at `shared/ui/` root):
- `shared/ui/section_header`
- `shared/ui/story_card`
- `shared/ui/hero_story`
- `shared/ui/article_header`
- `shared/ui/figure`
- `shared/ui/pull_quote`
- `shared/ui/responsive_embed`
- `shared/ui/alert`
- `shared/ui/badge`
- `shared/ui/button`
- `shared/ui/card`
- `shared/ui/field`
- `shared/ui/tabs`
- `shared/ui/pagination`

## Icon and logo rules
- Ferris icons are local SVG files in `app/assets/images/icons`.
- Always render Ferris icons with `ferris_icon` or `inline_svg`.
- Do not use `image_tag` for Ferris icons, because external image rendering will not inherit `currentColor`.
- Local logos live in `app/assets/images/logos`.
- Use `/demo/icons` and `/demo/logos` as the reference pages for available assets.

## Editorial patterns
- Use `/demo/article` as the canonical article example.
- Use `/demo/home` as the canonical homepage-style example.
- Use `/demo/cookbook` as the canonical editorial-pattern reference.
- Prefer kicker → headline → dek → metadata → body hierarchy for stories.
- Prefer real editorial modules such as pull quotes, figures, embeds, and related content blocks over generic cards dropped into article bodies.

## Avoid
- One-off inline styles unless truly necessary.
- Novelty UI treatments.
- Arbitrary colors or spacing scales; use the brand tokens.
- Deeply nested custom HTML when an existing partial already matches.
- Hotlinking CDN assets in views when a local asset exists.

## Hotwire/Turbo rules
- Keep forms and links Turbo-compatible by default.
- Prefer Turbo Frames for scoped updates.
- Use Stimulus only for light progressive enhancement.
- Do not replace standard Rails behavior with unnecessary JavaScript.

## Demo route rules
- Demo pages are development-only reference pages.
- Allowed demo routes include `/demo`, `/demo/home`, `/demo/article`, `/demo/logos`, `/demo/icons`, `/demo/cookbook`, `/demo/cookbook-suntimes`, `/demo/style-guide-wbez`, and `/demo/style-guide-suntimes`.
- App prototype demos: `/demo/app-wbez` (river / experiments), `/demo/app-wbez/listen`, `/demo/app-wbez/browse`, `/demo/app-wbez/menu`, `/demo/app-suntimes` (river / experiments), `/demo/app-suntimes/home`.
- Demo routes must never override the app root route.

## Brand governance rules
- Keep brand tokens separate (`_wbez.scss`, `_suntimes_tokens.scss`, `_suntimes.scss`, `_suntimes_homepage.scss`).
- Sun-Times homepage layout scope: wrap main content in `.suntimes-homepage` (inside `.suntimes-prototype`).
- Never reuse a WBEZ-branded component on Sun-Times pages (or vice versa) unless the component is explicitly neutral.
- When introducing new design tokens or modules, add them to the matching style-guide and cookbook demo pages.

## Models (when you add them)
This starter ships without ActiveRecord models. For brand-specific domain logic, prefer `app/models/wbez/` and `app/models/suntimes/` (or `Wbez::` / `Suntimes::` namespaces) so structure mirrors views and stylesheets.

## When extending the system
When asked to build a new page:
1. Reuse shared partials first.
2. Follow Bootstrap layout conventions.
3. Apply WBEZ editorial hierarchy and typography.
4. Use local logos/icons/helpers.
5. Keep the result easy to refactor into reusable UI.

## App prototypes (mobile PWA)
- Use `.wbez-app-prototype` / `.suntimes-app-prototype` for mobile app shells (not `.wbez-prototype` website chrome).
- App UI lives under `shared/ui/app/` (neutral), `shared/ui/wbez/app/`, `shared/ui/suntimes/app/`.
- Layout: `layouts/app.html.erb`. Generators: `wbez:app`, `suntimes:app`.
- Experiments: view folders under `app/views/<app>/experiments/<variant>/`; register in `config/app_prototype.yml`.
- Never overwrite `baseline` when adding an experiment variant; add a new folder beside it.
- **Do not** put feed URLs, credentials, or product-specific IA in shared app UI — keep those in generated apps or `examples/wbez-app-lab`.
- PWA: `public/service-worker.js`, `/manifest.webmanifest`. See `docs/app-prototype/`.
