import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NewspaperPuzzleScreen } from '@/app/newspaper-preview';
import { EditorialHeader } from '@/components/cengel/editorial-header';
import { fonts, palette, spacing, typography } from '@/constants/design';
import { PUZZLE_CATALOG } from '@/data/puzzle-catalog';
import { usePuzzleCatalog } from '@/providers/puzzle-catalog-provider';

export function generateStaticParams() {
  return PUZZLE_CATALOG.map(({ id }) => ({ id }));
}

function PuzzleNotFound({ puzzleId }: { puzzleId?: string }) {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <EditorialHeader
        fullWidth
        leftIcon="arrow-back"
        leftLabel="Geri"
        onLeftPress={() => router.replace('/')}
        title="Bulmaca Bulunamadı"
      />
      <View style={styles.notFoundContent}>
        <Text style={styles.notFoundTitle}>Bu bulmaca mevcut değil.</Text>
        <Text style={styles.notFoundDescription}>
          {puzzleId
            ? `“${puzzleId}” kimliğine ait bir bulmaca bulunamadı.`
            : 'Bulmaca kimliği eksik.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={({ pressed }) => [
            styles.notFoundButton,
            pressed && styles.notFoundButtonPressed,
          ]}>
          <Text style={styles.notFoundButtonLabel}>Ana Sayfaya Dön</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function PuzzleRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { getPuzzleById, loading } = usePuzzleCatalog();
  const puzzleId = Array.isArray(id) ? id[0] : id;
  const puzzle = puzzleId ? getPuzzleById(puzzleId) : undefined;

  if (!puzzle && loading) {
    return <View style={styles.screen} />;
  }

  if (!puzzle) {
    return <PuzzleNotFound puzzleId={puzzleId} />;
  }

  return <NewspaperPuzzleScreen key={puzzle.id} puzzle={puzzle} />;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  notFoundContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.page,
  },
  notFoundTitle: {
    ...typography.headlineMd,
    color: palette.ink,
    textAlign: 'center',
  },
  notFoundDescription: {
    ...typography.bodyClue,
    color: palette.onSurfaceVariant,
    marginTop: spacing.tight,
    textAlign: 'center',
  },
  notFoundButton: {
    backgroundColor: palette.primary,
    marginTop: spacing.page,
    paddingHorizontal: spacing.page,
    paddingVertical: 14,
  },
  notFoundButtonPressed: {
    opacity: 0.8,
  },
  notFoundButtonLabel: {
    color: palette.onPrimary,
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
});
