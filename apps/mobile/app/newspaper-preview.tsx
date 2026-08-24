import { Redirect, Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorialHeader } from '@/components/cengel/editorial-header';
import { NewspaperPreviewGrid } from '@/components/cengel/newspaper-preview-grid';
import { PuzzleCompletionPanel } from '@/components/cengel/puzzle-completion-panel';
import {
  SystemPuzzleInput,
  type SystemKeyboardMetrics,
  type SystemPuzzleInputHandle,
  type KeyboardCheckStatus,
} from '@/components/cengel/system-puzzle-input';
import { layout, palette, spacing } from '@/constants/design';
import {
  getDifficultyLabel,
  getPuzzleHref,
  getPuzzleCategoryLabel,
  getPuzzleSizeLabel,
} from '@/data/puzzle-catalog';
import { NEWSPAPER_PROTOTYPE } from '@/data/newspaper-prototype';
import { prototypeAnswerRevealAccessProvider } from '@cengel/puzzle-core/hint-access';
import {
  createPuzzleProgressSnapshot,
  restorePuzzleProgress,
} from '@cengel/puzzle-core/puzzle-progress';
import { puzzleProgressStore } from '@/services/puzzle-progress-store';
import { revealPuzzleWord } from '@cengel/puzzle-core/puzzle-hint';
import {
  backspacePuzzleEntry,
  beginPuzzleWordEntry,
  clearPuzzleWordEntry,
  enterPuzzleLetter,
  type PuzzleInputState,
} from '@cengel/puzzle-core/puzzle-input';
import {
  createInitialPuzzleSelection,
  getSelectedWord,
  selectPuzzleCell,
} from '@cengel/puzzle-core/puzzle-selection';
import {
  getLockedCellIndices,
  getLockedWordPattern,
  isPuzzleComplete,
  validateSelectedWord,
} from '@cengel/puzzle-core/puzzle-validation';
import type { PuzzleDefinition } from '@cengel/puzzle-core/puzzle';

type NewspaperPuzzleScreenProps = {
  puzzle?: PuzzleDefinition;
};

const KEYBOARD_SCROLL_RESTORE_DURATION = 320;

export function NewspaperPuzzleScreen({
  puzzle = NEWSPAPER_PROTOTYPE,
}: NewspaperPuzzleScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [inputState, setInputState] = useState<PuzzleInputState>(() => ({
    entries: {},
    selection: createInitialPuzzleSelection(puzzle),
  }));
  const [keyboardMetrics, setKeyboardMetrics] = useState<SystemKeyboardMetrics>({
    height: 0,
    screenY: windowHeight,
    visible: false,
  });
  const [zoomOverflowY, setZoomOverflowY] = useState(0);
  const [keyboardScrollSpace, setKeyboardScrollSpace] = useState(0);
  const [checkStatus, setCheckStatus] = useState<KeyboardCheckStatus>('idle');
  const [completionPending, setCompletionPending] = useState(false);
  const [completionPersisted, setCompletionPersisted] = useState(false);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [completionWaitsForKeyboard, setCompletionWaitsForKeyboard] = useState(false);
  const [hintPending, setHintPending] = useState(false);
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [progressPersistenceAvailable, setProgressPersistenceAvailable] = useState(true);
  const storageFailureAnnounced = useRef(false);
  const keyboardVisibleRef = useRef(false);
  const preKeyboardScrollOffsetY = useRef(0);
  const scrollRestoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardSpaceReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswerClearWordIds = useRef(new Set<string>());
  const progressSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const restartWordOnNextLetter = useRef(false);
  const scrollOffsetY = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const systemInputRef = useRef<SystemPuzzleInputHandle>(null);
  const [revealedWordIds, setRevealedWordIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [solvedWordIds, setSolvedWordIds] = useState<ReadonlySet<string>>(() => new Set());
  const solvedWordIdsRef = useRef(solvedWordIds);
  const activeWord = getSelectedWord(puzzle, inputState.selection);
  const lockedCellIndices = useMemo(
    () => getLockedCellIndices(puzzle, solvedWordIds),
    [puzzle, solvedWordIds],
  );
  const answerPattern = activeWord.cellIndices.map(
    (cellIndex) => inputState.entries[cellIndex],
  );
  const lockedAnswerPattern = getLockedWordPattern(
    activeWord,
    inputState.entries,
    lockedCellIndices,
  );
  const progressLabel =
    solvedWordIds.size === puzzle.words.length
      ? 'Tamamlandı'
      : `${solvedWordIds.size}/${puzzle.words.length} kelime`;
  const puzzleViewportTop = insets.top + 72 + spacing.tight;
  useEffect(() => {
    let active = true;

    void puzzleProgressStore
      .load(puzzle.id)
      .then((progress) => {
        if (!active || !progress) {
          return;
        }

        const restored = restorePuzzleProgress(puzzle, progress);

        if (!restored) {
          return;
        }

        setInputState({
          entries: restored.entries,
          selection: restored.selection,
        });
        setRevealedWordIds(restored.revealedWordIds);
        solvedWordIdsRef.current = restored.solvedWordIds;
        setSolvedWordIds(restored.solvedWordIds);
      })
      .catch(() => {
        setProgressPersistenceAvailable(false);

        if (!storageFailureAnnounced.current) {
          storageFailureAnnounced.current = true;
          AccessibilityInfo.announceForAccessibility(
            'Kayıtlı bulmaca ilerlemesi yüklenemedi.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setProgressHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, [puzzle]);
  useEffect(() => {
    if (!progressHydrated || !progressPersistenceAvailable) {
      return;
    }

    let active = true;

    const progress = createPuzzleProgressSnapshot(puzzle.id, {
      entries: inputState.entries,
      revealedWordIds,
      selection: inputState.selection,
      solvedWordIds,
    });
    const savesCompletedPuzzle = isPuzzleComplete(puzzle, solvedWordIds);
    const savePromise = progressSaveQueue.current
      .catch(() => undefined)
      .then(() => puzzleProgressStore.save(progress));

    progressSaveQueue.current = savePromise;

    void savePromise.then(() => {
      if (active && savesCompletedPuzzle) {
        setCompletionPersisted(true);
      }
    }).catch(() => {
      if (!active) {
        return;
      }

      setProgressPersistenceAvailable(false);

      if (!storageFailureAnnounced.current) {
        storageFailureAnnounced.current = true;
        AccessibilityInfo.announceForAccessibility(
          'Bulmaca ilerlemesi şu anda kaydedilemiyor.',
        );
      }
    });

    return () => {
      active = false;
    };
  }, [
    inputState,
    progressHydrated,
    progressPersistenceAvailable,
    puzzle,
    revealedWordIds,
    solvedWordIds,
  ]);
  const beginPuzzleCompletion = useCallback(() => {
    setCompletionPersisted(false);
    setCompletionWaitsForKeyboard(keyboardVisibleRef.current);
    setCompletionPending(true);
    systemInputRef.current?.close();
  }, []);
  useEffect(() => {
    if (
      !completionPending ||
      completionVisible ||
      keyboardMetrics.visible ||
      (!completionPersisted && progressPersistenceAvailable)
    ) {
      return;
    }

    completionRevealTimer.current = setTimeout(
      () => {
        setCompletionPending(false);
        setCompletionVisible(true);
        AccessibilityInfo.announceForAccessibility('Bulmaca tamamlandı. Tebrikler!');
        completionRevealTimer.current = null;
      },
      completionWaitsForKeyboard ? KEYBOARD_SCROLL_RESTORE_DURATION : 0,
    );

    return () => {
      if (completionRevealTimer.current) {
        clearTimeout(completionRevealTimer.current);
        completionRevealTimer.current = null;
      }
    };
  }, [
    completionPending,
    completionPersisted,
    completionVisible,
    completionWaitsForKeyboard,
    keyboardMetrics.visible,
    progressPersistenceAvailable,
  ]);
  const handleLetterCellPress = useCallback(
    (cellIndex: number) => {
      if (!progressHydrated) {
        return;
      }

      if (!keyboardVisibleRef.current) {
        preKeyboardScrollOffsetY.current = scrollOffsetY.current;
      }

      setInputState((currentState) => ({
        ...currentState,
        selection: selectPuzzleCell(puzzle, currentState.selection, cellIndex),
      }));
      restartWordOnNextLetter.current = true;
      setCheckStatus('idle');
      systemInputRef.current?.open();
    },
    [progressHydrated, puzzle],
  );
  const handleActiveCellPositionChange = useCallback(
    (cellCenterY: number, cellBottomY: number) => {
      if (!keyboardMetrics.visible || keyboardMetrics.height === 0) {
        return;
      }

      const topBoundary = puzzleViewportTop;
      const bottomBoundary = Math.max(
        topBoundary + 80,
        keyboardMetrics.screenY - 88,
      );

      if (cellBottomY <= bottomBoundary - spacing.tight) {
        return;
      }

      const targetCenterY = (topBoundary + bottomBoundary) / 2;
      const nextOffsetY = Math.max(
        0,
        scrollOffsetY.current + cellCenterY - targetCenterY,
      );

      scrollViewRef.current?.scrollTo({ animated: true, y: nextOffsetY });
    },
    [keyboardMetrics, puzzleViewportTop],
  );
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetY.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );
  const handleKeyboardMetricsChange = useCallback(
    (metrics: SystemKeyboardMetrics) => {
      const wasVisible = keyboardVisibleRef.current;

      keyboardVisibleRef.current = metrics.visible;
      setKeyboardMetrics(metrics);

      if (metrics.visible) {
        if (keyboardSpaceReleaseTimer.current) {
          clearTimeout(keyboardSpaceReleaseTimer.current);
          keyboardSpaceReleaseTimer.current = null;
        }

        const keyboardOverlap = Math.max(0, windowHeight - metrics.screenY);
        setKeyboardScrollSpace(
          Math.max(0, keyboardOverlap + 96 - puzzleViewportTop),
        );
      }

      if (wasVisible && !metrics.visible) {
        const wordIdsToClear = [...pendingAnswerClearWordIds.current];
        pendingAnswerClearWordIds.current.clear();

        if (wordIdsToClear.length > 0) {
          const currentLockedCellIndices = getLockedCellIndices(
            puzzle,
            solvedWordIdsRef.current,
          );

          setInputState((currentState) =>
            wordIdsToClear.reduce(
              (nextState, wordId) =>
                clearPuzzleWordEntry(
                  puzzle,
                  nextState,
                  currentLockedCellIndices,
                  wordId,
                ),
              currentState,
            ),
          );
        }

        if (scrollRestoreTimer.current) {
          clearTimeout(scrollRestoreTimer.current);
        }

        if (keyboardSpaceReleaseTimer.current) {
          clearTimeout(keyboardSpaceReleaseTimer.current);
        }

        scrollRestoreTimer.current = setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            animated: true,
            y: preKeyboardScrollOffsetY.current,
          });
          scrollRestoreTimer.current = null;
        }, 0);

        keyboardSpaceReleaseTimer.current = setTimeout(() => {
          setKeyboardScrollSpace(0);
          keyboardSpaceReleaseTimer.current = null;
        }, KEYBOARD_SCROLL_RESTORE_DURATION);
      }
    },
    [puzzle, puzzleViewportTop, windowHeight],
  );
  useEffect(
    () => () => {
      if (scrollRestoreTimer.current) {
        clearTimeout(scrollRestoreTimer.current);
      }
      if (keyboardSpaceReleaseTimer.current) {
        clearTimeout(keyboardSpaceReleaseTimer.current);
      }
      if (completionRevealTimer.current) {
        clearTimeout(completionRevealTimer.current);
      }
    },
    [],
  );
  const handleCheckPress = useCallback(() => {
    if (!progressHydrated) {
      return;
    }

    const result = validateSelectedWord(puzzle, inputState.entries, inputState.selection);
    setCheckStatus(result.status);

    if (result.status === 'correct') {
      const wasAlreadySolved = solvedWordIds.has(result.wordId);
      const nextSolvedWordIds = new Set(solvedWordIds).add(result.wordId);

      pendingAnswerClearWordIds.current.delete(result.wordId);
      solvedWordIdsRef.current = nextSolvedWordIds;
      setSolvedWordIds(nextSolvedWordIds);
      systemInputRef.current?.close();

      if (!wasAlreadySolved && isPuzzleComplete(puzzle, nextSolvedWordIds)) {
        beginPuzzleCompletion();
      }
    } else {
      pendingAnswerClearWordIds.current.add(result.wordId);
    }

    const announcement = {
      correct: 'Doğru cevap. Kelime kilitlendi.',
      incomplete: 'Kelime eksik. Önce tüm harfleri doldur.',
      incorrect: 'Cevap yanlış. Tekrar deneyebilirsin.',
    }[result.status];
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [
    beginPuzzleCompletion,
    inputState.entries,
    inputState.selection,
    progressHydrated,
    puzzle,
    solvedWordIds,
  ]);
  const handleHintPress = useCallback(async () => {
    const requestedWordId = activeWord.id;

    if (!progressHydrated || solvedWordIds.has(requestedWordId) || hintPending) {
      return;
    }

    setHintPending(true);

    try {
      const access = await prototypeAnswerRevealAccessProvider.requestAccess({
        puzzleId: puzzle.id,
        wordId: requestedWordId,
      });

      if (!access.granted) {
        AccessibilityInfo.announceForAccessibility(
          'İpucu açılamadı. Daha sonra tekrar deneyebilirsin.',
        );
        return;
      }

      setInputState((currentState) =>
        revealPuzzleWord(puzzle, currentState, requestedWordId).inputState,
      );
      const nextSolvedWordIds = new Set(solvedWordIds).add(requestedWordId);

      pendingAnswerClearWordIds.current.delete(requestedWordId);
      solvedWordIdsRef.current = nextSolvedWordIds;
      setSolvedWordIds(nextSolvedWordIds);
      setRevealedWordIds((currentIds) => new Set(currentIds).add(requestedWordId));
      setCheckStatus('idle');

      if (isPuzzleComplete(puzzle, nextSolvedWordIds)) {
        beginPuzzleCompletion();
      }
      AccessibilityInfo.announceForAccessibility(
        'İpucu kullanıldı. Cevap açıldı ve kelime kilitlendi.',
      );
    } catch {
      AccessibilityInfo.announceForAccessibility(
        'İpucu şu anda kullanılamıyor. Daha sonra tekrar deneyebilirsin.',
      );
    } finally {
      setHintPending(false);
    }
  }, [
    activeWord.id,
    beginPuzzleCompletion,
    hintPending,
    progressHydrated,
    puzzle,
    solvedWordIds,
  ]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: puzzle.title }} />
      <EditorialHeader
        bleedLeftAction
        floating
        leftIcon="arrow-back"
        leftLabel="Geri"
        onLeftPress={() => router.back()}
        subtitle={`${getDifficultyLabel(puzzle.difficulty)} · ${getPuzzleCategoryLabel(puzzle)} · ${progressLabel}`}
        title={`${getPuzzleSizeLabel(puzzle)} Çengel Bulmaca`}
        translucent
      />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              puzzleViewportTop + keyboardScrollSpace + zoomOverflowY,
            paddingTop: puzzleViewportTop + zoomOverflowY,
          },
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEnabled={false}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.content,
            { minHeight: Math.max(0, windowHeight - puzzleViewportTop * 2) },
          ]}>
          <NewspaperPreviewGrid
            activeCellIndex={inputState.selection.cellIndex}
            activeWordId={inputState.selection.wordId}
            centerActiveCell={keyboardMetrics.visible}
            centerRequestKey={keyboardMetrics.screenY}
            entries={inputState.entries}
            lockedCellIndices={lockedCellIndices}
            onActiveCellPositionChange={handleActiveCellPositionChange}
            onLetterCellPress={handleLetterCellPress}
            onZoomOverflowChange={setZoomOverflowY}
            puzzle={puzzle}
          />
        </View>
      </ScrollView>

      <SystemPuzzleInput
        ref={systemInputRef}
        answerPattern={answerPattern}
        checkStatus={
          revealedWordIds.has(activeWord.id)
            ? 'revealed'
            : solvedWordIds.has(activeWord.id)
              ? 'correct'
              : checkStatus
        }
        onBackspacePress={() => {
          if (!progressHydrated) {
            return;
          }

          setCheckStatus('idle');
          setInputState((currentState) =>
            backspacePuzzleEntry(puzzle, currentState, lockedCellIndices),
          )
        }}
        onCheckPress={handleCheckPress}
        onHintPress={
          !solvedWordIds.has(activeWord.id) && !hintPending
            ? () => void handleHintPress()
            : undefined
        }
        lockedAnswerPattern={lockedAnswerPattern}
        onKeyboardMetricsChange={handleKeyboardMetricsChange}
        onLetterPress={(letter) => {
          if (!progressHydrated) {
            return;
          }

          const shouldRestartWord = restartWordOnNextLetter.current;
          restartWordOnNextLetter.current = false;
          setCheckStatus('idle');
          setInputState((currentState) => {
            const entryState = shouldRestartWord
              ? beginPuzzleWordEntry(puzzle, currentState, lockedCellIndices)
              : currentState;

            return enterPuzzleLetter(puzzle, entryState, letter, lockedCellIndices);
          });
        }}
        primaryClue={{ direction: activeWord.direction, label: activeWord.clue }}
      />

      {completionVisible ? (
        <PuzzleCompletionPanel
          onDismiss={() => setCompletionVisible(false)}
          onHomePress={() => router.replace('/')}
          revealedWordCount={revealedWordIds.size}
          wordCount={puzzle.words.length}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function NewspaperPreviewScreen() {
  return <Redirect href={getPuzzleHref(NEWSPAPER_PROTOTYPE.id)} />;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    alignSelf: 'center',
    justifyContent: 'center',
    maxWidth: layout.maxContent,
    paddingHorizontal: spacing.tight,
    width: '100%',
  },
});
