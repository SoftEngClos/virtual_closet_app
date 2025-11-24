// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Theme = 'light' | 'dark' | 'auto';

interface ThemeColors {
  background: string;
  card: string;
  surface: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryLight: string;
  border: string;
  borderLight: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  icon: string;
  iconBackground: string;
  shadow: string;
  overlay: string;
}

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
}

const lightColors: ThemeColors = {
  background: '#fafafa',
  card: '#ffffff',
  surface: '#f8fafc',
  text: '#1a1a1a',
  textSecondary: '#666666',
  primary: '#0066ff',
  primaryLight: '#f0f7ff',
  border: '#e8e8e8',
  borderLight: '#f0f0f0',
  error: '#ff4757',
  success: '#22c55e',
  warning: '#FFA500',
  info: '#4A90E2',
  icon: '#0066ff',
  iconBackground: '#f0f7ff',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
};

const darkColors: ThemeColors = {
  background: '#121212',
  card: '#1e1e1e',
  surface: '#2a2a2a',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  primary: '#4d9eff',
  primaryLight: '#1a3a5c',
  border: '#3a3a3a',
  borderLight: '#2a2a2a',
  error: '#ff6b7a',
  success: '#4ade80',
  warning: '#ffb84d',
  info: '#67a3d9',
  icon: '#4d9eff',
  iconBackground: '#1a3a5c',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.8)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('light'); // Default to light
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    if (theme === 'auto') {
      setIsDark(systemColorScheme === 'dark');
    } else {
      setIsDark(theme === 'dark');
    }
  }, [theme, systemColorScheme]);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('app_theme');
      if (savedTheme) {
        setThemeState(savedTheme as Theme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem('app_theme', newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
