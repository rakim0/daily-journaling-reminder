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
	reminderTime: string;
	enableSystemNotifications: boolean;
	lastStartupReminderDate: string;
	lastScheduledReminderDate: string;
}

const DEFAULT_SETTINGS: JournalReminderSettings = {
	journalFolder: "Daily Journal",
	reminderTime: "21:00",
	enableSystemNotifications: true,
	lastStartupReminderDate: "",
	lastScheduledReminderDate: ""
};

export default class JournalReminderPlugin extends Plugin {
	settings: JournalReminderSettings = DEFAULT_SETTINGS;
	private nightReminderTimeout: number | null = null;

	async onload() {
		await this.loadSettings();
		void this.ensureNotificationPermission();

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
		const loaded = await this.loadData();
		const legacyHour =
			loaded && typeof loaded.nightReminderHour === "number"
				? String(loaded.nightReminderHour).padStart(2, "0")
				: null;

		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded, {
			reminderTime:
				typeof loaded?.reminderTime === "string" && this.isValidTimeString(loaded.reminderTime)
					? loaded.reminderTime
					: legacyHour
						? `${legacyHour}:00`
						: DEFAULT_SETTINGS.reminderTime,
			lastScheduledReminderDate:
				typeof loaded?.lastScheduledReminderDate === "string"
					? loaded.lastScheduledReminderDate
					: typeof loaded?.lastNightReminderDate === "string"
						? loaded.lastNightReminderDate
						: DEFAULT_SETTINGS.lastScheduledReminderDate
		});
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
		const [hours, minutes] = this.parseReminderTime();
		nextReminder.setHours(hours, minutes, 0, 0);

		if (nextReminder.getTime() <= now.getTime()) {
			nextReminder.setDate(nextReminder.getDate() + 1);
		}

		const delay = nextReminder.getTime() - now.getTime();
		this.nightReminderTimeout = window.setTimeout(() => {
			void this.maybeShowScheduledReminder();
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
		await this.showReminder("Time to journal", "Open today's journal note now?");
	}

	private async maybeShowScheduledReminder() {
		const today = this.getTodayNoteName();
		if (this.settings.lastScheduledReminderDate === today) {
			return;
		}

		if (await this.hasJournalForToday()) {
			this.settings.lastScheduledReminderDate = today;
			await this.saveData(this.settings);
			return;
		}

		this.settings.lastScheduledReminderDate = today;
		await this.saveData(this.settings);
		await this.showReminder("Journal reminder", "Take a moment to write in today's journal.");
	}

	async openOrCreateTodayJournal() {
		const notePath = this.getTodayNotePath();
		let file = this.app.vault.getAbstractFileByPath(notePath);

		if (!file) {
			await this.ensureFolderExists(this.settings.journalFolder);
			file = await this.app.vault.create(notePath, "#daily-journal\n");
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

	isValidTimeString(value: string): boolean {
		return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
	}

	private parseReminderTime(): [number, number] {
		if (!this.isValidTimeString(this.settings.reminderTime)) {
			return [21, 0];
		}

		const [hours, minutes] = this.settings.reminderTime.split(":").map(Number);
		return [hours, minutes];
	}

	private async showReminder(title: string, message: string) {
		const notificationShown = await this.showSystemNotification(title, message);

		if (!notificationShown) {
			new JournalReminderModal(this.app, this, title, message).open();
		}
	}

	private async showSystemNotification(title: string, message: string): Promise<boolean> {
		if (!this.settings.enableSystemNotifications || typeof Notification === "undefined") {
			return false;
		}

		const permission = await this.ensureNotificationPermission();
		if (permission !== "granted") {
			return false;
		}

		const notification = new Notification(title, {
			body: message,
			silent: false
		});

		notification.onclick = () => {
			window.focus();
			void this.openOrCreateTodayJournal();
			notification.close();
		};

		return true;
	}

	async ensureNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
		if (typeof Notification === "undefined") {
			return "unsupported";
		}

		if (Notification.permission === "default") {
			return Notification.requestPermission();
		}

		return Notification.permission;
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
			.setName("Reminder time")
			.setDesc("24-hour local time for the daily reminder, for example 07:30 or 21:15.")
			.addText((text) =>
				text
					.setPlaceholder("21:00")
					.setValue(this.plugin.settings.reminderTime)
					.onChange(async (value) => {
						const trimmedValue = value.trim();
						if (!this.plugin.isValidTimeString(trimmedValue)) {
							return;
						}

						this.plugin.settings.reminderTime = trimmedValue;
						this.plugin.settings.lastScheduledReminderDate = "";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("System notifications")
			.setDesc("Use desktop notifications when a journal reminder fires.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableSystemNotifications)
					.onChange(async (value) => {
						this.plugin.settings.enableSystemNotifications = value;
						await this.plugin.saveSettings();

						if (value) {
							await this.plugin.ensureNotificationPermission();
						}
					})
			);
	}
}
