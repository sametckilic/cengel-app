import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditorialHeader } from '@/components/cengel/editorial-header';
import { EditorialIcon } from '@/components/cengel/editorial-icon';
import { SectionLabel } from '@/components/cengel/section-label';
import { fonts, layout, palette, spacing, typography } from '@/constants/design';
import { useAuth } from '@/providers/auth-provider';
import { normalizeEmailOtp } from '@/services/account-linking';

export default function ProfileScreen() {
  const {
    account,
    error,
    pendingEmail,
    requestEmailLink,
    resendEmailLink,
    status,
    verifyEmailLink,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<void>, successMessage?: string) {
    setSubmitting(true);
    setNotice(null);

    try {
      await action();

      if (successMessage) {
        setNotice(successMessage);
      }
    } catch {
      // The provider exposes a user-facing error message.
    } finally {
      setSubmitting(false);
    }
  }

  const content = (() => {
    if (status === 'loading') {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={palette.ink} />
          <Text style={styles.supportingText}>Hesabın hazırlanıyor…</Text>
        </View>
      );
    }

    if (status === 'unconfigured') {
      return (
        <View style={styles.statusCard}>
          <EditorialIcon name="cloud-off" size={28} />
          <Text style={styles.cardTitle}>Hesap bağlantısı kullanılamıyor</Text>
          <Text style={styles.supportingText}>
            Bu kurulumda Supabase public yapılandırması bulunamadı. Yerel ilerlemen cihazında
            korunmaya devam eder.
          </Text>
        </View>
      );
    }

    if (status === 'permanent') {
      return (
        <View style={styles.statusCard}>
          <View style={styles.successIcon}>
            <EditorialIcon color={palette.onPrimary} name="check" size={24} />
          </View>
          <SectionLabel>Hesap Güvende</SectionLabel>
          <Text style={styles.cardTitle}>{account?.email ?? 'Doğrulanmış hesap'}</Text>
          <Text style={styles.supportingText}>
            Bulmaca ilerlemen bu kullanıcı kimliğine bağlı. Aynı kimlik abonelikler ve başarımlar
            için de kullanılacak.
          </Text>
        </View>
      );
    }

    if (pendingEmail) {
      return (
        <View style={styles.formCard}>
          <SectionLabel>E-postanı Doğrula</SectionLabel>
          <Text style={styles.cardTitle}>6 haneli kodu gir</Text>
          <Text style={styles.supportingText}>
            {pendingEmail} adresine gönderilen kod, mevcut anonim hesabını kalıcı hesaba bağlar.
          </Text>
          <TextInput
            accessibilityLabel="Altı haneli doğrulama kodu"
            autoComplete="one-time-code"
            editable={!submitting}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={palette.mutedInk}
            style={[styles.input, styles.otpInput]}
            textContentType="oneTimeCode"
            value={otp}
          />
          <Pressable
            accessibilityRole="button"
            disabled={submitting || normalizeEmailOtp(otp) === null}
            onPress={() =>
              void run(() => verifyEmailLink(otp), 'E-posta doğrulandı; hesabın güvenceye alındı.')
            }
            style={({ pressed }) => [
              styles.primaryButton,
              (submitting || normalizeEmailOtp(otp) === null) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}>
            {submitting ? (
              <ActivityIndicator color={palette.onPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>Doğrula</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() =>
              void run(() => resendEmailLink(), 'Yeni doğrulama kodu e-posta adresine gönderildi.')
            }
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.secondaryButtonText}>Kodu Tekrar Gönder</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.formCard}>
        <SectionLabel>İlerlemeni Koru</SectionLabel>
        <Text style={styles.cardTitle}>Hesabını güvenceye al</Text>
        <Text style={styles.supportingText}>
          Şu anda kayıt gerektirmeyen anonim bir hesap kullanıyorsun. E-postanı doğruladığında
          kullanıcı kimliğin ve tüm bulmaca ilerlemen aynı kalır.
        </Text>
        <Text style={styles.inputLabel}>E-posta adresi</Text>
        <TextInput
          accessibilityLabel="E-posta adresi"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!submitting}
          keyboardType="email-address"
          onChangeText={setEmail}
          onSubmitEditing={() => void run(() => requestEmailLink(email))}
          placeholder="ornek@eposta.com"
          placeholderTextColor={palette.mutedInk}
          returnKeyType="send"
          style={styles.input}
          textContentType="emailAddress"
          value={email}
        />
        <Pressable
          accessibilityRole="button"
          disabled={submitting || email.trim().length === 0}
          onPress={() => void run(() => requestEmailLink(email))}
          style={({ pressed }) => [
            styles.primaryButton,
            (submitting || email.trim().length === 0) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}>
          {submitting ? (
            <ActivityIndicator color={palette.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Kodu Gönder</Text>
          )}
        </Pressable>
      </View>
    );
  })();

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <EditorialHeader title="Profil" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardAvoiding}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {content}
            {error ? (
              <View accessibilityLiveRegion="polite" style={styles.errorMessage}>
                <EditorialIcon color={palette.error} name="error-outline" size={18} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {notice ? (
              <View accessibilityLiveRegion="polite" style={styles.noticeMessage}>
                <EditorialIcon color={palette.secondary} name="check-circle-outline" size={18} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}
            <View style={styles.privacyNote}>
              <EditorialIcon color={palette.outline} name="lock" size={18} />
              <Text style={styles.privacyText}>
                Şifresiz doğrulama kullanılır. E-posta adresin bulmaca içeriği üretmek veya reklam
                amacıyla kullanılmaz.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
    paddingTop: spacing.section,
  },
  content: {
    alignSelf: 'center',
    maxWidth: layout.maxContent,
    paddingHorizontal: spacing.page,
    width: '100%',
  },
  formCard: {
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderWidth: 1,
    gap: 16,
    padding: spacing.page,
  },
  statusCard: {
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderWidth: 1,
    gap: 16,
    padding: spacing.page,
  },
  cardTitle: {
    ...typography.headlineMd,
    color: palette.ink,
  },
  supportingText: {
    ...typography.bodyClue,
    color: palette.onSurfaceVariant,
  },
  inputLabel: {
    ...typography.caption,
    color: palette.ink,
    fontFamily: fonts.interBold,
    marginBottom: -8,
    textTransform: 'uppercase',
  },
  input: {
    ...typography.bodyClue,
    backgroundColor: palette.paper,
    borderColor: palette.outlineVariant,
    borderWidth: 1,
    color: palette.ink,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  otpInput: {
    fontFamily: fonts.interBold,
    fontSize: 24,
    letterSpacing: 12,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    ...typography.bodyClue,
    color: palette.onPrimary,
    fontFamily: fonts.interBold,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: palette.outlineVariant,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    ...typography.bodyClue,
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  loadingState: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    minHeight: 240,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  errorMessage: {
    alignItems: 'flex-start',
    backgroundColor: palette.errorContainer,
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    padding: 14,
  },
  errorText: {
    ...typography.bodyClue,
    color: palette.onErrorContainer,
    flex: 1,
  },
  noticeMessage: {
    alignItems: 'flex-start',
    backgroundColor: palette.secondaryFixed,
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    padding: 14,
  },
  noticeText: {
    ...typography.bodyClue,
    color: palette.onSecondaryFixed,
    flex: 1,
  },
  privacyNote: {
    alignItems: 'flex-start',
    borderTopColor: palette.gridLine,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.section,
    paddingTop: 16,
  },
  privacyText: {
    ...typography.caption,
    color: palette.outline,
    flex: 1,
  },
});
