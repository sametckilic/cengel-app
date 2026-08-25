export type RevenueCatPlatform = 'android' | 'ios' | 'web';

type RevenueCatKeyOptions = {
  androidKey?: string;
  iosKey?: string;
  isDevelopment: boolean;
  platform: RevenueCatPlatform;
  testStoreKey?: string;
};

function clean(value: string | undefined): string | null {
  return value?.trim() || null;
}

export function getRevenueCatApiKey({
  androidKey,
  iosKey,
  isDevelopment,
  platform,
  testStoreKey,
}: RevenueCatKeyOptions): string | null {
  if (platform === 'web') {
    return null;
  }

  const developmentKey = clean(testStoreKey);

  if (isDevelopment && developmentKey) {
    return developmentKey;
  }

  return platform === 'ios' ? clean(iosKey) : clean(androidKey);
}

export function getConfiguredRevenueCatApiKey(
  platform: RevenueCatPlatform,
): string | null {
  return getRevenueCatApiKey({
    androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    isDevelopment: __DEV__,
    platform,
    testStoreKey: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY,
  });
}
