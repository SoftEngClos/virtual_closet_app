import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export interface ThemeColors {
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
  icon: string;
  iconBackground: string;
  overlay: string;
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
  icon: '#0066ff',
  iconBackground: '#f0f7ff',
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
  icon: '#4d9eff',
  iconBackground: '#1a3a5c',
  overlay: 'rgba(0,0,0,0.8)',
};

// Create a simple event emitter for theme changes
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

export const useSimpleTheme = () => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
    
    // Listen for theme changes from other screens
    const listener = () => {
      loadTheme();
    };
    
    listeners.add(listener);
    
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('dark_mode');
      if (saved !== null) {
        setIsDark(saved === 'true');
      } else {
        setIsDark(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newValue = !isDark;
      await AsyncStorage.setItem('dark_mode', String(newValue));
      setIsDark(newValue);
      
      // Notify all other screens about the theme change
      notifyListeners();
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = isDark ? darkColors : lightColors;

  return { isDark, colors, toggleTheme, isLoading };
};
