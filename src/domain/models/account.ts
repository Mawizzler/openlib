export type AccountLoan = {
  id: string;
  title: string;
  dueDate: string;
  status: 'checked_out' | 'overdue' | 'returned';
};

export type AccountReservation = {
  id: string;
  title: string;
  pickupByDate: string;
  pickupLocation?: string;
  status: 'ready' | 'in_transit' | 'expired' | 'collected';
};

export type AccountSnapshot = {
  loans: AccountLoan[];
  reservations: AccountReservation[];
};
