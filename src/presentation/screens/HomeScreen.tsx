import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';

import { useAccountSession } from '@/src/application/state/AccountSessionStore';
import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import {
  Button,
  Card,
  ScreenLayout,
  ScreenHeader,
} from '@/src/presentation/components/ScreenChrome';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type HomeScreenProps = {
  onPickLibrary: () => void;
  onStartSearch: () => void;
  onOpenAccount: () => void;
  onOpenReminderSettings: () => void;
  onOpenReminderHistory: () => void;
};

const formatAccountStatus = (status: string) => {
  switch (status) {
    case 'logged_in':
      return 'Signed in (scaffold)';
    case 'logging_in':
      return 'Signing in…';
    case 'error':
      return 'Sign-in error';
    default:
      return 'Signed out';
  }
};

export function HomeScreen({
  onPickLibrary,
  onStartSearch,
  onOpenAccount,
  onOpenReminderSettings,
  onOpenReminderHistory,
}: HomeScreenProps) {
  const { activeLibrary, isLoading } = useActiveLibrary();
  const { status, identity } = useAccountSession();
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const hasLibrary = Boolean(activeLibrary) && !isLoading;

  return (
    <ScreenLayout>
      <ScreenHeader
        title="Openlib"
        subtitle="Find books, manage your account, and stay ahead of due dates."
      />

      <Card style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{hasLibrary ? 'Ready to search' : 'First step required'}</Text>
        <Text style={styles.heroTitle}>
          {hasLibrary ? `Using ${activeLibrary?.title}` : 'Choose your library to unlock the app'}
        </Text>
        <Text style={styles.heroBody}>
          {hasLibrary
            ? 'Search, account, and reminders are now enabled.'
            : 'Openlib is library-first: select one library, then continue to search and account features.'}
        </Text>
        <Button
          label={hasLibrary ? 'Change library' : 'Choose a library'}
          onPress={onPickLibrary}
          variant="primary"
          style={styles.heroButton}
        />
      </Card>

      <Card
        title="1) Search the catalog"
        body={hasLibrary ? `Explore ${activeLibrary?.title} holdings.` : 'Locked until a library is selected.'}
        muted={!hasLibrary}
      >
        <Button
          label={hasLibrary ? 'Start search' : 'Choose library first'}
          onPress={hasLibrary ? onStartSearch : onPickLibrary}
          variant="secondary"
          style={styles.actionButton}
        />
      </Card>

      <Card
        title="2) Connect your account"
        body={formatAccountStatus(status)}
        meta={identity ? `${identity.username ? `${identity.username} · ` : ''}${identity.providerTitle}` : undefined}
        muted={!hasLibrary}
      >
        <Button
          label={hasLibrary ? 'Open account' : 'Choose library first'}
          onPress={hasLibrary ? onOpenAccount : onPickLibrary}
          variant="secondary"
          style={styles.actionButton}
        />
      </Card>

      <Card title="3) Set reminders" body="Manage your local reminder schedule." muted={!hasLibrary}>
        <View style={styles.buttonRow}>
          <Button
            label={hasLibrary ? 'Reminder settings' : 'Choose library first'}
            onPress={hasLibrary ? onOpenReminderSettings : onPickLibrary}
            variant="secondary"
          />
          <Button
            label={hasLibrary ? 'Scheduled reminders' : 'Choose library first'}
            onPress={hasLibrary ? onOpenReminderHistory : onPickLibrary}
            variant="secondary"
          />
        </View>
      </Card>
    </ScreenLayout>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    heroCard: {
      backgroundColor: palette.surface,
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: palette.textMuted,
    },
    heroTitle: {
      marginTop: 10,
      fontSize: 24,
      fontWeight: '700',
      color: palette.text,
    },
    heroBody: {
      marginTop: 10,
      fontSize: 15,
      lineHeight: 22,
      color: palette.textSubtle,
    },
    heroButton: {
      marginTop: 16,
    },
    actionButton: {
      marginTop: 12,
    },
    buttonRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    },
  });
