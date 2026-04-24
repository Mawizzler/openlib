import { StyleSheet, Text } from 'react-native';
import { useMemo } from 'react';

import { useAccountSession } from '@/src/application/state/AccountSessionStore';
import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import {
  Badge,
  Button,
  Inline,
  ScreenHeader,
  ScreenLayout,
  SectionCard,
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

      <SectionCard
        style={styles.heroCard}
        footer={
          <Button
            label={hasLibrary ? 'Change library' : 'Choose a library'}
            onPress={onPickLibrary}
            variant="primary"
          />
        }
      >
        <Badge label={hasLibrary ? 'Ready to search' : 'First step required'} tone={hasLibrary ? 'success' : 'warning'} />
        <Text style={styles.heroTitle}>
          {hasLibrary ? `Using ${activeLibrary?.title}` : 'Choose your library to unlock the app'}
        </Text>
        <Text style={styles.heroBody}>
          {hasLibrary
            ? 'Search, account, and reminders are now enabled.'
            : 'Openlib is library-first: select one library, then continue to search and account features.'}
        </Text>
      </SectionCard>

      <SectionCard
        title="1) Search the catalog"
        body={hasLibrary ? `Explore ${activeLibrary?.title} holdings.` : 'Locked until a library is selected.'}
        muted={!hasLibrary}
        footer={
          <Button
            label={hasLibrary ? 'Start search' : 'Choose library first'}
            onPress={hasLibrary ? onStartSearch : onPickLibrary}
            variant="secondary"
          />
        }
      />

      <SectionCard
        title="2) Connect your account"
        body={formatAccountStatus(status)}
        meta={identity ? `${identity.username ? `${identity.username} · ` : ''}${identity.providerTitle}` : undefined}
        muted={!hasLibrary}
        footer={
          <Button
            label={hasLibrary ? 'Open account' : 'Choose library first'}
            onPress={hasLibrary ? onOpenAccount : onPickLibrary}
            variant="secondary"
          />
        }
      />

      <SectionCard title="3) Set reminders" body="Manage your local reminder schedule." muted={!hasLibrary}>
        <Inline>
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
        </Inline>
      </SectionCard>
    </ScreenLayout>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    heroCard: {
      backgroundColor: palette.surface,
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.text,
    },
    heroBody: {
      fontSize: 15,
      lineHeight: 22,
      color: palette.textSubtle,
    },
  });
