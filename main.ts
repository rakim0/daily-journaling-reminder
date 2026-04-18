import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile
} from "obsidian";

interface JournalReminderSettings {
	journalFolder: string;
	nightReminderHour: number;
	lastStartupReminderDate: string;
	lastNightReminderDate: string;
}

const DEFAULT_SETTINGS: JournalReminderSettings = {
	journalFolder: "Daily Journal",
	nightReminderHour: 21,
	lastStartupReminderDate: "",
	lastNightReminderDate: ""
};

export default class JournalReminderPlugin extends Plugin {
	settings: JournalReminderSettings = DEFAULT_SETTINGS;
	private nightReminderTimeout: number | null = null;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "open-todays-journal",
			name: "Open today's journal note",
			callback: async () => {
				await this.openOrCreateTodayJournal();
			}
		});

		this.addRibbonIcon("calendar-days", "Open today's journal note", async () => {
			await this.openOrCreateTodayJournal();
		});

		this.addSettingTab(new JournalReminderSettingTab(this.app, this));

		this.registerDomEvent(window, "focus", () => {
			void this.maybeShowStartupReminder();
		});

		this.app.workspace.onLayoutReady(() => {
			void this.maybeShowStartupReminder();
			this.scheduleNightReminder();
		});
	}

	onunload() {
		this.clearNightReminder();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.scheduleNightReminder();
	}

	private clearNightReminder() {
		if (this.nightReminderTimeout !== null) {
			window.clearTimeout(this.nightReminderTimeout);
			this.nightReminderTimeout = null;
		}
	}

	private scheduleNightReminder() {
		this.clearNightReminder();

		const now = new Date();
		const nextReminder = new Date(now);
		nextReminder.setHours(this.settings.nightReminderHour, 0, 0, 0);

		if (nextReminder.getTime() <= now.getTime()) {
			nextReminder.setDate(nextReminder.getDate() + 1);
		}

		const delay = nextReminder.getTime() - now.getTime();
		this.nightReminderTimeout = window.setTimeout(() => {
			void this.maybeShowNightReminder();
			this.scheduleNightReminder();
		}, delay);
	}

	private async maybeShowStartupReminder() {
		const today = this.getTodayNoteName();
		if (this.settings.lastStartupReminderDate === today) {
			return;
		}

		if (await this.hasJournalForToday()) {
			this.settings.lastStartupReminderDate = today;
			await this.saveData(this.settings);
			return;
		}

		this.settings.lastStartupReminderDate = today;
		await this.saveData(this.settings);
		new JournalReminderModal(this.app, this, "Time to journal", "Open today's journal note now?").open();
	}

	private async maybeShowNightReminder() {
		const now = new Date();
		if (now.getHours() < this.settings.nightReminderHour) {
			return;
		}

		const today = this.getTodayNoteName();
		if (this.settings.lastNightReminderDate === today) {
			return;
		}

		if (await this.hasJournalForToday()) {
			this.settings.lastNightReminderDate = today;
			await this.saveData(this.settings);
			return;
		}

		this.settings.lastNightReminderDate = today;
		await this.saveData(this.settings);
		new JournalReminderModal(this.app, this, "Night journal reminder", "Wrap up the day by writing in today's journal.").open();
	}

	async openOrCreateTodayJournal() {
		const notePath = this.getTodayNotePath();
		let file = this.app.vault.getAbstractFileByPath(notePath);

		if (!file) {
			await this.ensureFolderExists(this.settings.journalFolder);
			file = await this.app.vault.create(notePath, `# ${this.getTodayNoteName()}\n`);
			new Notice("Created today's journal note.");
		}

		if (file instanceof TFile) {
			await this.app.workspace.getLeaf(true).openFile(file);
		}
	}

	private async hasJournalForToday(): Promise<boolean> {
		const notePath = this.getTodayNotePath();
		return this.app.vault.getAbstractFileByPath(notePath) instanceof TFile;
	}

	private getTodayNotePath(): string {
		const folder = this.settings.journalFolder.trim().replace(/^\/+|\/+$/g, "");
		const noteName = this.getTodayNoteName();
		return folder.length > 0 ? `${folder}/${noteName}.md` : `${noteName}.md`;
	}

	private getTodayNoteName(): string {
		const now = new Date();
		const day = String(now.getDate()).padStart(2, "0");
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const year = String(now.getFullYear());
		return `${day}-${month}-${year}`;
	}

	private async ensureFolderExists(folderPath: string) {
		const cleanPath = folderPath.trim().replace(/^\/+|\/+$/g, "");
		if (!cleanPath) {
			return;
		}

		const parts = cleanPath.split("/");
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(currentPath)) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}
}

class JournalReminderModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: JournalReminderPlugin,
		private readonly titleText: string,
		private readonly message: string
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: this.titleText });
		contentEl.createEl("p", { text: this.message });

		const buttonRow = contentEl.createDiv({ cls: "journal-reminder-actions" });

		const openButton = buttonRow.createEl("button", {
			text: "Open today's journal"
		});
		openButton.addEventListener("click", () => {
			void this.plugin.openOrCreateTodayJournal();
			this.close();
		});

		const laterButton = buttonRow.createEl("button", {
			text: "Later"
		});
		laterButton.addEventListener("click", () => {
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

class JournalReminderSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: JournalReminderPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Daily Journaling Reminder" });

		new Setting(containerEl)
			.setName("Journal folder")
			.setDesc("Where daily journal notes should be created.")
			.addText((text) =>
				text
					.setPlaceholder("Daily Journal")
					.setValue(this.plugin.settings.journalFolder)
					.onChange(async (value) => {
						this.plugin.settings.journalFolder = value.trim() || DEFAULT_SETTINGS.journalFolder;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Night reminder hour")
			.setDesc("24-hour local time for the evening reminder.")
			.addSlider((slider) =>
				slider
					.setLimits(18, 23, 1)
					.setValue(this.plugin.settings.nightReminderHour)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.nightReminderHour = value;
						await this.plugin.saveSettings();
					})
			);
	}
}

