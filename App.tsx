import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { ActiveLibraryProvider } from '@/src/application/state/ActiveLibraryStore';
import { AccountSessionProvider } from '@/src/application/state/AccountSessionStore';
import { ReminderPreferencesProvider } from '@/src/application/state/ReminderPreferencesStore';
import { ReminderStateProvider } from '@/src/application/state/ReminderStateStore';
import { AppNavigator } from '@/src/presentation/navigation/AppNavigator';
import '@/global.css';

export default function App() {
  return (
    <SafeAreaProvider>
      <GluestackUIProvider mode="system">
        <ActiveLibraryProvider>
          <AccountSessionProvider>
            <ReminderPreferencesProvider>
              <ReminderStateProvider>
                <AppNavigator />
                <StatusBar style="auto" />
              </ReminderStateProvider>
            </ReminderPreferencesProvider>
          </AccountSessionProvider>
        </ActiveLibraryProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
