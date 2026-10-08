# CLAUDE.md

@AGENTS.md

## This repo

This repo is two things at once:

- **A runnable Rails 8 app** for building prototypes. The WBEZ Bootstrap Starter template has already been applied here.
- **The template source** it came from (`template/`, `lib/generators/`, `test/`), kept so updates can be pulled from the `upstream` remote (`apilhofer/wbez-rails-bootstrap-starter`).

Build prototypes in the app. Leave `template/` and the template tests alone unless asked to change the starter itself.

## Running

- Ruby 3.3.12 via rbenv (`.ruby-version`), Node via nvm, SQLite. No models yet.
- `bin/setup --skip-server` once (gems, npm packages, CSS build, database), then `bin/dev` (Rails server + Sass watcher) and open `http://localhost:3000/demo`.
- `npm run build:css` rebuilds `app/assets/builds/application.css` once without the watcher.
- `bin/test` runs the template and generator tests. The integration tests build throwaway Rails apps and are slow.

## New prototypes

Start from a generator rather than hand-rolling a page:

- `bin/rails generate wbez:page <name> --type=article|home`
- `bin/rails generate suntimes:page <name> --type=article|home`
- `bin/rails generate wbez:app <name>` / `bin/rails generate suntimes:app <name>` (mobile PWA shell with experiments)

Each adds a controller, views and a route at `/<name>`.

## Listening Companion prototype

A mobile-first demo of the WBEZ app as a listening companion, at `/companion` (the stream as recorded) and `/companion/demo` (a sample morning with placeholder Sun-Times stories).

- **Inputs are not in git:** `wbez-recordings/` (audio and transcript JSON), `data/rss/` (Sun-Times feed snapshot) and `PROTOTYPE_PLAN.md`. `bin/rails companion:setup` remuxes the audio, links `public/audio` and fetches a feed snapshot if there is none.
- **Hand-edited data:** `data/shows.yml` (show names, replay flags, upcoming shows) and `data/related.yml` (pin, block and sample stories).
- **Server:** `Broadcast`, `SunTimes` and `RelatedStories` in `app/models` are plain Ruby objects cached in memory. There is no database. Controllers and views live under `companion/`.
- **Client:** Stimulus controllers share state through `app/javascript/companion.js`. The player, clock and store sit in a `data-turbo-permanent` root in `layouts/companion`, so audio survives tab changes.
- **Styles:** `brands/_wbez_companion.scss`, classes prefixed `cp-`, colours from the WBEZ tokens.
- **Checks:** `/companion/debug` lists what the loaders produced. `docs/recon.md` and `docs/data-notes.md` record what the template and the data looked like going in.
- **Demo clock:** `?at=HH:MM` and `?speed=1|4|10`. `?listen=a|b` switches the Listen variant.

