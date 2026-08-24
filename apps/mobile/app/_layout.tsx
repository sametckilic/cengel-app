import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { palette } from '@/constants/design';
import { PuzzleCatalogProvider } from '@/providers/puzzle-catalog-provider';
import { ProgressSyncProvider } from '@/providers/progress-sync-provider';

void SplashScreen.preventAutoHideAsync();

const editorialTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.paper,
    border: palette.gridLine,
    card: palette.paper,
    primary: palette.primary,
    text: palette.ink,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...MaterialCommunityIcons.font,
    ...MaterialIcons.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PuzzleCatalogProvider>
          <ProgressSyncProvider>
            <ThemeProvider value={editorialTheme}>
              <Stack
                screenOptions={{
                  animation: 'slide_from_right',
                  contentStyle: { backgroundColor: palette.paper },
                  headerShown: false,
                }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="puzzle" />
                <Stack.Screen name="puzzle/[id]" />
                <Stack.Screen name="newspaper-preview" />
                <Stack.Screen name="packs/edebiyat" />
              </Stack>
              <StatusBar style="dark" />
            </ThemeProvider>
          </ProgressSyncProvider>
        </PuzzleCatalogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = {
  root: { flex: 1 },
};
