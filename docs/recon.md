# Template recon (Phase 0)

Notes on what the starter already gives the Listening Companion prototype, and what it doesn't.

## Layout and shell

- **`layouts/app.html.erb` is the mobile shell to build on.** It has slots for `:app_header`, `:app_mini_player`, `:app_tabbar` and an experiment banner, sets the viewport and iOS meta tags, and registers the service worker.
- **The mini player is not persistent today.** It is rendered inside the layout per page with no `data-turbo-permanent`, and there is no `<audio>` element anywhere in the app shell. Only the tab bar (`#wbez-app-tabbar`) is marked permanent. Phase 2 has to add the permanent player container.
- **The shell is full-width, not a phone column.** `.app-screen` fills the viewport and `--app-content-max-width` is 640px. The tab bar and mini player are `position: fixed` to the window edges, so a centred 390px column with a desktop demo panel needs them re-anchored to the column.
- **Shell dimensions are CSS custom properties** in `brands/_app_shell.scss`: `--app-header-height`, `--app-tabbar-height`, `--app-mini-player-height`, `--app-touch-min` (44px), and the safe-area insets.

## Existing WBEZ app screens

- **`/demo/app-wbez/listen` is the closest starting point.** It is a dark "Radio" screen: `listen_header`, `listen_now_hero`, a "Live Earlier" list of `listen_earlier_row`, and a dark mini player. All content is hardcoded sample data in `DemoWbezListenSampleData` (`audio_url: nil`).
- **Browse and Menu screens also exist** (`wbez_browse`, `wbez_menu`) with podcast tiles, audio cards and a news carousel. `browse_podcast_tile` is reusable for the Discover grid.
- **The current tabs are Browse / Radio / Donate.** The plan wants Listen / Discover / Library with Donate as a header heart, so the tab list changes. Tab icons are inline SVG inside `bottom_tab_bar`, switched on an `icon` key.
- **Neutral app partials** in `shared/ui/app/`: `sheet`, `mini_audio_player`, `full_audio_player`, `story_row`, `saved_button`, `empty_state`, `loading_skeleton`, `experiment_selector`.

## Styles

- **There are no WBEZ Sass variables, only CSS custom properties.** Bootstrap is imported with its default Sass variables, then overridden through `:root` properties: `--wbez-red` (#ed0000), `--wbez-red-dark`, `--wbez-black`, `--wbez-muted`, `--wbez-border`, `--wbez-subtle`, `--wbez-teal`, `--wbez-serif`, `--wbez-sans`. "Don't hardcode brand colours" therefore means using `var(--wbez-*)`.
- **App-level aliases sit on top:** `--app-accent`, `--app-headline-font`, `--app-ui-font`, `--app-chrome-bg`, `--app-chrome-border` (in `_wbez_app.scss`).
- **The Listen screen has its own dark palette** in `_wbez_listen.scss` (`--wbez-listen-bg` #121212, `-surface`, `-text`, `-muted`, `-border`), scoped by the body class `wbez-app-prototype--listen`.
- **Fonts:** Source Sans 3 loads from Google Fonts. Charter is named in `--wbez-serif` but never loaded, so serif headlines fall back to a system serif on most devices.
- **All styles compile into one file.** New partials go in `brands/` and must be added to the import list at the bottom of `application.bootstrap.scss`.

## JavaScript

- **The Stimulus controllers are stubs.** `app_audio` only toggles `hidden` on the mini player, `app_sheet` adds and removes `is-open`, `saved_story` keeps a list of IDs in `localStorage`. None of them play audio. The plan's `player`, `clock`, `transcript`, `store`, `sheet` and `toast` controllers are all new.
- **importmap pins** Turbo, Stimulus and Bootstrap's JS bundle; every file in `app/javascript/controllers` is auto-registered. No new packages are needed.

## Icons

- **The Ferris set covers the player:** `play`, `pause`, `stop`, `skip-back`, `skip-forward`, `jump-back`, `jump-forward`, `search`, `heart`, `plus`, `times`, `menu`, `microphone`, `external-link`.
- **Missing from the set:** bell, queue or list, bookmark, chevron, check. The `bootstrap-icons` npm package is installed but nothing uses it. Options are inline SVG (as the tab bar already does) or wiring up Bootstrap Icons.

## Controllers, routes and state

- **Everything app-related hangs off `DemoAppController`** with sample-data concerns, under development-only `/demo/app-wbez/*` routes. The prototype's own controllers (`listen`, `schedule`, `search`, `discover`, `library`, `airings`) need routes outside the development-only block if the demo is ever deployed.
- **There is an existing variant mechanism:** the `AppExperiment` concern, `config/app_prototype.yml`, and `?experiment=` stored in the session. The plan asks for `?listen=a|b` in `localStorage` instead, so the two would sit side by side.
- **There are no models and no `data/` directory.** `app/models/` holds only `application_record.rb`. The POROs in the plan are new.
- **The PWA manifest is hardcoded** to start at `/demo/app-wbez`, and the icons in `public/pwa/` are 1×1 placeholders.

## Missing inputs

- **`docs/reference/` does not exist.** The two HTML prototypes and the UX working doc named in section 10 of the plan are not in the repo.
