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
