# Openlib UX & Navigation Concept (MVP)

## Product goal
Make local library search and account workflows faster than legacy OPAC UX.

## Primary user flows
1. **Library selection**
   - Search/select local library
   - Set active library profile
2. **Search**
   - Query + quick filters
   - Results list with availability hints
3. **Detail**
   - Title metadata
   - Holdings / branch / status
4. **Account**
   - Loans, due dates, reservations
5. **Reminders**
   - Due-soon notifications
   - Hold pickup reminders

## Navigation structure (bottom tabs)
- **Discover**
  - Home
  - Library picker
- **Search**
  - Search screen
  - Results list
  - Item detail
- **Account**
  - Loans
  - Reservations
- **Reminders**
  - Reminder settings
  - Notification history
- **Settings**
  - Active library
  - Sync/debug info

## Screen map
- `DiscoverHomeScreen`
- `LibraryPickerScreen`
- `SearchScreen`
- `SearchResultsScreen`
- `ItemDetailScreen`
- `AccountLoansScreen`
- `AccountReservationsScreen`
- `ReminderSettingsScreen`
- `ReminderHistoryScreen`
- `SettingsScreen`

## Gluestack component map
- Search input: `Input`, `InputField`
- Filter chips: `Pressable` + tokenized badge style
- Result card: `Box`, `VStack`, `HStack`, `Badge`
- Detail sections: `Accordion`, `Divider`
- Empty/error states: `Center`, `Icon`, `Text`
- CTA: `Button`, `ButtonText`

## UX rules
- Keep search visible on search-related screens.
- Always show active library context.
- Availability status must be color + text (not color-only).
- Account/reminder actions should be max 2 taps from home.

## MVP acceptance
- User can set active library and complete search→detail flow.
- User can view account loans/reservations placeholders.
- Reminder screens exist with clear setup flow.
