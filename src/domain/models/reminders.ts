export type ReminderKind = 'loan_due' | 'reservation_pickup' | 'manual';

export type ReminderStatus = 'scheduled' | 'sent' | 'dismissed' | 'skipped';

export type ReminderPreferences = {
  enabled: boolean;
  loanDueLeadDays: number;
  reservationPickupLeadHours: number;
};

export type LoanDueReminder = {
  id: string;
  kind: 'loan_due';
  loanId: string;
  title: string;
  dueDate: string;
  remindAt: string;
  status: ReminderStatus;
};

export type ReservationPickupReminder = {
  id: string;
  kind: 'reservation_pickup';
  reservationId: string;
  title: string;
  pickupByDate: string;
  pickupLocation?: string;
  remindAt: string;
  status: ReminderStatus;
};

export type ManualReminder = {
  id: string;
  kind: 'manual';
  recordId: string;
  title: string;
  remindAt: string;
  status: ReminderStatus;
};

export type ReminderItem = LoanDueReminder | ReservationPickupReminder | ManualReminder;

export type ReminderHistoryEntry = ReminderItem & {
  sentAt: string;
};

export type ReminderState = {
  lastGeneratedAt?: string;
  scheduled: ReminderItem[];
  history: ReminderHistoryEntry[];
};

export const defaultReminderPreferences: ReminderPreferences = {
  enabled: true,
  loanDueLeadDays: 2,
  reservationPickupLeadHours: 12,
};

export const defaultReminderState = (): ReminderState => ({
  scheduled: [],
  history: [],
});
