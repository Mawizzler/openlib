import {
  computeUpcomingReminders,
  getMockAccountSnapshot,
} from '@/src/application/services/ReminderScheduler';
import { defaultReminderPreferences } from '@/src/domain/models/reminders';

const snapshot = getMockAccountSnapshot();
const result = computeUpcomingReminders({
  now: new Date(),
  loans: snapshot.loans,
  reservations: snapshot.reservations,
  preferences: defaultReminderPreferences,
});

console.log('Generated at:', result.generatedAt);
console.log('Reminders:', JSON.stringify(result.reminders, null, 2));
