export type RootStackParamList = {
  Home: undefined;
  Account: undefined;
  LibraryPicker: undefined;
  Search: { q?: string } | undefined;
  Details: { recordId: string };
  Settings: undefined;
  ReminderSettings: undefined;
  ReminderHistory: undefined;
};
