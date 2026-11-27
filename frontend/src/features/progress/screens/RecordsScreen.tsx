import { useNavigation, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { openHistoryPage } from '@/features/navigation/openHistoryPage';
import { exerciseName, useExerciseCatalog } from '@/features/workout/exercises';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { Screen } from '@/shared/ui/Screen';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';

import { RecordCard, RecordsNote } from '../components/cards';
import { useRecordsList } from '../data';
import { ProgressTabs } from './ProgressScreen';

/**
 * Records (design: Progress / Records): every current personal best, newest first, each
 * opening the session that set it in History; beside them how records are earned and how many
 * are new this week. Offline it shows what was saved on the device.
 */
export function RecordsScreen() {
  const { t } = useTranslation();
  const { space } = useTheme();
  const pathname = usePathname();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const catalog = useExerciseCatalog();
  const records = useRecordsList();

  let list;
  if (records.items === undefined && records.query.isPending) {
    list = <SkeletonCard label={t('progress.records.loading')} rows={3} />;
  } else if (records.items === undefined) {
    list = (
      <ErrorCard
        title={t('progress.records.errorTitle')}
        message={t('progress.loadError')}
        retryLabel={t('progress.retry')}
        onRetry={() => void records.query.refetch()}
      />
    );
  } else if (records.items.length === 0) {
    list = (
      <Card style={{ padding: space[24] }}>
        <Text variant="small" tone="muted">
          {t('progress.records.empty')}
        </Text>
      </Card>
    );
  } else {
    list = (
      <>
        {records.items.map((record) => (
          <RecordCard
            key={`${record.exercise_id}-${record.record_type}`}
            record={record}
            name={exerciseName(catalog.byId.get(record.exercise_id), t)}
            onOpen={() => openHistoryPage(`/history/${record.session_id}`, pathname, () => navigation.navigate('history'))}
          />
        ))}
        {records.query.hasNextPage ? (
          <Button
            label={records.query.isFetchingNextPage ? t('history.week.loadingMore') : t('history.week.more')}
            variant="ghost"
            onPress={() => void records.query.fetchNextPage()}
          />
        ) : null}
      </>
    );
  }

  return (
    <Screen title={t('progress.records.title')} caption={t('progress.caption')}>
      <View style={{ gap: space[24] }}>
        <ProgressTabs value="records" />
        <Columns tablet main={list} side={<RecordsNote newThisWeek={records.newThisWeek} />} />
      </View>
    </Screen>
  );
}
