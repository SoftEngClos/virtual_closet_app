import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function CalendarScreen() {
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<OutfitCategories>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedDateEvent, setSelectedDateEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentWeek, setCurrentWeek] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
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
        marked: true,
        dotColor: "#0066ff",
        selected: event.date === selectedDate,
        selectedColor: event.date === selectedDate ? "#0066ff" : undefined,
      };
    });

    if (selectedDate && !marked[selectedDate]) {
      marked[selectedDate] = {
        selected: true,
        selectedColor: "#0066ff",
      };
    }

    setMarkedDates(marked);
  }, [events, selectedDate]);

  const getTodayDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDateString = (dateString: string): string => {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      week.push(`${y}-${m}-${d}`);
    }
    
    setCurrentWeek(week);
  };

  const loadEvents = async (uid: string) => {
    try {
      const q = query(collection(db, "calendar"), where("uid", "==", uid));
      const snapshot = await getDocs(q);
      const loadedEvents: CalendarEvent[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        loadedEvents.push({
          id: docSnap.id,
          date: data.date,
          outfitId: data.outfitId,
          outfitCategory: data.outfitCategory,
          title: data.title,
          uid: data.uid,
        });
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
      const existingEvent = events.find((e) => e.date === selectedDate);

      if (existingEvent) {
        await updateDoc(doc(db, "calendar", existingEvent.id), {
          outfitId: outfit.id,
          outfitCategory: outfit.category,
          title: outfit.category,
        });
        Alert.alert("Success", "Outfit updated for this date!");
      } else {
        await addDoc(collection(db, "calendar"), {
          uid: user.uid,
          date: selectedDate,
          outfitId: outfit.id,
          outfitCategory: outfit.category,
          title: outfit.category,
          createdAt: new Date().toISOString(),
        });
        Alert.alert("Success", "Outfit scheduled for this date!");
      }

      await loadEvents(user.uid);
      setModalVisible(false);
      setExpandedCategory(null);
    } catch (err) {
      console.error("Error scheduling outfit:", err);
      Alert.alert("Error", "Failed to schedule outfit. Please try again.");
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedDateEvent || !user) return;

    Alert.alert(
      "Remove Outfit",
      "Remove the outfit scheduled for this day?",
      [
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
      ]
    );
  };

  const getOutfitForDate = (date: string): CalendarEvent | undefined => {
    return events.find((e) => e.date === date);
  };

  const getOutfitDetails = (outfitId: string, category: string): SavedOutfit | undefined => {
    return savedOutfits[category]?.find((o) => o.id === outfitId);
  };

  const getDayName = (dateString: string): string => {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const getDayNumber = (dateString: string): string => {
    const [, , day] = dateString.split("-");
    return day;
  };

  const isToday = (dateString: string): boolean => {
    return dateString === getTodayDateString();
  };

  // Render outfit preview preserving exact slot positions
  const renderOutfitPreview = (outfit: SavedOutfit, compact: boolean = false) => {
    // Create array of 5 slots, only filled where items exist
    const slots: (OutfitItem | null)[] = [null, null, null, null, null];
    
    outfit.outfit.forEach((item) => {
      const slotIndex = item.slotIndex !== undefined ? item.slotIndex : 0;
      if (slotIndex >= 0 && slotIndex < 5) {
        slots[slotIndex] = item;
      }
    });

    if (compact) {
      // Compact version for week view - show first 3 non-empty slots
      const visibleItems = slots.filter(item => item !== null).slice(0, 3);
      
      return (
        <View style={styles.compactOutfitPreview}>
          <View style={styles.compactModelBody} />
          {visibleItems.map((item, displayIndex) => {
            if (!item) return null;
            const actualSlotIndex = item.slotIndex !== undefined ? item.slotIndex : 0;
            const isFirstSlot = actualSlotIndex === 0;
            
            return (
              <View
                key={`slot-${actualSlotIndex}`}
                style={[styles.compactSlot, { top: displayIndex * 35 + 15 }]}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={isFirstSlot ? styles.compactFaceImage : styles.compactOverlayItem}
                  resizeMode="cover"
                />
              </View>
            );
          })}
        </View>
      );
    }

    // Full version for detail view - show all slots in their exact positions
    return (
      <View style={styles.outfitPreviewContainer}>
        <View style={styles.miniModelContainer}>
          <View style={styles.miniModelBody} />
          {slots.map((item, slotIndex) => {
            if (!item) return null;
            const isFirstSlot = slotIndex === 0;
            
            return (
              <View
                key={`slot-${slotIndex}`}
                style={[styles.miniSlot, { top: slotIndex * 50 + 20 }]}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={isFirstSlot ? styles.miniFaceImage : styles.miniOverlayItem}
                  resizeMode="cover"
                />
              </View>
            );
          })}
        </View>
        <Text style={styles.itemCount}>{outfit.outfit.length} items</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Outfit Calendar</Text>
        <TouchableOpacity
          style={styles.viewModeButton}
          onPress={() => setViewMode(viewMode === "week" ? "month" : "week")}
        >
          <Ionicons
            name={viewMode === "week" ? "calendar" : "list"}
            size={24}
            color="#0066ff"
          />
        </TouchableOpacity>
      </View>

      <ScrollView>
        {viewMode === "week" ? (
          <View style={styles.weekView}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekDaysContainer}
            >
              {currentWeek.map((dateString) => {
                const event = getOutfitForDate(dateString);
                const outfit = event
                  ? getOutfitDetails(event.outfitId, event.outfitCategory)
                  : null;
                const selected = dateString === selectedDate;
                const today = isToday(dateString);

                return (
                  <TouchableOpacity
                    key={dateString}
                    style={[
                      styles.weekDayCard,
                      selected && styles.weekDayCardSelected,
                    ]}
                    onPress={() => handleWeekDayPress(dateString)}
                  >
                    <View style={styles.weekDayHeader}>
                      <Text
                        style={[
                          styles.weekDayName,
                          today && styles.todayText,
                        ]}
                      >
                        {getDayName(dateString)}
                      </Text>
                      <Text
                        style={[
                          styles.weekDayNumber,
                          today && styles.todayText,
                        ]}
                      >
                        {getDayNumber(dateString)}
                      </Text>
                    </View>

                    {outfit ? (
                      <View style={styles.weekOutfitContainer}>
                        {renderOutfitPreview(outfit, true)}
                        <Text style={styles.weekOutfitCategory}>
                          {event?.title}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.weekEmptyOutfit}>
                        <Ionicons name="add-circle-outline" size={32} color="#ccc" />
                        <Text style={styles.weekEmptyText}>No outfit</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected Day Details in Week View */}
            {selectedDate && (
              <View style={styles.weekDetailSection}>
                <Text style={styles.weekDetailTitle}>
                  {formatDateString(selectedDate)}
                </Text>

                {selectedDateEvent ? (
                  <View style={styles.eventCard}>
                    <View style={styles.eventHeader}>
                      <View>
                        <Text style={styles.eventTitle}>{selectedDateEvent.title}</Text>
                        <Text style={styles.eventSubtitle}>Outfit scheduled</Text>
                      </View>
                      <TouchableOpacity onPress={handleDeleteEvent} style={styles.deleteBtn}>
                        <Ionicons name="trash-outline" size={20} color="#ff4757" />
                      </TouchableOpacity>
                    </View>

                    {(() => {
                      const outfit = getOutfitDetails(
                        selectedDateEvent.outfitId,
                        selectedDateEvent.outfitCategory
                      );
                      if (outfit) {
                        return renderOutfitPreview(outfit, false);
                      }
                      return null;
                    })()}

                    <TouchableOpacity
                      style={styles.changeOutfitBtn}
                      onPress={handleAddOutfit}
                    >
                      <Text style={styles.changeOutfitBtnText}>Change Outfit</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.weekAddButton}
                    onPress={handleAddOutfit}
                  >
                    <Ionicons name="add-circle" size={24} color="#fff" />
                    <Text style={styles.weekAddButtonText}>Schedule Outfit</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ) : (
          <>
            <Calendar
              onDayPress={handleDayPress}
              markedDates={markedDates}
              theme={{
                todayTextColor: "#0066ff",
                arrowColor: "#0066ff",
                selectedDayBackgroundColor: "#0066ff",
                selectedDayTextColor: "#ffffff",
                dotColor: "#0066ff",
                textDayFontWeight: "500",
                textMonthFontWeight: "700",
                textDayHeaderFontWeight: "600",
              }}
            />

            {selectedDate && (
              <View style={styles.selectedDateContainer}>
                <View style={styles.dateHeader}>
                  <Text style={styles.selectedDateText}>
                    {formatDateString(selectedDate)}
                  </Text>
                </View>

                {selectedDateEvent ? (
                  <View style={styles.eventCard}>
                    <View style={styles.eventHeader}>
                      <View>
                        <Text style={styles.eventTitle}>{selectedDateEvent.title}</Text>
                        <Text style={styles.eventSubtitle}>Outfit scheduled</Text>
                      </View>
                      <TouchableOpacity onPress={handleDeleteEvent} style={styles.deleteBtn}>
                        <Ionicons name="trash-outline" size={20} color="#ff4757" />
                      </TouchableOpacity>
                    </View>

                    {(() => {
                      const outfit = getOutfitDetails(
                        selectedDateEvent.outfitId,
                        selectedDateEvent.outfitCategory
                      );
                      if (outfit) {
                        return renderOutfitPreview(outfit, false);
                      }
                      return null;
                    })()}

                    <TouchableOpacity
                      style={styles.changeOutfitBtn}
                      onPress={handleAddOutfit}
                    >
                      <Text style={styles.changeOutfitBtnText}>Change Outfit</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emptyEventCard}>
                    <Ionicons name="calendar-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>No outfit scheduled</Text>
                    <TouchableOpacity style={styles.addButton} onPress={handleAddOutfit}>
                      <Ionicons name="add" size={20} color="#fff" />
                      <Text style={styles.addButtonText}>Schedule Outfit</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Outfit Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          setExpandedCategory(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Outfit</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setExpandedCategory(null);
                }}
              >
                <Ionicons name="close" size={28} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {Object.keys(savedOutfits).length === 0 ? (
                <View style={styles.modalEmptyState}>
                  <Ionicons name="shirt-outline" size={64} color="#ccc" />
                  <Text style={styles.modalEmptyText}>No saved outfits</Text>
                  <Text style={styles.modalEmptySubtext}>
                    Create outfits in the Outfits tab first
                  </Text>
                </View>
              ) : (
                Object.keys(savedOutfits).map((category) => (
                  <View key={category} style={styles.categoryContainer}>
                    <TouchableOpacity
                      style={styles.categoryHeader}
                      onPress={() =>
                        setExpandedCategory(
                          expandedCategory === category ? null : category
                        )
                      }
                    >
                      <View>
                        <Text style={styles.categoryTitle}>{category}</Text>
                        <Text style={styles.categoryCount}>
                          {savedOutfits[category].length} outfits
                        </Text>
                      </View>
                      <Ionicons
                        name={
                          expandedCategory === category
                            ? "chevron-down"
                            : "chevron-forward"
                        }
                        size={20}
                        color="#999"
                      />
                    </TouchableOpacity>

                    {expandedCategory === category && (
                      <View style={styles.outfitList}>
                        {savedOutfits[category].map((outfit, idx) => (
                          <TouchableOpacity
                            key={outfit.id}
                            style={styles.outfitItem}
                            onPress={() => handleSelectOutfit(outfit)}
                          >
                            <View style={styles.outfitThumbnails}>
                              {outfit.outfit.slice(0, 3).map((item, itemIdx) => (
                                <Image
                                  key={itemIdx}
                                  source={{ uri: item.uri }}
                                  style={styles.thumbnail}
                                />
                              ))}
                            </View>
                            <View style={styles.outfitInfo}>
                              <Text style={styles.outfitNumber}>
                                Outfit {idx + 1}
                              </Text>
                              <Text style={styles.outfitItemCount}>
                                {outfit.outfit.length} items
                              </Text>
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
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  viewModeButton: {
    padding: 8,
  },
  weekView: {
    padding: 16,
  },
  weekDaysContainer: {
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  weekDayCard: {
    width: 120,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
    borderColor: "#eee",
    minHeight: 220,
  },
  weekDayCardSelected: {
    borderColor: "#0066ff",
    backgroundColor: "#f0f7ff",
  },
  weekDayHeader: {
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  todayText: {
    color: "#0066ff",
  },
  weekOutfitContainer: {
    flex: 1,
    alignItems: "center",
  },
  weekOutfitCategory: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0066ff",
    textAlign: "center",
    marginTop: 8,
  },
  weekEmptyOutfit: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.5,
  },
  weekEmptyText: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
  },
  // Compact outfit preview for week view
  compactOutfitPreview: {
    width: 80,
    height: 140,
    position: "relative",
    alignItems: "center",
  },
  compactModelBody: {
    width: 40,
    height: 80,
    backgroundColor: "#e8e8e8",
    borderRadius: 20,
    marginTop: 30,
  },
  compactSlot: {
    position: "absolute",
    alignItems: "center",
  },
  compactOverlayItem: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  compactFaceImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#fff",
  },
  // Mini outfit preview for detail view
  outfitPreviewContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  miniModelContainer: {
    width: 120,
    height: 280,
    position: "relative",
    alignItems: "center",
    marginBottom: 8,
  },
  miniModelBody: {
    width: 60,
    height: 150,
    backgroundColor: "#e8e8e8",
    borderRadius: 30,
    marginTop: 50,
  },
  miniSlot: {
    position: "absolute",
    alignItems: "center",
  },
  miniOverlayItem: {
    width: 70,
    height: 70,
    borderRadius: 6,
  },
  miniFaceImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: "#fff",
  },
  itemCount: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
  },
  weekDetailSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  weekDetailTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  weekAddButton: {
    backgroundColor: "#0066ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 10,
  },
  weekAddButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  selectedDateContainer: {
    padding: 16,
  },
  dateHeader: {
    marginBottom: 16,
  },
  selectedDateText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  eventCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    width: "100%",
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  eventSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  deleteBtn: {
    padding: 8,
  },
  changeOutfitBtn: {
    backgroundColor: "#f0f0f0",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  changeOutfitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  emptyEventCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginTop: 12,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: "#0066ff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  modalContent: {
    padding: 16,
  },
  modalEmptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  modalEmptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  modalEmptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
  },
  categoryContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  categoryCount: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },
  outfitList: {
    padding: 8,
  },
  outfitItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    marginBottom: 8,
  },
  outfitThumbnails: {
    flexDirection: "row",
    gap: 4,
    marginRight: 12,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: "#e0e0e0",
  },
  outfitInfo: {
    flex: 1,
  },
  outfitNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  outfitItemCount: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
});
