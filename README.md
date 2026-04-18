# Daily Journaling Reminder

An Obsidian plugin that reminds you to journal:

- when Obsidian first gains focus for the day
- again at night if today's journal note does not exist yet

Clicking the reminder opens or creates today's note in `DD-MM-YYYY` format.

## Defaults

- Journal folder: `Daily Journal`
- Night reminder time: `21:00`
- Note title format: `DD-MM-YYYY`

## Development

1. Install dependencies with `pnpm install` or `npm install`
2. Build with `pnpm build` or `npm run build`
3. Copy `manifest.json`, `main.js`, and optionally `styles.css` into your Obsidian vault's `.obsidian/plugins/daily-journaling-reminder/`

## Releases

This repo includes a manual GitHub Actions release workflow.

1. Push your changes to GitHub whenever you want
2. Open the `Release Plugin` workflow in GitHub Actions
3. Run it manually with a version like `0.1.0`
4. The workflow builds with `pnpm`, tags the repo as `v0.1.0`, creates a GitHub release, and uploads `main.js`, `manifest.json`, `styles.css`, and `versions.json`

GitHub will also generate release notes from the commits since the previous release, which gives you a lightweight diff/changelog automatically.

## Behavior

- The plugin checks whether today's note already exists before reminding you.
- The reminder opens a modal with an action button instead of only showing a passive notification.
- If the note does not exist yet, the plugin creates it with a heading that matches the date.
