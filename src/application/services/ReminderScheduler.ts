import type { AccountSnapshot, AccountLoan, AccountReservation } from '@/src/domain/models/account';
import type {
  ReminderItem,
  ReminderPreferences,
  LoanDueReminder,
  ReservationPickupReminder,
} from '@/src/domain/models/reminders';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export type ReminderScheduleInput = {
  now: Date;
  loans: AccountLoan[];
  reservations: AccountReservation[];
  preferences: ReminderPreferences;
  horizonDays?: number;
};

export type ReminderScheduleResult = {
  generatedAt: string;
  reminders: ReminderItem[];
};

export const computeUpcomingReminders = (
  input: ReminderScheduleInput,
): ReminderScheduleResult => {
  const { now, loans, reservations, preferences, horizonDays = 30 } = input;

  if (!preferences.enabled) {
    return { generatedAt: now.toISOString(), reminders: [] };
  }

  const horizonMs = horizonDays * MS_PER_DAY;
  const windowStart = now.getTime();
  const windowEnd = windowStart + horizonMs;

  const reminders: ReminderItem[] = [
    ...buildLoanReminders(loans, preferences, windowStart, windowEnd),
    ...buildReservationReminders(reservations, preferences, windowStart, windowEnd),
  ];

  reminders.sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());

  return {
    generatedAt: now.toISOString(),
    reminders,
  };
};

export const buildLoanReminders = (
  loans: AccountLoan[],
  preferences: ReminderPreferences,
  windowStart: number,
  windowEnd: number,
): LoanDueReminder[] =>
  loans.flatMap((loan) => {
    if (loan.status === 'returned') {
      return [];
    }

    const dueAt = parseDate(loan.dueDate);
    if (!dueAt) {
      return [];
    }

    const remindAt = new Date(dueAt.getTime() - preferences.loanDueLeadDays * MS_PER_DAY);
    const remindAtMs = remindAt.getTime();

    if (remindAtMs < windowStart || remindAtMs > windowEnd) {
      return [];
    }

    return [
      {
        id: buildReminderId('loan_due', loan.id, remindAt),
        kind: 'loan_due',
        loanId: loan.id,
        title: loan.title,
        dueDate: loan.dueDate,
        remindAt: remindAt.toISOString(),
        status: 'scheduled',
      },
    ];
  });

export const buildReservationReminders = (
  reservations: AccountReservation[],
  preferences: ReminderPreferences,
  windowStart: number,
  windowEnd: number,
): ReservationPickupReminder[] =>
  reservations.flatMap((reservation) => {
    if (reservation.status !== 'ready') {
      return [];
    }

    const pickupBy = parseDate(reservation.pickupByDate);
    if (!pickupBy) {
      return [];
    }

    const remindAt = new Date(
      pickupBy.getTime() - preferences.reservationPickupLeadHours * MS_PER_HOUR,
    );
    const remindAtMs = remindAt.getTime();

    if (remindAtMs < windowStart || remindAtMs > windowEnd) {
      return [];
    }

    return [
      {
        id: buildReminderId('reservation_pickup', reservation.id, remindAt),
        kind: 'reservation_pickup',
        reservationId: reservation.id,
        title: reservation.title,
        pickupByDate: reservation.pickupByDate,
        pickupLocation: reservation.pickupLocation,
        remindAt: remindAt.toISOString(),
        status: 'scheduled',
      },
    ];
  });

export const getMockAccountSnapshot = (): AccountSnapshot => ({
  loans: [
    {
      id: 'loan-101',
      title: 'Piranesi',
      dueDate: new Date(Date.now() + 5 * MS_PER_DAY).toISOString(),
      status: 'checked_out',
    },
    {
      id: 'loan-102',
      title: 'Braiding Sweetgrass',
      dueDate: new Date(Date.now() + 12 * MS_PER_DAY).toISOString(),
      status: 'overdue',
    },
  ],
  reservations: [
    {
      id: 'hold-201',
      title: 'The Left Hand of Darkness',
      pickupByDate: new Date(Date.now() + 2 * MS_PER_DAY).toISOString(),
      pickupLocation: 'Main Branch Desk',
      status: 'ready',
    },
  ],
});

const parseDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildReminderId = (kind: ReminderItem['kind'], sourceId: string, remindAt: Date) =>
  `${kind}-${sourceId}-${remindAt.toISOString()}`;
