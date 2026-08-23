import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fonts, layout, palette, spacing, typography } from '@/constants/design';
import { useKeyboardFeedback } from '@/hooks/use-keyboard-feedback';
import type { PuzzleClueSummary } from '@cengel/puzzle-core/puzzle';

const KEY_HEIGHT = 48;
const KEY_GAP = 4;
const ROW_GAP = 12;

type LetterKey = {
  type: 'letter';
  label: string;
};

type IconKey = {
  type: 'icon';
  icon: 'backspace' | 'keyboard-capslock';
  label: string;
};

type KeyboardKey = LetterKey | IconKey;
type PreviewAlignment = 'center' | 'left' | 'right';

const KEYBOARD_ROWS = [
  [
    { type: 'letter', label: 'Q' },
    { type: 'letter', label: 'W' },
    { type: 'letter', label: 'E' },
    { type: 'letter', label: 'R' },
    { type: 'letter', label: 'T' },
    { type: 'letter', label: 'Y' },
    { type: 'letter', label: 'U' },
    { type: 'letter', label: 'I' },
    { type: 'letter', label: 'O' },
    { type: 'letter', label: 'P' },
    { type: 'letter', label: 'Ğ' },
    { type: 'letter', label: 'Ü' },
  ],
  [
    { type: 'letter', label: 'A' },
    { type: 'letter', label: 'S' },
    { type: 'letter', label: 'D' },
    { type: 'letter', label: 'F' },
    { type: 'letter', label: 'G' },
    { type: 'letter', label: 'H' },
    { type: 'letter', label: 'J' },
    { type: 'letter', label: 'K' },
    { type: 'letter', label: 'L' },
    { type: 'letter', label: 'Ş' },
    { type: 'letter', label: 'İ' },
  ],
  [
    { type: 'icon', icon: 'keyboard-capslock', label: 'Büyük ve küçük harf' },
    { type: 'letter', label: 'Z' },
    { type: 'letter', label: 'X' },
    { type: 'letter', label: 'C' },
    { type: 'letter', label: 'V' },
    { type: 'letter', label: 'B' },
    { type: 'letter', label: 'N' },
    { type: 'letter', label: 'M' },
    { type: 'letter', label: 'Ö' },
    { type: 'letter', label: 'Ç' },
    { type: 'icon', icon: 'backspace', label: 'Sil' },
  ],
] as const satisfies readonly (readonly KeyboardKey[])[];

function getAccessibleLetterLabel(letter: string) {
  if (letter === 'I' || letter === 'ı') {
    return `${letter}, noktasız I`;
  }

  if (letter === 'İ' || letter === 'i') {
    return `${letter}, noktalı İ`;
  }

  if (letter === 'Ğ' || letter === 'ğ') {
    return `${letter}, yumuşak G`;
  }

  return letter;
}

type KeyboardKeyViewProps = {
  isUppercase: boolean;
  keyboardKey: KeyboardKey;
  onBackspacePress: () => void;
  onCapsPress: () => void;
  onFeedback: () => void;
  onLetterPress: (letter: string) => void;
  previewAlignment: PreviewAlignment;
};

function KeyboardKeyView({
  isUppercase,
  keyboardKey,
  onBackspacePress,
  onCapsPress,
  onFeedback,
  onLetterPress,
  previewAlignment,
}: KeyboardKeyViewProps) {
  const [isPressed, setIsPressed] = useState(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyScale = useSharedValue(1);
  const previewOpacity = useSharedValue(0);
  const previewScale = useSharedValue(0.86);
  const previewTranslateY = useSharedValue(5);
  const isSpecial = keyboardKey.type === 'icon';
  const displayLabel =
    keyboardKey.type === 'letter'
      ? isUppercase
        ? keyboardKey.label
        : keyboardKey.label.toLocaleLowerCase('tr-TR')
      : '';

  const keyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: keyScale.value }],
  }));
  const previewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: previewOpacity.value,
    transform: [
      { translateY: previewTranslateY.value },
      { scale: previewScale.value },
    ],
  }));

  useEffect(
    () => () => {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
    },
    [],
  );

  const handlePressIn = () => {
    if (releaseTimer.current) {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }

    setIsPressed(true);
    onFeedback();
    keyScale.value = withSpring(1.045, {
      damping: 16,
      mass: 0.32,
      reduceMotion: ReduceMotion.System,
      stiffness: 380,
    });

    if (!isSpecial) {
      previewOpacity.value = withTiming(1, {
        duration: 55,
        reduceMotion: ReduceMotion.System,
      });
      previewScale.value = withSpring(1, {
        damping: 17,
        mass: 0.3,
        reduceMotion: ReduceMotion.System,
        stiffness: 420,
      });
      previewTranslateY.value = withTiming(0, {
        duration: 70,
        reduceMotion: ReduceMotion.System,
      });
    }
  };

  const handlePressOut = () => {
    keyScale.value = withSpring(1, {
      damping: 18,
      mass: 0.32,
      reduceMotion: ReduceMotion.System,
      stiffness: 420,
    });
    previewOpacity.value = withTiming(0, {
      duration: 90,
      reduceMotion: ReduceMotion.System,
    });
    previewScale.value = withTiming(0.88, {
      duration: 90,
      reduceMotion: ReduceMotion.System,
    });
    previewTranslateY.value = withTiming(4, {
      duration: 90,
      reduceMotion: ReduceMotion.System,
    });
    releaseTimer.current = setTimeout(() => {
      setIsPressed(false);
      releaseTimer.current = null;
    }, 100);
  };

  const handlePress = () => {
    if (keyboardKey.type === 'letter') {
      onLetterPress(displayLabel);
      return;
    }

    if (keyboardKey.icon === 'backspace') {
      onBackspacePress();
      return;
    }

    onCapsPress();
  };

  return (
    <Animated.View
      style={[
        styles.keySlot,
        isSpecial ? styles.wideKey : styles.letterKey,
        isPressed && styles.pressedKeySlot,
        keyAnimatedStyle,
      ]}>
      {!isSpecial ? (
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.keyPreview,
            previewAlignment === 'left' && styles.keyPreviewLeft,
            previewAlignment === 'center' && styles.keyPreviewCenter,
            previewAlignment === 'right' && styles.keyPreviewRight,
            previewAnimatedStyle,
          ]}>
          <Text style={styles.keyPreviewLabel}>{displayLabel}</Text>
          <View style={styles.keyPreviewTail} />
        </Animated.View>
      ) : null}

      <Pressable
        android_disableSound
        accessibilityLabel={
          keyboardKey.type === 'letter'
            ? getAccessibleLetterLabel(displayLabel)
            : keyboardKey.label
        }
        accessibilityLanguage="tr-TR"
        accessibilityRole="keyboardkey"
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        pressRetentionOffset={8}
        style={({ pressed }) => [
          styles.key,
          isSpecial && styles.specialKey,
          keyboardKey.type === 'icon' &&
            keyboardKey.icon === 'keyboard-capslock' &&
            isUppercase &&
            styles.capsActive,
          pressed && styles.keyPressed,
        ]}>
        {keyboardKey.type === 'letter' ? (
          <Text style={styles.keyLabel}>{displayLabel}</Text>
        ) : keyboardKey.icon === 'backspace' ? (
          <MaterialCommunityIcons color={palette.ink} name="backspace-outline" size={24} />
        ) : (
          <MaterialIcons color={palette.ink} name={keyboardKey.icon} size={24} />
        )}
      </Pressable>
    </Animated.View>
  );
}

type KeyboardToolbarProps = {
  checkStatus: KeyboardCheckStatus;
  expanded: boolean;
  onCheckPress?: () => void;
  onExpandedChange: (expanded: boolean) => void;
  onFeedback: () => void;
  onHintPress?: () => void;
};

const CHECK_PRESENTATIONS = {
  correct: { icon: 'check-circle', label: 'Doğru' },
  idle: { icon: 'check', label: 'Onayla' },
  incomplete: { icon: 'error-outline', label: 'Eksik' },
  incorrect: { icon: 'close', label: 'Yanlış' },
  revealed: { icon: 'visibility', label: 'Açıldı' },
} as const;

type KeyboardToggleButtonProps = {
  compact?: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onFeedback: () => void;
};

function KeyboardToggleButton({
  compact = false,
  expanded,
  onExpandedChange,
  onFeedback,
}: KeyboardToggleButtonProps) {
  const toggleKeyboard = () => {
    const nextExpanded = !expanded;
    onExpandedChange(nextExpanded);
    AccessibilityInfo.announceForAccessibility(
      nextExpanded ? 'Bulmaca klavyesi açıldı' : 'Bulmaca klavyesi kapatıldı',
    );
  };

  return (
    <Pressable
      android_disableSound
      accessibilityLabel={expanded ? 'Bulmaca klavyesini kapat' : 'Bulmaca klavyesini aç'}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      hitSlop={4}
      onPress={toggleKeyboard}
      onPressIn={onFeedback}
      style={({ pressed }) => [
        compact ? styles.newspaperActionButton : styles.keyboardToggle,
        pressed && styles.toolbarButtonPressed,
      ]}>
      <MaterialIcons
        color={palette.ink}
        name={expanded ? 'keyboard-hide' : 'keyboard'}
        size={compact ? 18 : 22}
      />
      {compact ? <Text style={styles.newspaperActionLabel}>Klavye</Text> : null}
    </Pressable>
  );
}

function KeyboardToolbar({
  checkStatus,
  expanded,
  onCheckPress,
  onExpandedChange,
  onFeedback,
  onHintPress,
}: KeyboardToolbarProps) {
  const checkPresentation = CHECK_PRESENTATIONS[checkStatus];

  return (
    <View accessibilityRole="toolbar" style={styles.toolbar}>
      <View style={styles.toolbarActions}>
        {onCheckPress ? (
          <Pressable
            accessibilityLabel={checkPresentation.label}
            accessibilityRole="button"
            onPress={onCheckPress}
            style={({ pressed }) => [
              styles.hintButton,
              checkStatus === 'correct' && styles.correctCheckButton,
              checkStatus === 'incomplete' && styles.incompleteCheckButton,
              checkStatus === 'incorrect' && styles.incorrectCheckButton,
              checkStatus === 'revealed' && styles.revealedCheckButton,
              pressed && styles.toolbarButtonPressed,
            ]}>
            <MaterialIcons
              color={checkStatus === 'incorrect' ? palette.onErrorContainer : palette.ink}
              name={checkPresentation.icon}
              size={20}
            />
            <Text
              style={[
                styles.hintButtonLabel,
                checkStatus === 'incorrect' && styles.incorrectCheckLabel,
              ]}>
              {checkPresentation.label}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityLabel={onHintPress ? 'İpucu' : 'İpucu kullanılamıyor'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !onHintPress }}
          disabled={!onHintPress}
          onPress={onHintPress}
          style={({ pressed }) => [
            styles.hintButton,
            !onHintPress && styles.disabledControl,
            pressed && styles.toolbarButtonPressed,
          ]}>
          <MaterialCommunityIcons color={palette.ink} name="lightbulb-outline" size={20} />
          <Text style={styles.hintButtonLabel}>İpucu</Text>
        </Pressable>
      </View>

      <KeyboardToggleButton
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        onFeedback={onFeedback}
      />
    </View>
  );
}

type NewspaperControlBarProps = KeyboardToolbarProps & {
  lockedAnswerPattern: readonly (string | undefined)[];
  primaryClue: PuzzleClueSummary;
};

function NewspaperControlBar({
  checkStatus,
  expanded,
  lockedAnswerPattern,
  onCheckPress,
  onExpandedChange,
  onFeedback,
  onHintPress,
  primaryClue,
}: NewspaperControlBarProps) {
  const checkPresentation = CHECK_PRESENTATIONS[checkStatus];

  return (
    <View style={[styles.newspaperControlBar, expanded && styles.controlBarExpanded]}>
      <View style={styles.newspaperClueSummary}>
        <Text numberOfLines={2} style={styles.newspaperClueText}>
          {getClueLabel(primaryClue)}
        </Text>
        <View
          accessibilityLabel={`${lockedAnswerPattern.length} harfli cevap kalıbı`}
          style={styles.answerPattern}>
          {lockedAnswerPattern.map((letter, index) => (
            <Text
              key={index}
              style={[styles.answerPatternCharacter, letter && styles.lockedPatternCharacter]}>
              {letter ?? '_'}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.newspaperActions}>
        <KeyboardToggleButton
          compact
          expanded={expanded}
          onExpandedChange={onExpandedChange}
          onFeedback={onFeedback}
        />
        <Pressable
          accessibilityLabel={onHintPress ? 'İpucu' : 'İpucu kullanılamıyor'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !onHintPress }}
          disabled={!onHintPress}
          onPress={onHintPress}
          style={({ pressed }) => [
            styles.newspaperActionButton,
            !onHintPress && styles.disabledControl,
            pressed && styles.toolbarButtonPressed,
          ]}>
          <MaterialCommunityIcons color={palette.ink} name="lightbulb-outline" size={18} />
          <Text style={styles.newspaperActionLabel}>İpucu</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={checkPresentation.label}
          accessibilityRole="button"
          disabled={!onCheckPress}
          onPress={onCheckPress}
          style={({ pressed }) => [
            styles.newspaperActionButton,
            checkStatus === 'correct' && styles.correctCheckButton,
            checkStatus === 'incomplete' && styles.incompleteCheckButton,
            checkStatus === 'incorrect' && styles.incorrectCheckButton,
            checkStatus === 'revealed' && styles.revealedCheckButton,
            !onCheckPress && styles.disabledControl,
            pressed && styles.toolbarButtonPressed,
          ]}>
          <MaterialIcons
            color={checkStatus === 'incorrect' ? palette.onErrorContainer : palette.ink}
            name={checkPresentation.icon}
            size={18}
          />
          <Text
            style={[
              styles.newspaperActionLabel,
              checkStatus === 'incorrect' && styles.incorrectCheckLabel,
            ]}>
            {checkStatus === 'idle' ? 'Onayla' : checkPresentation.label}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export type KeyboardCheckStatus =
  | 'correct'
  | 'idle'
  | 'incomplete'
  | 'incorrect'
  | 'revealed';

type TurkishKeyboardProps = {
  bottomInset: number;
  checkStatus?: KeyboardCheckStatus;
  expanded: boolean;
  lockedAnswerPattern?: readonly (string | undefined)[];
  onBackspacePress: () => void;
  onCheckPress?: () => void;
  onExpandedChange: (expanded: boolean) => void;
  onHeightChange?: (height: number) => void;
  onHintPress?: () => void;
  onLetterPress: (letter: string) => void;
  primaryClue: PuzzleClueSummary;
  secondaryClue?: PuzzleClueSummary;
};

function getClueLabel(clue: PuzzleClueSummary) {
  const arrow = clue.direction === 'right' ? '→' : '↓';
  return `${arrow} ${clue.label}`;
}

export function TurkishKeyboard({
  bottomInset,
  checkStatus = 'idle',
  expanded,
  lockedAnswerPattern,
  onBackspacePress,
  onCheckPress,
  onExpandedChange,
  onHeightChange,
  onHintPress,
  onLetterPress,
  primaryClue,
  secondaryClue,
}: TurkishKeyboardProps) {
  const [isUppercase, setIsUppercase] = useState(true);
  const triggerFeedback = useKeyboardFeedback();
  const safeBottomPadding = Math.max(bottomInset, spacing.page);

  const handleLayout = (event: LayoutChangeEvent) => {
    onHeightChange?.(event.nativeEvent.layout.height);
  };

  return (
    <View
      onLayout={handleLayout}
      style={[styles.dock, { paddingBottom: safeBottomPadding }]}>
      {lockedAnswerPattern ? (
        <NewspaperControlBar
          checkStatus={checkStatus}
          expanded={expanded}
          lockedAnswerPattern={lockedAnswerPattern}
          onCheckPress={onCheckPress}
          onExpandedChange={onExpandedChange}
          onFeedback={triggerFeedback}
          onHintPress={onHintPress}
          primaryClue={primaryClue}
        />
      ) : (
        <>
          <KeyboardToolbar
            checkStatus={checkStatus}
            expanded={expanded}
            onCheckPress={onCheckPress}
            onExpandedChange={onExpandedChange}
            onFeedback={triggerFeedback}
            onHintPress={onHintPress}
          />

          <View style={[styles.clueBar, expanded && styles.clueBarExpanded]}>
            <View style={[styles.clueHalf, secondaryClue && styles.primaryClueHalf]}>
              <Text numberOfLines={2} style={styles.clueText}>
                {getClueLabel(primaryClue)}
              </Text>
            </View>
            {secondaryClue ? (
              <View style={[styles.clueHalf, styles.secondaryClueHalf]}>
                <Text numberOfLines={2} style={styles.clueText}>
                  {getClueLabel(secondaryClue)}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      )}

      {expanded ? (
        <Animated.View
          entering={FadeIn.duration(110).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(90).reduceMotion(ReduceMotion.System)}
          style={styles.keyboard}>
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={[
                styles.keyboardRow,
                rowIndex === 1 && styles.middleRow,
                rowIndex === 2 && styles.bottomRow,
              ]}>
              {row.map((keyboardKey, keyIndex) => (
                <KeyboardKeyView
                  isUppercase={isUppercase}
                  key={keyboardKey.type === 'letter' ? keyboardKey.label : keyboardKey.icon}
                  keyboardKey={keyboardKey}
                  onBackspacePress={onBackspacePress}
                  onCapsPress={() => setIsUppercase((current) => !current)}
                  onFeedback={triggerFeedback}
                  onLetterPress={onLetterPress}
                  previewAlignment={
                    keyIndex === 0
                      ? 'left'
                      : keyIndex === row.length - 1
                        ? 'right'
                        : 'center'
                  }
                />
              ))}
            </View>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: palette.surfaceHighest,
    borderTopColor: palette.gridLine,
    borderTopWidth: 1,
    bottom: 0,
    boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)',
    left: 0,
    paddingHorizontal: spacing.tight,
    paddingTop: spacing.tight,
    position: 'absolute',
    right: 0,
    zIndex: 30,
  },
  toolbar: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    marginBottom: spacing.tight,
    maxWidth: layout.maxDetail,
    width: '100%',
  },
  toolbarActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.tight,
    height: 48,
  },
  newspaperControlBar: {
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
  controlBarExpanded: {
    marginBottom: spacing.tight,
  },
  newspaperClueSummary: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
  },
  newspaperClueText: {
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
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
    lineHeight: 16,
    minWidth: 10,
    textAlign: 'center',
  },
  lockedPatternCharacter: {
    color: palette.secondary,
    fontFamily: fonts.interBold,
  },
  newspaperActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginLeft: spacing.tight,
  },
  newspaperActionButton: {
    alignItems: 'center',
    backgroundColor: palette.surfaceLow,
    borderColor: palette.gridLine,
    borderRadius: 4,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 44,
  },
  newspaperActionLabel: {
    color: palette.ink,
    fontFamily: fonts.interMedium,
    fontSize: 8,
    lineHeight: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  hintButton: {
    alignItems: 'center',
    borderColor: palette.gridLine,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.tight,
    height: 48,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: 12,
  },
  hintButtonLabel: {
    color: palette.ink,
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  correctCheckButton: {
    backgroundColor: palette.selectionBlue,
    borderColor: palette.secondary,
  },
  incompleteCheckButton: {
    backgroundColor: palette.surfaceHigh,
    borderColor: palette.outline,
  },
  incorrectCheckButton: {
    backgroundColor: palette.errorContainer,
    borderColor: palette.error,
  },
  revealedCheckButton: {
    backgroundColor: palette.secondaryContainer,
    borderColor: palette.secondary,
  },
  incorrectCheckLabel: {
    color: palette.onErrorContainer,
  },
  keyboardToggle: {
    alignItems: 'center',
    borderColor: palette.gridLine,
    borderRadius: 4,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  disabledControl: {
    opacity: 0.48,
  },
  toolbarButtonPressed: {
    backgroundColor: palette.surfaceHigh,
  },
  clueBar: {
    alignItems: 'stretch',
    alignSelf: 'center',
    backgroundColor: palette.primary,
    borderRadius: 4,
    flexDirection: 'row',
    maxWidth: layout.maxDetail,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '100%',
  },
  clueBarExpanded: {
    marginBottom: spacing.tight,
  },
  clueHalf: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  primaryClueHalf: {
    borderRightColor: 'rgba(133, 131, 131, 0.30)',
    borderRightWidth: 1,
  },
  secondaryClueHalf: {
    opacity: 0.6,
  },
  clueText: {
    ...typography.clueBar,
    color: palette.onPrimary,
    textAlign: 'center',
  },
  keyboard: {
    alignSelf: 'center',
    gap: ROW_GAP,
    maxWidth: layout.maxDetail,
    paddingHorizontal: spacing.cell,
    width: '100%',
  },
  keyboardRow: {
    flexDirection: 'row',
    gap: KEY_GAP,
    justifyContent: 'center',
    overflow: 'visible',
  },
  middleRow: {
    paddingHorizontal: 16,
  },
  bottomRow: {
    paddingHorizontal: 16,
  },
  keySlot: {
    height: KEY_HEIGHT,
    minWidth: 0,
    overflow: 'visible',
    position: 'relative',
  },
  pressedKeySlot: {
    zIndex: 100,
  },
  letterKey: {
    flex: 1,
  },
  wideKey: {
    flex: 1.5,
  },
  key: {
    alignItems: 'center',
    backgroundColor: palette.surfaceLowest,
    borderRadius: 8,
    borderWidth: 0,
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  keyPressed: {
    backgroundColor: palette.cellLocked,
  },
  specialKey: {
    backgroundColor: palette.surfaceVariant,
  },
  capsActive: {
    backgroundColor: palette.selectionBlue,
  },
  keyLabel: {
    ...typography.gridInput,
    color: palette.ink,
    textAlign: 'center',
  },
  keyPreview: {
    alignItems: 'center',
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderRadius: 10,
    borderWidth: 1,
    bottom: KEY_HEIGHT - 5,
    boxShadow: '0 6px 14px rgba(0, 0, 0, 0.16)',
    height: 60,
    justifyContent: 'center',
    position: 'absolute',
    pointerEvents: 'none',
    width: 56,
    zIndex: 110,
  },
  keyPreviewCenter: {
    left: '50%',
    marginLeft: -28,
  },
  keyPreviewLeft: {
    left: 0,
  },
  keyPreviewRight: {
    right: 0,
  },
  keyPreviewLabel: {
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
    fontSize: 28,
    lineHeight: 34,
  },
  keyPreviewTail: {
    backgroundColor: palette.surfaceLowest,
    borderBottomColor: palette.gridLine,
    borderBottomWidth: 1,
    borderRightColor: palette.gridLine,
    borderRightWidth: 1,
    bottom: -6,
    height: 12,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
});
