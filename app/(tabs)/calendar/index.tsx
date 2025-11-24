import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../../firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useSimpleTheme } from "../../../src/hooks/useSimpleTheme";

import { useCurrentLocation } from "../../../src/services/useCurrentLocation.ts";
import { fetchForecastForDates, iconToIonicon, DailyWeather } from "../../../src/services/weather.ts";

type OutfitItem = { category: string; uri: string; slotIndex: number };
type SavedOutfit = { id: string; outfit: OutfitItem[]; category: string };
type OutfitCategories = Record<string, SavedOutfit[]>;

type CalendarEvent = {
  id: string;
  date: string;
  outfitId: string;
  outfitCategory: string;
  title: string;
  uid: string;
};

type WeatherMap = Record<string, DailyWeather>;

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const toFahrenheit = (temp: number): number => {
  if (temp >= -50 && temp <= 150) {
    return temp;
  }
  return (temp * 9/5) + 32;
};

const getWeatherAdvice = (weather: DailyWeather): { message: string; icon: string; color: string } => {
  const tempF = Math.round(toFahrenheit(weather.tMax));
  const condition = weather.summary.toLowerCase();
  const icon = weather.icon.toLowerCase();
  
  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower')) {
    const messages = [
      `☔ ${Math.round((weather.pop ?? 0) * 100)}% chance of rain! Waterproof jacket and boots are a must.`,
      `🌧️ Rainy vibes! Don't forget your umbrella and a chic trench coat.`,
      `💧 Wet weather ahead! Layer with a rain jacket and water-resistant shoes.`,
      `🌂 Rain forecast! Perfect excuse for your favorite raincoat and stylish boots.`,
    ];
    return { message: messages[Math.floor(Math.random() * messages.length)], icon: "rainy", color: "#607D8B" };
  }

  if (condition.includes('snow') || condition.includes('sleet') || condition.includes('ice')) {
    const messages = [
      `❄️ Snow day! Bundle up with a warm coat, scarf, gloves, and insulated boots.`,
      `⛄ Winter wonderland! Layer thermal wear under your winter coat.`,
      `🧊 Icy conditions! Wear non-slip boots and your warmest layers.`,
      `🌨️ Snowy weather! Time for that cozy puffer jacket and winter accessories.`,
    ];
    return { message: messages[Math.floor(Math.random() * messages.length)], icon: "snow", color: "#7fb3ff" };
  }

  if (condition.includes('storm') || condition.includes('thunder')) {
    const messages = [
      `⛈️ Storms expected! Stay safe with waterproof layers and avoid loose accessories.`,
      `🌩️ Thunderstorms ahead! Waterproof everything and skip metal accessories.`,
      `⚡ Stormy weather! Layer with a sturdy rain jacket and secure footwear.`,
    ];
    return { message: messages[Math.floor(Math.random() * messages.length)], icon: "thunderstorm", color: "#7e57c2" };
  }

  if (tempF > 85) {
    const messages = [
      `🔥 It's ${tempF}°F! Scorching heat - breathable fabrics like linen or cotton only.`,
      `☀️ Hot day at ${tempF}°F! Light colors reflect heat - go for whites and pastels.`,
      `🌡️ ${tempF}°F outside! Beat the heat with loose-fitting tank tops and shorts.`,
      `🥵 ${tempF}°F today! Stay cool - sundresses and sandals are your best friends.`,
    ];
    return {
      message: messages[Math.floor(Math.random() * messages.length)],
      icon: icon.includes('clear') || icon.includes('sun') ? "sunny" : "partly-sunny",
      color: "#FF6B35"
    };
  }
  
  if (tempF >= 70) {
    const messages = [
      `😎 Perfect ${tempF}°F! T-shirt and jeans weather - dress casually.`,
      `🌤️ Beautiful ${tempF}°F! Great day for a button-down or sundress.`,
      `✨ Lovely ${tempF}°F! Go with whatever feels comfortable.`,
      `🌻 ${tempF}°F today! Ideal weather for that new outfit you've been saving.`,
    ];
    return {
      message: messages[Math.floor(Math.random() * messages.length)],
      icon: icon.includes('clear') || icon.includes('sun') ? "sunny" : "partly-sunny",
      color: "#FFA500"
    };
  }
  
  if (tempF >= 55) {
    const messages = [
      `🍂 ${tempF}°F - layer time! Cardigan or light jacket over your outfit.`,
      `🧥 Sweater weather at ${tempF}°F! Perfect for cozy knits and scarves.`,
      `👔 ${tempF}°F - great for layering! Blazer or denim jacket recommended.`,
      `🧣 ${tempF}°F today - add layers! Scarf and light jacket to stay comfortable.`,
    ];
    return { message: messages[Math.floor(Math.random() * messages.length)], icon: "cloudy", color: "#4A90E2" };
  }
  
  const messages: string[] = [
    `🥶 Chilly ${tempF}°F! Warm coat, scarf, gloves, and insulated boots essential.`,
    `🧊 Cold at ${tempF}°F! Layer thermal wear under your winter coat.`,
    `❄️ ${tempF}°F outside! Bundle up - don't forget your warmest accessories.`,
    `☃️ Freezing ${tempF}°F! Full winter gear - coat, hat, gloves, thick socks.`,
  ];
  return { message: messages[Math.floor(Math.random() * messages.length)], icon: "snow", color: "#5A9FD4" };
};

export default function CalendarScreen() {
  const { colors, isDark } = useSimpleTheme();
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string>("there");
  const [selectedDate, setSelectedDate] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<OutfitCategories>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedDateEvent, setSelectedDateEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentWeek, setCurrentWeek] = useState<string[]>([]);
  const [weatherByDate, setWeatherByDate] = useState<WeatherMap>({});
  const [units] = useState<"imperial" | "metric">("imperial");
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [todayWeather, setTodayWeather] = useState<DailyWeather | null>(null);
  const [currentAdvice, setCurrentAdvice] = useState<{ message: string; icon: string; color: string } | null>(null);

  const [weatherCache, setWeatherCache] = useState<{ key: string; at: number; data: WeatherMap } | null>(null);
  const cacheKey = (coordsKey: string, week: string[], units: "imperial" | "metric") =>
    `${coordsKey}|${week[0]}-${week[6]}|${units}`;

  const { coords, permission, reverseGeocode } = useCurrentLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const name = firebaseUser.displayName?.split(' ')[0] || firebaseUser.email?.split('@')[0] || "there";
        setUserName(name);
        loadEvents(firebaseUser.uid);
        loadOutfits(firebaseUser.uid);
      } else {
        setUser(null);
        setEvents([]);
        setSavedOutfits({});
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const today = getTodayDateString();
    setSelectedDate(today);
    updateCurrentWeek(today);
  }, []);

  useEffect(() => {
    const marked: any = {};
    events.forEach((event) => {
      marked[event.date] = {
        ...(marked[event.date] || {}),
        marked: true,
        dotColor: "#22c55e",
        selected: event.date === selectedDate,
        selectedColor: event.date === selectedDate ? colors.primary : undefined,
      };
    });
    if (selectedDate && !marked[selectedDate]) {
      marked[selectedDate] = { selected: true, selectedColor: colors.primary };
    }
    setMarkedDates(marked);
  }, [events, selectedDate, colors]);

  useEffect(() => {
    (async () => {
      if (permission === "denied") return;
      const label = await reverseGeocode();
      if (label) setLocationLabel(label);
    })();
  }, [permission, reverseGeocode]);

  useEffect(() => {
    if (!coords || currentWeek.length === 0) return;

    const coordsKey = `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
    const key = cacheKey(coordsKey, currentWeek, units);

    const run = async () => {
      const fresh = weatherCache && weatherCache.key === key && Date.now() - weatherCache.at < 2 * 60 * 60 * 1000;
      if (fresh) {
        setWeatherByDate(weatherCache.data);
        const today = getTodayDateString();
        const todayWx = weatherCache.data[today];
        setTodayWeather(todayWx || null);
        if (todayWx && !currentAdvice) {
          setCurrentAdvice(getWeatherAdvice(todayWx));
        }
        return;
      }
      try {
        const map = await fetchForecastForDates(null, currentWeek, units, { lat: coords.lat, lon: coords.lon });
        setWeatherByDate(map);
        setWeatherCache({ key, at: Date.now(), data: map });
        const today = getTodayDateString();
        const todayWx = map[today];
        setTodayWeather(todayWx || null);
        if (todayWx) {
          setCurrentAdvice(getWeatherAdvice(todayWx));
        }
      } catch (e) {
        console.warn("Weather fetch failed", e);
      }
    };

    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, [coords, currentWeek, units]);

  useEffect(() => {
    if (todayWeather) {
      const newAdvice = getWeatherAdvice(todayWeather);
      if (!currentAdvice || currentAdvice.icon !== newAdvice.icon || currentAdvice.color !== newAdvice.color) {
        setCurrentAdvice(newAdvice);
      }
    }
  }, [todayWeather]);

  const getTodayDateString = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const updateCurrentWeek = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek);
    
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(startOfWeek);
      current.setDate(startOfWeek.getDate() + i);
      week.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`);
    }
    setCurrentWeek(week);
  };

  const loadEvents = async (uid: string) => {
    try {
      const q = query(collection(db, "calendar"), where("uid", "==", uid));
      const snapshot = await getDocs(q);
      const loadedEvents: CalendarEvent[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        loadedEvents.push({ id: docSnap.id, date: data.date, outfitId: data.outfitId, outfitCategory: data.outfitCategory, title: data.title, uid: data.uid });
      });
      setEvents(loadedEvents);
    } catch (err) {
      console.error("Error loading events:", err);
    }
  };

  const loadOutfits = async (uid: string) => {
    try {
      const q = query(collection(db, "outfits"), where("uid", "==", uid));
      const snapshot = await getDocs(q);
      const outfits: OutfitCategories = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const { category, outfit } = data;
        if (!outfits[category]) outfits[category] = [];
        outfits[category].push({ id: docSnap.id, category, outfit });
      });
      setSavedOutfits(outfits);
    } catch (err) {
      console.error("Error loading outfits:", err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (user) {
      await loadEvents(user.uid);
      await loadOutfits(user.uid);
    }
    setWeatherCache(null);
    setRefreshing(false);
  };

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    updateCurrentWeek(day.dateString);
    const existingEvent = events.find((e) => e.date === day.dateString);
    setSelectedDateEvent(existingEvent || null);
  };

  const handleWeekDayPress = (dateString: string) => {
    setSelectedDate(dateString);
    const existingEvent = events.find((e) => e.date === dateString);
    setSelectedDateEvent(existingEvent || null);
  };

  const handleAddOutfit = () => {
    if (!selectedDate) {
      Alert.alert("No Date Selected", "Please select a date first.");
      return;
    }
    if (Object.keys(savedOutfits).length === 0) {
      Alert.alert("No Outfits", "Please create some outfits first in the Outfits tab.");
      return;
    }
    setModalVisible(true);
  };

  const handleSelectOutfit = async (outfit: SavedOutfit) => {
    if (!user || !selectedDate) return;
    try {
      setSaving(true);
      const existingEvent = events.find((e) => e.date === selectedDate);
      setSelectedDateEvent({
        id: existingEvent ? existingEvent.id : "pending",
        date: selectedDate,
        outfitId: outfit.id,
        outfitCategory: outfit.category,
        title: outfit.category,
        uid: user.uid,
      });

      if (existingEvent) {
        await updateDoc(doc(db, "calendar", existingEvent.id), {
          outfitId: outfit.id,
          outfitCategory: outfit.category,
          title: outfit.category,
        });
      } else {
        await addDoc(collection(db, "calendar"), {
          uid: user.uid,
          date: selectedDate,
          outfitId: outfit.id,
          outfitCategory: outfit.category,
          title: outfit.category,
          createdAt: new Date().toISOString(),
        });
      }

      await loadEvents(user.uid);
      const updated = events.find((e) => e.date === selectedDate);
      setSelectedDateEvent(updated || null);
      setModalVisible(false);
      setExpandedCategory(null);
      Alert.alert("Success", "Outfit saved for this date!");
    } catch (err) {
      console.error("Error scheduling outfit:", err);
      Alert.alert("Error", "Failed to schedule outfit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedDateEvent || !user) return;
    Alert.alert("Remove Outfit", "Remove the outfit scheduled for this day?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "calendar", selectedDateEvent.id));
            await loadEvents(user.uid);
            setSelectedDateEvent(null);
            Alert.alert("Success", "Outfit removed from calendar!");
          } catch (err) {
            console.error("Error deleting event:", err);
            Alert.alert("Error", "Failed to remove outfit.");
          }
        },
      },
    ]);
  };

  const colorFor = (icon: string) => {
    const k = icon.toLowerCase();
    if (k.includes('clear') || k.includes('sun')) return "#f6b900";
    if (k.includes('rain') || k.includes('drizzle')) return "#3a7bd5";
    if (k.includes('snow') || k.includes('sleet')) return "#7fb3ff";
    if (k.includes('storm') || k.includes('thunder')) return "#7e57c2";
    if (k.includes('fog') || k.includes('mist')) return "#9e9e9e";
    if (k.includes('cloud')) return "#5c7cfa";
    return "#9E9E9E";
  };

  const renderOutfitPreview = (outfit: SavedOutfit, size: "compact" | "large" = "compact") => {
    const slots: (OutfitItem | null)[] = [null, null, null, null, null];
    outfit.outfit.forEach((item) => {
      const slotIndex = item.slotIndex !== undefined ? item.slotIndex : 0;
      if (slotIndex >= 0 && slotIndex < 5) slots[slotIndex] = item;
    });

    if (size === "compact") {
      const visibleItems = slots.filter((x) => x !== null).slice(0, 3) as OutfitItem[];
      return (
        <View style={styles.compactOutfitPreview}>
          <View style={styles.compactModelBody} />
          {visibleItems.map((item, idx) => {
            const isFirst = (item.slotIndex ?? 0) === 0;
            return (
              <View key={`slot-${item.slotIndex ?? idx}`} style={[styles.compactSlot, { top: idx * 35 + 15 }]}>
                <Image source={{ uri: item.uri }} style={isFirst ? styles.compactFaceImage : styles.compactOverlayItem} resizeMode="cover" />
              </View>
            );
          })}
        </View>
      );
    }

    return (
      <View style={styles.largeOutfitPreview}>
        <View style={styles.largeModelBody} />
        {slots.map((item, slotIndex) => {
          if (!item) return null;
          const isFirst = slotIndex === 0;
          return (
            <View key={`slot-${slotIndex}`} style={[styles.largeSlot, { top: slotIndex * 70 + 25 }]}>
              <Image source={{ uri: item.uri }} style={isFirst ? styles.largeFaceImage : styles.largeOverlayItem} resizeMode="cover" />
            </View>
          );
        })}
      </View>
    );
  };

  const WeatherBadge = ({ date }: { date: string }) => {
    const wx = weatherByDate[date];
    if (!wx) return null;
    return (
      <View style={{ alignItems: "center", marginTop: 6 }}>
        <Ionicons name={iconToIonicon(wx.icon)} size={18} color={colorFor(wx.icon)} />
        <Text style={[{ fontSize: 11, marginTop: 2, fontWeight: "600" }, { color: colors.text }]}>
          {Math.round(toFahrenheit(wx.tMax))}° / {Math.round(toFahrenheit(wx.tMin))}°
        </Text>
      </View>
    );
  };

  const WeatherDetail = ({ date }: { date: string }) => {
    const wx = weatherByDate[date];
    if (!wx) return null;
    return (
      <View style={[styles.weatherDetailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.weatherDetailHeader}>
          <View style={[styles.weatherIconContainer, { backgroundColor: `${colorFor(wx.icon)}15` }]}>
            <Ionicons name={iconToIonicon(wx.icon)} size={36} color={colorFor(wx.icon)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.weatherDetailTemp, { color: colors.text }]}>
              {Math.round(toFahrenheit(wx.tMax))}° / {Math.round(toFahrenheit(wx.tMin))}°F
            </Text>
            <Text style={[styles.weatherDetailSummary, { color: colors.textSecondary }]}>{wx.summary}</Text>
          </View>
        </View>
        
        <View style={styles.weatherDetailGrid}>
          <View style={[styles.weatherDetailItem, { backgroundColor: colors.card }]}>
            <Ionicons name="water" size={16} color="#4A90E2" />
            <Text style={[styles.weatherDetailLabel, { color: colors.textSecondary }]}>Humidity</Text>
            <Text style={[styles.weatherDetailValue, { color: colors.text }]}>{Math.round(wx.humidity ?? 0)}%</Text>
          </View>
          <View style={[styles.weatherDetailItem, { backgroundColor: colors.card }]}>
            <Ionicons name="rainy" size={16} color="#607D8B" />
            <Text style={[styles.weatherDetailLabel, { color: colors.textSecondary }]}>Precip</Text>
            <Text style={[styles.weatherDetailValue, { color: colors.text }]}>{Math.round((wx.pop ?? 0) * 100)}%</Text>
          </View>
          <View style={[styles.weatherDetailItem, { backgroundColor: colors.card }]}>
            <Ionicons name="speedometer" size={16} color="#9E9E9E" />
            <Text style={[styles.weatherDetailLabel, { color: colors.textSecondary }]}>Wind</Text>
            <Text style={[styles.weatherDetailValue, { color: colors.text }]}>{Math.round(wx.windSpeed ?? 0)} mph</Text>
          </View>
          <View style={[styles.weatherDetailItem, { backgroundColor: colors.card }]}>
            <Ionicons name="thermometer" size={16} color="#FF6B35" />
            <Text style={[styles.weatherDetailLabel, { color: colors.textSecondary }]}>Feels</Text>
            <Text style={[styles.weatherDetailValue, { color: colors.text }]}>{Math.round(toFahrenheit(wx.feelsLike ?? wx.tMax))}°</Text>
          </View>
        </View>
      </View>
    );
  };

  const outfitDates = new Set(events.map((e) => e.date));
  const combinedMarks: any = {};
  Object.keys(markedDates).forEach((k) => (combinedMarks[k] = markedDates[k]));
  outfitDates.forEach((d) => {
    combinedMarks[d] = { ...(combinedMarks[d] || {}), marked: true, dots: [{ key: "outfit", color: "#22c55e", selectedDotColor: "#16a34a" }] };
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.welcomeSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.greetingText, { color: colors.textSecondary }]}>{getGreeting()},</Text>
          <Text style={[styles.nameText, { color: colors.text }]}>{userName}! 👋</Text>
          
          {todayWeather && currentAdvice && (
            <View style={[styles.weatherCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.weatherHeader}>
                <View>
                  {locationLabel && (
                    <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                      <Ionicons name="location" size={14} color={colors.textSecondary} /> {locationLabel}
                    </Text>
                  )}
                  <Text style={[styles.tempText, { color: colors.text }]}>{Math.round(toFahrenheit(todayWeather.tMax))}°F</Text>
                  <Text style={[styles.conditionText, { color: colors.textSecondary }]}>{todayWeather.summary}</Text>
                </View>
                <View style={[styles.weatherBigIcon, { backgroundColor: `${currentAdvice.color}15` }]}>
                  <Ionicons name={currentAdvice.icon as any} size={56} color={currentAdvice.color} />
                </View>
              </View>
              
              <View style={[styles.adviceCard, { backgroundColor: colors.card, borderLeftColor: currentAdvice.color }]}>
                <View style={styles.adviceHeader}>
                  <Ionicons name="shirt" size={20} color={currentAdvice.color} />
                  <Text style={[styles.adviceTitle, { color: colors.text }]}>Today's Style Tip</Text>
                </View>
                <Text style={[styles.adviceText, { color: colors.textSecondary }]}>{currentAdvice.message}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Your Outfit Calendar</Text>
          <TouchableOpacity style={styles.viewModeButton} onPress={() => setViewMode(viewMode === "week" ? "month" : "week")}>
            <Ionicons name={viewMode === "week" ? "calendar" : "list"} size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {viewMode === "week" ? (
          <View style={styles.weekView}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekDaysContainer}>
              {currentWeek.map((dateString) => {
                const event = events.find((e) => e.date === dateString);
                const outfit = event ? savedOutfits[event.outfitCategory]?.find((o) => o.id === event.outfitId) : null;
                const selected = dateString === selectedDate;
                const today = dateString === getTodayDateString();
                
                return (
                  <TouchableOpacity 
                    key={dateString} 
                    style={[
                      styles.weekDayCard, 
                      { backgroundColor: colors.card, borderColor: colors.border },
                      selected && [styles.weekDayCardSelected, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]
                    ]} 
                    onPress={() => handleWeekDayPress(dateString)}
                  >
                    <View style={styles.weekDayHeader}>
                      <Text style={[styles.weekDayName, { color: colors.textSecondary }, today && [styles.todayText, { color: colors.primary }]]}>
                        {new Date(dateString + 'T12:00:00').toLocaleDateString("en-US", { weekday: "short" })}
                      </Text>
                      <Text style={[styles.weekDayNumber, { color: colors.text }, today && [styles.todayText, { color: colors.primary }]]}>
                        {new Date(dateString + 'T12:00:00').getDate()}
                      </Text>
                    </View>
                    <WeatherBadge date={dateString} />
                    {outfit ? (
                      <View style={styles.weekOutfitDisplay}>
                        {renderOutfitPreview(outfit, "compact")}
                        <Text style={[styles.weekOutfitCategory, { color: colors.primary }]} numberOfLines={1}>{event?.title}</Text>
                      </View>
                    ) : (
                      <View style={styles.weekEmptyOutfit}>
                        <Ionicons name="add-circle-outline" size={32} color={colors.textSecondary} />
                        <Text style={[styles.weekEmptyText, { color: colors.textSecondary }]}>No outfit</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedDate && (
              <View style={[styles.weekDetailSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.weekDetailTitle, { color: colors.text }]}>
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </Text>
                
                <WeatherDetail date={selectedDate} />
                
                <View style={styles.centerOutfitSection}>
                  {selectedDateEvent ? (
                    (() => {
                      const outfit = savedOutfits[selectedDateEvent.outfitCategory]?.find((o) => o.id === selectedDateEvent.outfitId);
                      return outfit ? (
                        <View style={styles.largeOutfitCard}>
                          <Text style={[styles.scheduledOutfitLabel, { color: colors.text }]}>Scheduled Outfit</Text>
                          {renderOutfitPreview(outfit, "large")}
                          <View style={styles.outfitActionsRow}>
                            <TouchableOpacity onPress={handleAddOutfit} style={[styles.changeOutfitBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                              <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
                              <Text style={[styles.changeOutfitBtnText, { color: colors.primary }]}>Change</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleDeleteEvent} style={[styles.deleteOutfitBtn, { backgroundColor: colors.error + "15", borderColor: colors.error }]}>
                              <Ionicons name="trash-outline" size={20} color={colors.error} />
                              <Text style={[styles.deleteOutfitBtnText, { color: colors.error }]}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null;
                    })()
                  ) : (
                    <TouchableOpacity style={[styles.weekAddButton, { backgroundColor: colors.primary }]} onPress={handleAddOutfit} disabled={saving}>
                      <Ionicons name="add-circle" size={28} color="#fff" />
                      <Text style={styles.weekAddButtonText}>{saving ? "Saving..." : "Schedule Outfit"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        ) : (
          <>
            <Calendar
              markingType="multi-dot"
              markedDates={combinedMarks}
              onDayPress={handleDayPress}
              theme={{
                calendarBackground: colors.card,
                textSectionTitleColor: colors.textSecondary,
                todayTextColor: colors.primary,
                dayTextColor: colors.text,
                textDisabledColor: colors.textSecondary,
                arrowColor: colors.primary,
                monthTextColor: colors.text,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: "#ffffff",
                dotColor: colors.primary,
                textDayFontWeight: "500",
                textMonthFontWeight: "700",
                textDayHeaderFontWeight: "600",
              }}
            />

            {selectedDate && (
              <View style={styles.selectedDateContainer}>
                <View style={styles.dateHeader}>
                  <Text style={[styles.selectedDateText, { color: colors.text }]}>
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </Text>
                </View>

                <WeatherDetail date={selectedDate} />

                {(() => {
                  const ev = events.find((e) => e.date === selectedDate);
                  if (!ev) {
                    return (
                      <View style={[styles.emptyEventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="shirt-outline" size={32} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No outfit scheduled</Text>
                        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAddOutfit}>
                          <Ionicons name="add" size={20} color="#fff" />
                          <Text style={styles.addButtonText}>Schedule Outfit</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  const outfit = savedOutfits[ev.outfitCategory]?.find((o) => o.id === ev.outfitId);
                  if (!outfit) return null;
                  return (
                    <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.eventHeader}>
                        <View>
                          <Text style={[styles.eventTitle, { color: colors.text }]}>{ev.title}</Text>
                          <Text style={[styles.eventSubtitle, { color: colors.textSecondary }]}>Outfit scheduled</Text>
                        </View>
                        <TouchableOpacity onPress={handleDeleteEvent} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                      {renderOutfitPreview(outfit, "compact")}
                      <TouchableOpacity style={[styles.changeOutfitBtnFull, { backgroundColor: colors.surface }]} onPress={handleAddOutfit}>
                        <Text style={[styles.changeOutfitBtnFullText, { color: colors.text }]}>Change Outfit</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => { setModalVisible(false); setExpandedCategory(null); }}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Outfit</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setExpandedCategory(null); }}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {Object.keys(savedOutfits).length === 0 ? (
                <View style={styles.modalEmptyState}>
                  <Ionicons name="shirt-outline" size={64} color={colors.textSecondary} />
                  <Text style={[styles.modalEmptyText, { color: colors.textSecondary }]}>No saved outfits</Text>
                  <Text style={[styles.modalEmptySubtext, { color: colors.textSecondary }]}>Create outfits in the Outfits tab first</Text>
                </View>
              ) : (
                Object.keys(savedOutfits).map((category) => (
                  <View key={category} style={[styles.categoryContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity style={styles.categoryHeader} onPress={() => setExpandedCategory(expandedCategory === category ? null : category)}>
                      <View>
                        <Text style={[styles.categoryTitle, { color: colors.text }]}>{category}</Text>
                        <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>{savedOutfits[category].length} outfits</Text>
                      </View>
                      <Ionicons name={expandedCategory === category ? "chevron-down" : "chevron-forward"} size={20} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {expandedCategory === category && (
                      <View style={styles.outfitList}>
                        {savedOutfits[category].map((outfit, idx) => (
                          <TouchableOpacity key={outfit.id} style={[styles.outfitItem, { backgroundColor: colors.surface }]} onPress={() => handleSelectOutfit(outfit)}>
                            <View style={styles.outfitThumbnails}>
                              {outfit.outfit.slice(0, 3).map((item, itemIdx) => (
                                <Image key={itemIdx} source={{ uri: item.uri }} style={styles.thumbnail} />
                              ))}
                            </View>
                            <View style={styles.outfitInfo}>
                              <Text style={[styles.outfitNumber, { color: colors.text }]}>Outfit {idx + 1}</Text>
                              <Text style={[styles.outfitItemCount, { color: colors.textSecondary }]}>{outfit.outfit.length} items</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  welcomeSection: { padding: 20, paddingTop: 16, borderBottomWidth: 1 },
  greetingText: { fontSize: 24, fontWeight: "600" },
  nameText: { fontSize: 32, fontWeight: "800", marginTop: 4, marginBottom: 16 },
  weatherCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  weatherHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  locationText: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  tempText: { fontSize: 36, fontWeight: "800", marginBottom: 2 },
  conditionText: { fontSize: 14, fontWeight: "500", textTransform: "capitalize" },
  weatherBigIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center" },
  adviceCard: { borderRadius: 12, padding: 12, borderLeftWidth: 4, marginTop: 12 },
  adviceHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  adviceTitle: { fontSize: 14, fontWeight: "700" },
  adviceText: { fontSize: 13, lineHeight: 20, fontWeight: "500" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  viewModeButton: { padding: 8 },
  weekView: { padding: 16 },
  weekDaysContainer: { gap: 8, marginBottom: 20, paddingHorizontal: 4 },
  weekDayCard: { width: 120, borderRadius: 12, padding: 8, borderWidth: 2, minHeight: 240 },
  weekDayCardSelected: { borderWidth: 2 },
  weekDayHeader: { alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  weekDayName: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  weekDayNumber: { fontSize: 20, fontWeight: "700" },
  todayText: {},
  weekOutfitDisplay: { flex: 1, alignItems: "center", justifyContent: "center" },
  weekOutfitCategory: { fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 8 },
  weekEmptyOutfit: { flex: 1, justifyContent: "center", alignItems: "center", opacity: 0.5 },
  weekEmptyText: { fontSize: 10, marginTop: 4 },
  compactOutfitPreview: { width: 80, height: 140, position: "relative", alignItems: "center" },
  compactModelBody: { width: 40, height: 80, backgroundColor: "#e8e8e8", borderRadius: 20, marginTop: 30 },
  compactSlot: { position: "absolute", alignItems: "center" },
  compactOverlayItem: { width: 50, height: 50, borderRadius: 4 },
  compactFaceImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: "#fff" },
  largeOutfitPreview: { width: 180, height: 400, position: "relative", alignItems: "center" },
  largeModelBody: { width: 90, height: 220, backgroundColor: "#e8e8e8", borderRadius: 45, marginTop: 80 },
  largeSlot: { position: "absolute", alignItems: "center" },
  largeOverlayItem: { width: 100, height: 100, borderRadius: 8 },
  largeFaceImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "#fff" },
  weekDetailSection: { borderRadius: 12, padding: 16, borderWidth: 1 },
  weekDetailTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  centerOutfitSection: { alignItems: "center", marginTop: 16 },
  largeOutfitCard: { alignItems: "center", width: "100%" },
  scheduledOutfitLabel: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
  outfitActionsRow: { flexDirection: "row", gap: 12, marginTop: 16, width: "100%", maxWidth: 400 },
  changeOutfitBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 2 },
  changeOutfitBtnText: { fontSize: 15, fontWeight: "700" },
  deleteOutfitBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 2 },
  deleteOutfitBtnText: { fontSize: 15, fontWeight: "700" },
  weatherDetailCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  weatherDetailHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  weatherIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center" },
  weatherDetailTemp: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  weatherDetailSummary: { fontSize: 13, textTransform: "capitalize", fontWeight: "600" },
  weatherDetailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weatherDetailItem: { width: "48%", alignItems: "center", padding: 10, borderRadius: 8 },
  weatherDetailLabel: { fontSize: 11, marginTop: 4, fontWeight: "600" },
  weatherDetailValue: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  weekAddButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, width: "100%", maxWidth: 300 },
  weekAddButtonText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  selectedDateContainer: { padding: 16 },
  dateHeader: { marginBottom: 16 },
  selectedDateText: { fontSize: 18, fontWeight: "700" },
  eventCard: { borderRadius: 12, padding: 16, borderWidth: 1, alignItems: "center" },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, width: "100%" },
  eventTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  eventSubtitle: { fontSize: 14 },
  deleteBtn: { padding: 8 },
  changeOutfitBtnFull: { padding: 14, borderRadius: 10, alignItems: "center", width: "100%", marginTop: 12 },
  changeOutfitBtnFullText: { fontSize: 16, fontWeight: "700" },
  emptyEventCard: { borderRadius: 12, padding: 32, alignItems: "center", borderWidth: 1 },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, marginTop: 12 },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end" },
  modalContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalContent: { padding: 16 },
  modalEmptyState: { alignItems: "center", paddingVertical: 48 },
  modalEmptyText: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  modalEmptySubtext: { fontSize: 14 },
  categoryContainer: { borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  categoryTitle: { fontSize: 18, fontWeight: "700" },
  categoryCount: { fontSize: 13, marginTop: 2 },
  outfitList: { padding: 8 },
  outfitItem: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, marginBottom: 8 },
  outfitThumbnails: { flexDirection: "row", gap: 4, marginRight: 12 },
  thumbnail: { width: 50, height: 50, borderRadius: 6, backgroundColor: "#e0e0e0" },
  outfitInfo: { flex: 1 },
  outfitNumber: { fontSize: 16, fontWeight: "600" },
  outfitItemCount: { fontSize: 12, marginTop: 2 },
});
