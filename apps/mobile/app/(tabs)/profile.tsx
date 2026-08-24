import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import type { AchievementApiItem } from '@cengel/contracts/achievement-api';

import { AchievementList } from '@/components/cengel/achievement-list';
import { EditorialHeader } from '@/components/cengel/editorial-header';
import { EditorialIcon } from '@/components/cengel/editorial-icon';
import { SectionLabel } from '@/components/cengel/section-label';
import { fonts, layout, palette, spacing, typography } from '@/constants/design';
import { useAuth } from '@/providers/auth-provider';
import { fetchUserAchievements } from '@/services/achievement-client';
import { synchronizeAuthenticatedProgress } from '@/services/progress-sync-client';
import { getAuthenticatedAccess } from '@/services/supabase-client';

type FormMode = 'login' | 'register';

export default function ProfileScreen() {
  const { account, error, login, logout, register, status } = useAuth();
  const [mode, setMode] = useState<FormMode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [achievements, setAchievements] = useState<readonly AchievementApiItem[] | null>(null);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [achievementsError, setAchievementsError] = useState<string | null>(null);

  const loadAchievements = useCallback(async () => {
    setAchievementsLoading(true);
    setAchievementsError(null);

    try {
      const access = await getAuthenticatedAccess();

      if (!access) {
        throw new Error('Authenticated session is unavailable.');
      }

      await synchronizeAuthenticatedProgress(access);
      const response = await fetchUserAchievements(access.accessToken);
      setAchievements(response.items);
    } catch {
      setAchievementsError('Başarımlar şu anda yüklenemedi. Yerel ilerlemen güvende.');
    } finally {
      setAchievementsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated' || !account?.userId) {
        setAchievements(null);
        setAchievementsError(null);
        setAchievementsLoading(false);
        return;
      }

      void loadAchievements();
    }, [account?.userId, loadAchievements, status]),
  );

  async function run(action: () => Promise<void>) {
    setSubmitting(true);

    try {
      await action();
      setPassword('');
      setPasswordConfirmation('');
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
          <Text style={styles.supportingText}>Hesap durumu yükleniyor…</Text>
        </View>
      );
    }

    if (status === 'unconfigured') {
      return (
        <View style={styles.statusCard}>
          <EditorialIcon name="cloud-off" size={28} />
          <Text style={styles.cardTitle}>Hesap bağlantısı kullanılamıyor</Text>
          <Text style={styles.supportingText}>
            Yerel ilerlemen cihazında korunmaya devam eder. Supabase public yapılandırması
            eklendiğinde hesap ve cihazlar arası senkronizasyon açılır.
          </Text>
        </View>
      );
    }

    if (status === 'authenticated') {
      return (
        <View style={styles.statusCard}>
          <View style={styles.successIcon}>
            <EditorialIcon color={palette.onPrimary} name="check" size={24} />
          </View>
          <SectionLabel>Hesap Bağlı</SectionLabel>
          <Text style={styles.cardTitle}>{account?.email}</Text>
          <Text style={styles.supportingText}>
            Yerel bulmaca ilerlemen bu hesaba senkronize edilir. Uygulamadan çıkış yapsan da
            cihazındaki bulmacalar ve ilerleme kayıtları silinmez.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => void run(logout)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
            {submitting ? (
              <ActivityIndicator color={palette.ink} />
            ) : (
              <Text style={styles.secondaryButtonText}>Bu Cihazda Çıkış Yap</Text>
            )}
          </Pressable>
        </View>
      );
    }

    const isRegister = mode === 'register';

    return (
      <View style={styles.formCard}>
        <SectionLabel>İsteğe Bağlı Hesap</SectionLabel>
        <Text style={styles.cardTitle}>
          {isRegister ? 'İlerlemeni güvenceye al' : 'Hesabına giriş yap'}
        </Text>
        <Text style={styles.supportingText}>
          {isRegister
            ? 'Hesap oluşturmadan oynamaya devam edebilirsin. Hesap açarsan ilerlemen cihazlar arasında taşınabilir.'
            : 'Daha önce oluşturduğun hesabın e-posta adresi ve şifresiyle devam et.'}
        </Text>
        <View accessibilityRole="tablist" style={styles.modeTabs}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isRegister }}
            onPress={() => setMode('register')}
            style={[styles.modeTab, isRegister && styles.modeTabActive]}>
            <Text style={[styles.modeTabText, isRegister && styles.modeTabTextActive]}>
              Kayıt Ol
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: !isRegister }}
            onPress={() => setMode('login')}
            style={[styles.modeTab, !isRegister && styles.modeTabActive]}>
            <Text style={[styles.modeTabText, !isRegister && styles.modeTabTextActive]}>
              Giriş Yap
            </Text>
          </Pressable>
        </View>
        <Text style={styles.inputLabel}>E-posta adresi</Text>
        <TextInput
          accessibilityLabel="E-posta adresi"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!submitting}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="ornek@eposta.com"
          placeholderTextColor={palette.mutedInk}
          style={styles.input}
          textContentType="emailAddress"
          value={email}
        />
        <Text style={styles.inputLabel}>Şifre</Text>
        <TextInput
          accessibilityLabel="Şifre"
          autoCapitalize="none"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          editable={!submitting}
          onChangeText={setPassword}
          placeholder="En az 8 karakter"
          placeholderTextColor={palette.mutedInk}
          secureTextEntry
          style={styles.input}
          textContentType={isRegister ? 'newPassword' : 'password'}
          value={password}
        />
        {isRegister ? (
          <>
            <Text style={styles.inputLabel}>Şifre tekrar</Text>
            <TextInput
              accessibilityLabel="Şifre tekrar"
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!submitting}
              onChangeText={setPasswordConfirmation}
              placeholder="Şifreyi yeniden gir"
              placeholderTextColor={palette.mutedInk}
              secureTextEntry
              style={styles.input}
              textContentType="newPassword"
              value={passwordConfirmation}
            />
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={submitting || !email.trim() || !password}
          onPress={() =>
            void run(() =>
              isRegister
                ? register(email, password, passwordConfirmation)
                : login(email, password),
            )
          }
          style={({ pressed }) => [
            styles.primaryButton,
            (submitting || !email.trim() || !password) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}>
          {submitting ? (
            <ActivityIndicator color={palette.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isRegister ? 'Hesap Oluştur' : 'Giriş Yap'}
            </Text>
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
        style={styles.keyboardAvoiding}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {content}
            {status === 'authenticated' ? (
              <AchievementList
                error={achievementsError}
                items={achievements}
                loading={achievementsLoading}
                onRetry={() => void loadAchievements()}
              />
            ) : null}
            {error ? (
              <View accessibilityLiveRegion="polite" style={styles.errorMessage}>
                <EditorialIcon color={palette.error} name="error-outline" size={18} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <View style={styles.localNote}>
              <EditorialIcon color={palette.outline} name="offline-bolt" size={18} />
              <Text style={styles.localNoteText}>
                Hesap zorunlu değildir. Bulmacalar ve yerel kayıtlar internet veya giriş olmadan
                çalışmaya devam eder.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: palette.paper, flex: 1 },
  keyboardAvoiding: { flex: 1 },
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
    gap: 14,
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
  cardTitle: { ...typography.headlineMd, color: palette.ink },
  supportingText: { ...typography.bodyClue, color: palette.onSurfaceVariant },
  modeTabs: {
    borderColor: palette.outlineVariant,
    borderWidth: 1,
    flexDirection: 'row',
  },
  modeTab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  modeTabActive: { backgroundColor: palette.primary },
  modeTabText: {
    ...typography.bodyClue,
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
  },
  modeTabTextActive: { color: palette.onPrimary },
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
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.72 },
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
  localNote: {
    alignItems: 'flex-start',
    borderTopColor: palette.gridLine,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.section,
    paddingTop: 16,
  },
  localNoteText: {
    ...typography.caption,
    color: palette.outline,
    flex: 1,
  },
});
