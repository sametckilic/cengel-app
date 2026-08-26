import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  ReduceMotion,
} from 'react-native-reanimated';

import { fonts, layout, palette, spacing } from '@/constants/design';
import {
  getPuzzleClueArrowSymbol,
  type PuzzleClueSummary,
} from '@cengel/puzzle-core/puzzle';

const SUPPORTED_INPUT_CHARACTER = /^[A-Za-zÇĞİÖŞÜçğıöşü]$/;

export type SystemPuzzleInputHandle = {
  close(): void;
  open(): void;
};

export type KeyboardCheckStatus =
  | 'correct'
  | 'idle'
  | 'incomplete'
  | 'incorrect'
  | 'revealed';

export type SystemKeyboardMetrics = {
  height: number;
  screenY: number;
  visible: boolean;
};

type SystemPuzzleInputProps = {
  answerPattern: readonly (string | undefined)[];
  checkStatus?: KeyboardCheckStatus;
  lockedAnswerPattern: readonly (string | undefined)[];
  onBackspacePress: () => void;
  onCheckPress?: () => void;
  onHintPress?: () => void;
  onKeyboardCloseRequest?: () => void;
  onLetterPress: (letter: string) => void;
  onKeyboardMetricsChange?: (metrics: SystemKeyboardMetrics) => void;
  primaryClue: PuzzleClueSummary;
};

const CHECK_PRESENTATIONS = {
  correct: { icon: 'check-circle', label: 'Doğru' },
  idle: { icon: 'check', label: 'Onayla' },
  incomplete: { icon: 'error-outline', label: 'Eksik' },
  incorrect: { icon: 'close', label: 'Yanlış' },
  revealed: { icon: 'visibility', label: 'Açıldı' },
} as const;

function getClueLabel(clue: PuzzleClueSummary) {
  return `${getPuzzleClueArrowSymbol(clue)} ${clue.label}`;
}

export const SystemPuzzleInput = forwardRef<
  SystemPuzzleInputHandle,
  SystemPuzzleInputProps
>(function SystemPuzzleInput(
  {
    answerPattern,
    checkStatus = 'idle',
    lockedAnswerPattern,
    onBackspacePress,
    onCheckPress,
    onHintPress,
    onKeyboardCloseRequest,
    onLetterPress,
    onKeyboardMetricsChange,
    primaryClue,
  },
  forwardedRef,
) {
  const inputRef = useRef<TextInput>(null);
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardScreenY, setKeyboardScreenY] = useState(windowHeight);
  const checkPresentation = CHECK_PRESENTATIONS[checkStatus];

  const updateKeyboardVisibility = useCallback(
    (visible: boolean, event?: KeyboardEvent) => {
      if (event) {
        Keyboard.scheduleLayoutAnimation(event);
      }

      const height = visible ? (event?.endCoordinates.height ?? 0) : 0;
      const screenY = visible
        ? (event?.endCoordinates.screenY ?? windowHeight)
        : windowHeight;

      setKeyboardVisible(visible);
      setKeyboardScreenY(screenY);
      onKeyboardMetricsChange?.({ height, screenY, visible });
    },
    [onKeyboardMetricsChange, windowHeight],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      updateKeyboardVisibility(true, event);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, (event) => {
      updateKeyboardVisibility(false, event);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [updateKeyboardVisibility]);

  const closeKeyboard = useCallback(() => {
    onKeyboardCloseRequest?.();
    Keyboard.dismiss();
  }, [onKeyboardCloseRequest]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      close() {
        closeKeyboard();
      },
      open() {
        inputRef.current?.focus();
      },
    }),
    [closeKeyboard],
  );

  const handleTextChange = (text: string) => {
    for (const character of [...text]) {
      if (SUPPORTED_INPUT_CHARACTER.test(character)) {
        onLetterPress(character);
      }
    }
  };

  return (
    <>
      <TextInput
        ref={inputRef}
        accessibilityLabel="Bulmaca harf girişi"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect={false}
        caretHidden
        contextMenuHidden
        onBlur={() => {
          onKeyboardCloseRequest?.();

          if (Platform.OS === 'web') {
            updateKeyboardVisibility(false);
          }
        }}
        onChangeText={handleTextChange}
        onFocus={() => {
          if (Platform.OS === 'web') {
            updateKeyboardVisibility(true);
          }
        }}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === 'Backspace') {
            onBackspacePress();
          }
        }}
        showSoftInputOnFocus
        spellCheck={false}
        style={styles.hiddenInput}
        value=""
      />

      {keyboardVisible ? (
        <Animated.View
          accessibilityRole="toolbar"
          entering={FadeInDown.duration(160).reduceMotion(ReduceMotion.System)}
          exiting={FadeOutDown.duration(110).reduceMotion(ReduceMotion.System)}
          style={[
            styles.dock,
            { bottom: Math.max(0, windowHeight - keyboardScreenY) },
          ]}>
          <View style={styles.controlBar}>
            <View style={styles.clueSummary}>
              <Text numberOfLines={2} style={styles.clueText}>
                {getClueLabel(primaryClue)}
              </Text>
              <View
                accessibilityLabel={`${answerPattern.length} harfli cevap kalıbı, ${answerPattern.filter(Boolean).length} harf dolu`}
                style={styles.answerPattern}>
                {answerPattern.map((letter, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.answerPatternCharacter,
                      letter && styles.filledPatternCharacter,
                      lockedAnswerPattern[index] && styles.lockedPatternCharacter,
                    ]}>
                    {letter ?? '_'}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Klavye kapat"
                accessibilityRole="button"
                onPress={closeKeyboard}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressedButton]}>
                <MaterialIcons color={palette.ink} name="keyboard-hide" size={18} />
                <Text style={styles.actionLabel}>Kapat</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={onHintPress ? 'İpucu' : 'İpucu kullanılamıyor'}
                accessibilityRole="button"
                accessibilityState={{ disabled: !onHintPress }}
                disabled={!onHintPress}
                onPress={onHintPress}
                style={({ pressed }) => [
                  styles.actionButton,
                  !onHintPress && styles.disabledControl,
                  pressed && styles.pressedButton,
                ]}>
                <MaterialCommunityIcons
                  color={palette.ink}
                  name="lightbulb-outline"
                  size={18}
                />
                <Text style={styles.actionLabel}>İpucu</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={checkPresentation.label}
                accessibilityRole="button"
                disabled={!onCheckPress}
                onPress={onCheckPress}
                style={({ pressed }) => [
                  styles.actionButton,
                  checkStatus === 'correct' && styles.correctButton,
                  checkStatus === 'incomplete' && styles.incompleteButton,
                  checkStatus === 'incorrect' && styles.incorrectButton,
                  checkStatus === 'revealed' && styles.revealedButton,
                  !onCheckPress && styles.disabledControl,
                  pressed && styles.pressedButton,
                ]}>
                <MaterialIcons
                  color={checkStatus === 'incorrect' ? palette.onErrorContainer : palette.ink}
                  name={checkPresentation.icon}
                  size={18}
                />
                <Text
                  style={[
                    styles.actionLabel,
                    checkStatus === 'incorrect' && styles.incorrectLabel,
                  ]}>
                  {checkPresentation.label}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  hiddenInput: {
    height: 2,
    left: -20,
    opacity: 0,
    position: 'absolute',
    top: -20,
    width: 2,
  },
  dock: {
    backgroundColor: 'rgba(229, 226, 225, 0.97)',
    borderTopColor: palette.gridLine,
    borderTopWidth: 1,
    left: 0,
    padding: spacing.tight,
    position: 'absolute',
    right: 0,
    zIndex: 40,
  },
  controlBar: {
    alignItems: 'stretch',
    alignSelf: 'center',
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    maxWidth: layout.maxDetail,
    minHeight: 72,
    padding: spacing.tight,
    width: '100%',
  },
  clueSummary: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
  },
  clueText: {
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 15,
  },
  answerPattern: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  answerPatternCharacter: {
    color: palette.mutedInk,
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    includeFontPadding: false,
    lineHeight: 16,
    minWidth: 10,
    textAlign: 'center',
  },
  filledPatternCharacter: {
    color: palette.secondary,
  },
  lockedPatternCharacter: {
    color: palette.ink,
    fontFamily: fonts.interBold,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginLeft: spacing.tight,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: palette.surfaceLow,
    borderColor: palette.gridLine,
    borderRadius: 4,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 44,
  },
  actionLabel: {
    color: palette.ink,
    fontFamily: fonts.interMedium,
    fontSize: 8,
    lineHeight: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  correctButton: {
    backgroundColor: palette.selectionBlue,
    borderColor: palette.secondary,
  },
  incompleteButton: {
    backgroundColor: palette.surfaceHigh,
    borderColor: palette.outline,
  },
  incorrectButton: {
    backgroundColor: palette.errorContainer,
    borderColor: palette.error,
  },
  revealedButton: {
    backgroundColor: palette.secondaryContainer,
    borderColor: palette.secondary,
  },
  incorrectLabel: {
    color: palette.onErrorContainer,
  },
  disabledControl: {
    opacity: 0.48,
  },
  pressedButton: {
    backgroundColor: palette.surfaceHigh,
  },
});
