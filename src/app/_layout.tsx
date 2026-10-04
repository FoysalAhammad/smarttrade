import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConsentGate } from '../components/ConsentGate';
import { UpdateGate } from '../components/UpdateGate';
import { DrawerMenu } from '../components/DrawerMenu';
import { TradeStoreProvider } from '../hooks/useTradeStore';
import { ThemeProvider } from '../theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider>
      <SafeAreaProvider>
        <TradeStoreProvider>
          <StatusBar style="light" />
          <ConsentGate>
          <UpdateGate>
          <Drawer
            drawerContent={(props) => <DrawerMenu {...props} />}
            screenOptions={{
              headerShown: false,
              drawerStyle: { backgroundColor: '#0B0E11', width: 308 },
              sceneStyle: { backgroundColor: '#0B0E11' },
              swipeEnabled: true,
            }}
          >
            <Drawer.Screen name="index" options={{ title: 'Dashboard' }} />
            <Drawer.Screen name="account" options={{ title: 'Account' }} />
            <Drawer.Screen name="history" options={{ title: 'Trade History' }} />
          </Drawer>
          </UpdateGate>
          </ConsentGate>
        </TradeStoreProvider>
      </SafeAreaProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
