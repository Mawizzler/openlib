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
  const [previousRoute, setPreviousRoute] = useState<Route | null>(null);
  const { activeLibrary, isLoading } = useActiveLibrary();

  const goToLibraryPicker = () => {
    setPreviousRoute(route);
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
      setRoute({ name: 'Home' });
      return;
    }
    setRoute(previousRoute ?? { name: 'Home' });
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
            onBack={() => setRoute({ name: 'Home' })}
            onPickLibrary={goToLibraryPicker}
          />
        );
      case 'LibraryPicker':
        return <LibraryPickerScreen onClose={handleCloseLibraryPicker} />;
      case 'Search':
        return (
          <SearchScreen
            onBack={() => setRoute({ name: 'Home' })}
            onPickLibrary={goToLibraryPicker}
            onShowDetails={handleShowDetails}
          />
        );
      case 'ReminderSettings':
        return (
          <ReminderSettingsScreen
            onBack={() => setRoute({ name: 'Home' })}
            onOpenHistory={() => setRoute({ name: 'ReminderHistory' })}
          />
        );
      case 'ReminderHistory':
        return <ReminderHistoryScreen onBack={() => setRoute({ name: 'Home' })} />;
      case 'Details':
        return (
          <RecordDetailsScreen
            record={route.params.record}
            libraryId={route.params.libraryId}
            onBack={() => setRoute({ name: 'Search' })}
          />
        );
      default:
        return null;
    }
  }, [route, previousRoute, activeLibrary, isLoading]);

  return <View style={{ flex: 1 }}>{routeView}</View>;
}
