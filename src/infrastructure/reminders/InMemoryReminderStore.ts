import type { ReminderStore } from '@/src/application/ports/ReminderStore';
import {
  defaultReminderPreferences,
  defaultReminderState,
  type ReminderHistoryEntry,
  type ReminderItem,
  type ReminderPreferences,
  type ReminderState,
} from '@/src/domain/models/reminders';

export class InMemoryReminderStore implements ReminderStore {
  private preferences: ReminderPreferences;
  private state: ReminderState;

  constructor(
    preferences: ReminderPreferences = defaultReminderPreferences,
    state: ReminderState = defaultReminderState(),
  ) {
    this.preferences = { ...preferences };
    this.state = {
      ...state,
      scheduled: [...state.scheduled],
      history: [...state.history],
    };
  }

  async getPreferences(): Promise<ReminderPreferences> {
    return { ...this.preferences };
  }

  async setPreferences(preferences: ReminderPreferences): Promise<void> {
    this.preferences = { ...preferences };
  }

  async getState(): Promise<ReminderState> {
    return {
      ...this.state,
      scheduled: [...this.state.scheduled],
      history: [...this.state.history],
    };
  }

  async setState(state: ReminderState): Promise<void> {
    this.state = {
      ...state,
      scheduled: [...state.scheduled],
      history: [...state.history],
    };
  }

  async upsertScheduled(reminders: ReminderItem[]): Promise<void> {
    const existing = new Map(this.state.scheduled.map((item) => [item.id, item]));
    for (const reminder of reminders) {
      existing.set(reminder.id, reminder);
    }
    this.state.scheduled = Array.from(existing.values());
  }

  async appendHistory(entry: ReminderHistoryEntry): Promise<void> {
    this.state.history = [...this.state.history, entry];
  }
}
