import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fetchForecastForDates, DailyWeather } from './weather.ts';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Request notification permissions from the user
 */
export const requestNotificationPermissions = async (): Promise<NotificationPermissionStatus> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return 'denied';
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('weather-alerts', {
        name: 'Weather Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0066ff',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('outfit-reminders', {
        name: 'Outfit Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#22c55e',
        sound: 'default',
      });
    }

    return 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return 'denied';
  }
};

/**
 * Check current notification permission status
 */
export const checkNotificationPermissions = async (): Promise<NotificationPermissionStatus> => {
  const { status } = await Notifications.getPermissionsAsync();
  return status as NotificationPermissionStatus;
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Get weather condition category for comparison
 */
const getWeatherCategory = (weather: DailyWeather): string => {
  const condition = weather.summary.toLowerCase();
  const icon = weather.icon.toLowerCase();
  
  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower')) {
    return 'rain';
  }
  if (condition.includes('snow') || condition.includes('sleet') || condition.includes('ice')) {
    return 'snow';
  }
  if (condition.includes('storm') || condition.includes('thunder')) {
    return 'storm';
  }
  
  const tempF = (weather.tMax * 9/5) + 32;
  if (tempF > 85) return 'hot';
  if (tempF >= 70) return 'warm';
  if (tempF >= 55) return 'cool';
  return 'cold';
};

/**
 * Check if weather has changed significantly
 */
const hasSignificantWeatherChange = (current: DailyWeather, forecast: DailyWeather): boolean => {
  const currentCategory = getWeatherCategory(current);
  const forecastCategory = getWeatherCategory(forecast);
  
  // Different weather category = significant change
  if (currentCategory !== forecastCategory) {
    return true;
  }
  
  // Temperature change of 15°F or more
  const currentTempF = (current.tMax * 9/5) + 32;
  const forecastTempF = (forecast.tMax * 9/5) + 32;
  if (Math.abs(currentTempF - forecastTempF) >= 15) {
    return true;
  }
  
  // Precipitation change from <20% to >60% or vice versa
  const currentPrecip = (current.pop ?? 0) * 100;
  const forecastPrecip = (forecast.pop ?? 0) * 100;
  if ((currentPrecip < 20 && forecastPrecip > 60) || (currentPrecip > 60 && forecastPrecip < 20)) {
    return true;
  }
  
  return false;
};

/**
 * Get notification message for weather change
 */
const getWeatherChangeMessage = (date: string, current: DailyWeather, forecast: DailyWeather): string => {
  const forecastCategory = getWeatherCategory(forecast);
  const forecastTempF = Math.round((forecast.tMax * 9/5) + 32);
  const forecastPrecip = Math.round((forecast.pop ?? 0) * 100);
  
  const dateObj = new Date(date + 'T12:00:00');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  
  if (forecastCategory === 'rain') {
    return `⚠️ Weather Alert: ${forecastPrecip}% chance of rain on ${dayName}! Consider changing your outfit to rain-friendly attire.`;
  }
  
  if (forecastCategory === 'snow') {
    return `❄️ Weather Alert: Snow expected on ${dayName}! Bundle up and consider waterproof winter gear.`;
  }
  
  if (forecastCategory === 'storm') {
    return `⛈️ Weather Alert: Storms forecast for ${dayName}! Plan for severe weather with waterproof clothing.`;
  }
  
  if (forecastCategory === 'hot') {
    return `🔥 Weather Alert: ${forecastTempF}°F on ${dayName}! Much hotter than expected - switch to lighter, breathable fabrics.`;
  }
  
  if (forecastCategory === 'cold') {
    return `🥶 Weather Alert: Only ${forecastTempF}°F on ${dayName}! Colder than expected - add warm layers to your outfit.`;
  }
  
  return `🌤️ Weather Update: Conditions changed for ${dayName} - check your scheduled outfit!`;
};

/**
 * Check for weather changes and send notifications
 */
export const checkWeatherChangesForScheduledOutfits = async (
  userId: string,
  coords: { lat: number; lon: number }
): Promise<void> => {
  try {
    // Get scheduled outfits for the next 7 days
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const endDate = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;
    
    // Get user's scheduled outfits
    const q = query(
      collection(db, 'calendar'),
      where('uid', '==', userId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const snapshot = await getDocs(q);
    const scheduledDates: string[] = [];
    snapshot.docs.forEach((doc) => {
      scheduledDates.push(doc.data().date);
    });
    
    if (scheduledDates.length === 0) {
      return; // No scheduled outfits to check
    }
    
    // Get current and forecast weather
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    }
    
    const weatherMap = await fetchForecastForDates(null, dates, 'imperial', coords);
    
    // Check each scheduled date for significant weather changes
    for (const date of scheduledDates) {
      const forecast = weatherMap[date];
      if (!forecast) continue;
      
      // Get "current" weather (yesterday's forecast for this date)
      // In a real app, you'd store previous forecasts to compare
      // For now, we'll just check extreme conditions
      
      const forecastCategory = getWeatherCategory(forecast);
      const forecastTempF = (forecast.tMax * 9/5) + 32;
      const forecastPrecip = (forecast.pop ?? 0) * 100;
      
      let shouldNotify = false;
      let message = '';
      
      // Notify for rain/snow
      if (forecastCategory === 'rain' && forecastPrecip > 60) {
        shouldNotify = true;
        message = getWeatherChangeMessage(date, forecast, forecast);
      }
      
      if (forecastCategory === 'snow' || forecastCategory === 'storm') {
        shouldNotify = true;
        message = getWeatherChangeMessage(date, forecast, forecast);
      }
      
      // Notify for extreme temperatures
      if (forecastTempF > 90 || forecastTempF < 40) {
        shouldNotify = true;
        message = getWeatherChangeMessage(date, forecast, forecast);
      }
      
      if (shouldNotify) {
        await scheduleWeatherAlert(date, message);
      }
    }
  } catch (error) {
    console.error('Error checking weather changes:', error);
  }
};

/**
 * Schedule a weather alert notification
 */
const scheduleWeatherAlert = async (date: string, message: string): Promise<void> => {
  try {
    // Schedule notification for 8 AM on the day before
    const targetDate = new Date(date + 'T12:00:00');
    const notificationDate = new Date(targetDate);
    notificationDate.setDate(targetDate.getDate() - 1);
    notificationDate.setHours(8, 0, 0, 0);
    
    // Don't schedule if in the past
    if (notificationDate < new Date()) {
      return;
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Weather Alert 🌦️',
        body: message,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'weather-alert', date },
      },
      trigger: {
        date: notificationDate,
        channelId: 'weather-alerts',
      },
    });
  } catch (error) {
    console.error('Error scheduling weather alert:', error);
  }
};

/**
 * Schedule daily outfit reminder
 */
export const scheduleDailyOutfitReminder = async (hour: number = 8, minute: number = 0): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Good morning! ☀️',
        body: "Time to check your outfit for today based on the weather!",
        sound: 'default',
        data: { type: 'daily-reminder' },
      },
      trigger: {
        hour,
        minute,
        repeats: true,
        channelId: 'outfit-reminders',
      },
    });
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
  }
};

/**
 * Send immediate notification for outfit suggestion
 */
export const sendOutfitSuggestionNotification = async (message: string): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Outfit Suggestion 👔',
        body: message,
        sound: 'default',
        data: { type: 'outfit-suggestion' },
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Error sending outfit suggestion:', error);
  }
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  return await Notifications.getAllScheduledNotificationsAsync();
};
