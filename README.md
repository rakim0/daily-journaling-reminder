# Daily Journaling Reminder

An Obsidian plugin that reminds you to journal:

- when Obsidian first gains focus for the day
- again at your configured daily reminder time if today's journal note does not exist yet

Clicking the reminder opens or creates today's note in `DD-MM-YYYY` format.

## Defaults

- Journal folder: `Daily Journal`
- Reminder time: `21:00`
- Journal prompts: empty
- Note title format: `DD-MM-YYYY`

## Development

1. Install dependencies with `pnpm install` or `npm install`
2. Build with `pnpm build` or `npm run build`
3. Copy the contents of `build/` into your Obsidian vault's `.obsidian/plugins/daily-journaling-reminder/`

## Behavior

- The plugin checks whether today's note already exists before reminding you.
- You can set the daily reminder to any exact `HH:MM` time, not just late evening hours.
- Changing the configured reminder time resets that scheduled reminder state so the new time applies cleanly.
- The reminder opens a modal with an action button instead of only showing a passive notification.
- If the note does not exist yet, the plugin creates it with your configured journal prompts, or a default heading when prompts are empty.
