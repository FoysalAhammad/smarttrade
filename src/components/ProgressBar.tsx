import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../theme';

interface ProgressBarProps {
  progress: number;
  from: string;
  to: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, from, to, height = 10 }) => {
  const t = useTheme();
  const pct = Math.min(Math.max(progress, 0), 1);
  return (
    <View
      style={[
        styles.track,
        { backgroundColor: t.colors.bg.input, borderRadius: height / 2, height },
        { borderColor: t.colors.border.subtle, borderWidth: StyleSheet.hairlineWidth },
      ]}
    >
      {pct > 0 && (
        <LinearGradient
          colors={[from, to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.fill,
            {
              width: `${pct * 100}%`,
              borderRadius: height / 2,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
});
