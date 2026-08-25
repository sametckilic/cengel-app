import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { EditorialIcon } from '@/components/cengel/editorial-icon';
import { SectionLabel } from '@/components/cengel/section-label';
import { fonts, palette, spacing, typography } from '@/constants/design';
import { useRevenueCat } from '@/providers/revenuecat-provider';
import { usePuzzleCatalog } from '@/providers/puzzle-catalog-provider';

export function PremiumAccessCard() {
  const { busy, error, package: offer, premium, purchase, restore, status } = useRevenueCat();
  const { refreshCatalog } = usePuzzleCatalog();
  const [notice, setNotice] = useState<string | null>(null);

  async function runPurchase() {
    setNotice(null);

    try {
      const result = await purchase();
      setNotice(
        result === 'cancelled'
          ? 'Satın alma iptal edildi.'
          : 'Premium erişimin etkinleştirildi.',
      );

      if (result === 'success') {
        refreshCatalog();
        setTimeout(refreshCatalog, 2500);
      }
    } catch {
      // Provider exposes the SDK error without changing account or local progress state.
    }
  }

  async function runRestore() {
    setNotice(null);

    try {
      await restore();
      setNotice('Satın alımların kontrol edildi.');
      refreshCatalog();
      setTimeout(refreshCatalog, 2500);
    } catch {
      // Provider exposes the SDK error without changing account or local progress state.
    }
  }

  if (status === 'unsupported') {
    return null;
  }

  return (
    <View style={styles.card}>
      <SectionLabel>Premium</SectionLabel>
      <View style={styles.titleRow}>
        <View style={[styles.icon, premium.active && styles.iconActive]}>
          <EditorialIcon
            color={premium.active ? palette.onPrimary : palette.ink}
            name={premium.active ? 'verified' : 'workspace-premium'}
            size={24}
          />
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>
            {premium.active ? 'Premium erişim etkin' : 'Çengel Premium'}
          </Text>
          <Text style={styles.supportingText}>
            {premium.active
              ? 'Premium arşiv ve paketlere bu hesapla erişebilirsin.'
              : 'Premium arşiv ve özel bulmaca paketlerinin kilidini aç.'}
          </Text>
        </View>
      </View>

      {status === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={palette.ink} size="small" />
          <Text style={styles.supportingText}>Abonelik bilgisi yükleniyor…</Text>
        </View>
      ) : null}

      {status === 'unconfigured' ? (
        <Text style={styles.supportingText}>Bu build için RevenueCat yapılandırılmamış.</Text>
      ) : null}

      {status === 'ready' && !premium.active ? (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !offer}
            onPress={() => void runPurchase()}
            style={({ pressed }) => [
              styles.primaryButton,
              (busy || !offer) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}>
            {busy ? (
              <ActivityIndicator color={palette.onPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {offer ? `${offer.price} · Premium'u Başlat` : 'Paket Bulunamadı'}
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void runRestore()}
            style={({ pressed }) => [
              styles.secondaryButton,
              busy && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.secondaryButtonText}>Satın Alımları Geri Yükle</Text>
          </Pressable>
        </>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderWidth: 1,
    gap: 16,
    marginTop: spacing.section,
    padding: spacing.page,
  },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 14 },
  titleCopy: { flex: 1, gap: 4 },
  title: { ...typography.headlineMd, color: palette.ink },
  supportingText: { ...typography.bodyClue, color: palette.onSurfaceVariant },
  icon: {
    alignItems: 'center',
    backgroundColor: palette.surfaceContainer,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconActive: { backgroundColor: palette.primary },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
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
  errorText: { ...typography.bodyClue, color: palette.error },
  noticeText: { ...typography.bodyClue, color: palette.onSurfaceVariant },
});
