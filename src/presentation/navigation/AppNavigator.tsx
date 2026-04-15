import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import type { OpacBriefRecord } from '@/src/domain/models/opac';
import { AccountScreen } from '@/src/presentation/screens/AccountScreen';
import { HomeScreen } from '@/src/presentation/screens/HomeScreen';
import { LibraryPickerScreen } from '@/src/presentation/screens/LibraryPickerScreen';
import { RecordDetailsScreen } from '@/src/presentation/screens/RecordDetailsScreen';
import { ReminderHistoryScreen } from '@/src/presentation/screens/ReminderHistoryScreen';
import { ReminderSettingsScreen } from '@/src/presentation/screens/ReminderSettingsScreen';
import { SearchScreen } from '@/src/presentation/screens/SearchScreen';

type Route =
  | { name: 'Home' }
  | { name: 'Account' }
  | { name: 'LibraryPicker' }
  | { name: 'Search' }
  | { name: 'ReminderSettings' }
  | { name: 'ReminderHistory' }
  | { name: 'Details'; params: { record: OpacBriefRecord; libraryId?: string } };

export function AppNavigator() {
  const [route, setRoute] = useState<Route>({ name: 'Home' });
  const [history, setHistory] = useState<Route[]>([]);
  const { activeLibrary, isLoading } = useActiveLibrary();

  const goToLibraryPicker = () => {
    setHistory((prev) => [...prev, route]);
    setRoute({ name: 'LibraryPicker' });
  };

  const requireLibraryThen = (nextRoute: Route) => {
    if (!activeLibrary && !isLoading) {
      goToLibraryPicker();
      return;
    }
    setRoute(nextRoute);
  };

  const handleCloseLibraryPicker = () => {
    if (!activeLibrary && !isLoading) {
      setHistory([]);
      setRoute({ name: 'Home' });
      return;
    }
    setHistory((prev) => {
      const nextHistory = [...prev];
      const fallback = nextHistory.pop() ?? { name: 'Home' };
      setRoute(fallback);
      return nextHistory;
    });
  };

  const navigateTo = (nextRoute: Route) => {
    setHistory((prev) => [...prev, route]);
    setRoute(nextRoute);
  };

  const goBack = (fallback: Route = { name: 'Home' }) => {
    setHistory((prev) => {
      const nextHistory = [...prev];
      const previous = nextHistory.pop() ?? fallback;
      setRoute(previous);
      return nextHistory;
    });
  };

  const handleShowDetails = (record: OpacBriefRecord, libraryId: string | null) => {
    setRoute({ name: 'Details', params: { record, libraryId: libraryId ?? undefined } });
  };

  const routeView = useMemo(() => {
    switch (route.name) {
      case 'Home':
        return (
          <HomeScreen
            onPickLibrary={goToLibraryPicker}
            onOpenAccount={() => requireLibraryThen({ name: 'Account' })}
            onStartSearch={() => requireLibraryThen({ name: 'Search' })}
            onOpenReminderSettings={() => requireLibraryThen({ name: 'ReminderSettings' })}
            onOpenReminderHistory={() => requireLibraryThen({ name: 'ReminderHistory' })}
          />
        );
      case 'Account':
        return (
          <AccountScreen
            onBack={() => goBack({ name: 'Home' })}
            onPickLibrary={goToLibraryPicker}
          />
        );
      case 'LibraryPicker':
        return <LibraryPickerScreen onClose={handleCloseLibraryPicker} />;
      case 'Search':
        return (
          <SearchScreen
            onBack={() => goBack({ name: 'Home' })}
            onPickLibrary={goToLibraryPicker}
            onShowDetails={handleShowDetails}
          />
        );
      case 'ReminderSettings':
        return (
          <ReminderSettingsScreen
            onBack={() => goBack({ name: 'Home' })}
            onOpenHistory={() => navigateTo({ name: 'ReminderHistory' })}
          />
        );
      case 'ReminderHistory':
        return <ReminderHistoryScreen onBack={() => goBack({ name: 'Home' })} />;
      case 'Details':
        return (
          <RecordDetailsScreen
            record={route.params.record}
            libraryId={route.params.libraryId}
            onBack={() => goBack({ name: 'Search' })}
          />
        );
      default:
        return null;
    }
  }, [route, activeLibrary, isLoading]);

  return <View style={{ flex: 1 }}>{routeView}</View>;
}
