THEMES — How to add a new theme

This project supports theme files under `Styles/` named `theme-<name>.css` (for example `theme-red.css`). Each theme file should scope rules using a class applied to `<body>` — e.g. `body.theme-<name> { ... }` so the theme can be switched dynamically.

Minimum contents for a theme file
- Set theme variables and root `body.theme-<name>` background/text colors
- Provide scoped overrides for key elements: nav (`#top-nav`), containers (`.game-container`, `.profile-container`), buttons/choices (`.choice-btn`), badges (`.status-badge`, `.rank-badge`), and progress bars (`.progress-bar-fill`)

Example (short):

body.theme-new {
  --tm-bg-start: #111;
  --tm-bg-mid: #222;
  --tm-accent: #88cc66;
  --tm-text: #e6ffe6;
  background: linear-gradient(135deg, var(--tm-bg-start), var(--tm-bg-mid));
  color: var(--tm-text) !important;
}
body.theme-new #top-nav { background: linear-gradient(135deg, #111, #222) !important; }
body.theme-new .choice-btn { background-color: var(--tm-accent) !important; color: #041; }

How to install a new theme:
1. Add `Styles/theme-<name>.css` with the scoped rules above.
2. Add a radio input to `settings.html` (theme-select area) with `value="<name>"` and optionally add a small `.theme-swatch.swatch-<name>` class for the swatch. Example:
   <label><input type="radio" name="theme" value="<name>" id="theme-<name>" /> <span class="theme-swatch swatch-<name>"></span> FriendlyName</label>
3. No further JS changes should be necessary — `nav.js` loads `Styles/theme-<name>.css` automatically.

Tips:
- Keep color variables consistent (`--tm-accent`, `--tm-accent-2`, `--tm-text`, `--tm-text-dark`) for portability.
- Use `!important` sparingly but required for overriding existing page styles.
- For testing, use the Settings preview (change radio) and Save.

If you want, I can add a small generator script that scaffolds a new theme file and the settings radio entry automatically.