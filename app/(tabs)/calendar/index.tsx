// app/(tabs)/calendar/index.tsx
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, Modal, TextInput, Image, StyleSheet, ActivityIndicator } from "react-native";
import { addMonths, getMonthMatrix, toDateKey } from "../../../lib/date";
import { useMonthEntries, useOutfits, saveCalendarEntry, clearCalendarEntry } from "../../../hooks/useCalendar";

import { useRecommendations } from "hooks/useRecommendations";
import { useCloset } from "app/ClosetProvider";
import RecommendationList from "../../../components/RecommendationList";


const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen() {
  const [viewDate, setViewDate] = useState(new Date());
  const monthDays = useMemo(() => getMonthMatrix(viewDate, 0), [viewDate]);
  const entries = useMonthEntries(viewDate);
  const allOutfits = useOutfits();

  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");

const safeDate = selectedDate ?? new Date();
const {loading, desiredTags, outfits: recOutfits} = useRecommendations(safeDate, 5);
const {logWearEvent} = useCloset();

 const dayLabel = useMemo(
  () => (selectedDate ? selectedDate.toDateString() : ""),
  [selectedDate]
 );


  const visibleMonth = viewDate.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  function openDay(d: Date) {
    setSelectedDate(d);
    const dk = toDateKey(d);
    setNote(entries[dk]?.note ?? "");
    setDayModalOpen(true);
  }

  const filteredOutfits = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return allOutfits;
    return allOutfits.filter(
      (o) =>
        o.name.toLowerCase().includes(f) ||
        (o.tags ?? []).some((t) => t.toLowerCase().includes(f))
    );
  }, [filter, allOutfits]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 18 }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => setViewDate(addMonths(viewDate, -1))} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{visibleMonth}</Text>
        <Pressable onPress={() => setViewDate(addMonths(viewDate, 1))} style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      {/* Weekday row */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekCell}>
            {w}
          </Text>
        ))}
      </View>

      {/* Month grid */}
      <View style={styles.grid}>
        {monthDays.map((d, i) => {
          const dk = toDateKey(d);
          const isThisMonth = d.getMonth() === viewDate.getMonth();
          const hasOutfit = !!entries[dk]?.outfitId;

          return (
            <Pressable
              key={dk + i}
              onPress={() => openDay(d)}
              style={[
                styles.dayCell,
                !isThisMonth && styles.dayCellMuted,
                hasOutfit && styles.dayCellWithOutfit,
              ]}
            >
              <Text style={[styles.dayNum, !isThisMonth && styles.muted]}>
                {d.getDate()}
              </Text>
              {hasOutfit && (
                <View style={styles.dot} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Day modal */}
      <Modal visible={dayModalOpen} transparent animationType="slide" onRequestClose={() => setDayModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedDate && (
              <>
                <Text style={styles.modalTitle}>
                  {selectedDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>

                <TextInput
                  placeholder="Optional note (e.g., Interview)"
                  value={note}
                  onChangeText={setNote}
                  style={styles.input}
                />

      {/* --- Recommendations block (from calendar → occasion tags) --- */}
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.sectionLabel}>Recommended for this day</Text>
          <Text style={{ color: "#666", marginBottom: 6 }}>
            Occasion tags: {desiredTags.length ? desiredTags.join(", ") : "—"}
          </Text>

          {loading ? (
            <View style={{ paddingVertical: 8 }}>
              <ActivityIndicator />
            </View>
                ) : recOutfits.length ? (
                  <RecommendationList
                    outfits={recOutfits}
                    onWear={async (id) => {
                      if (!selectedDate) return;
                      // 1) Log the wear event (improves future recs)
                      await logWearEvent(id, { when: selectedDate });
                      // 2) Save to calendar for this day (so the grid shows the dot)
                      const dk = toDateKey(selectedDate);
                      await saveCalendarEntry(dk, id, note);
                      setDayModalOpen(false);
                    }}
                  />
                ) : (
                  <Text style={{ color: "#666" }}>
                    No matching saved outfits for these tags.
                  </Text>
                )}
              </View>

                <Text style={styles.sectionLabel}>Pick an outfit</Text>
                <TextInput
                  placeholder="Search by name or tag…"
                  value={filter}
                  onChangeText={setFilter}
                  style={styles.input}
                />

                <FlatList
                  data={filteredOutfits}
                  keyExtractor={(o) => o.id}
                  style={{ maxHeight: 240, marginBottom: 12 }}
                  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                  renderItem={({ item }) => {
                    return (
                      <Pressable
                        onPress={async () => {
                          const dk = toDateKey(selectedDate);
                          await saveCalendarEntry(dk, item.id, note);
                          setDayModalOpen(false);
                        }}
                        style={styles.outfitRow}
                      >
                        {item.thumbnailUrl ? (
                          <Image
                            source={{ uri: item.thumbnailUrl }}
                            style={styles.thumb}
                          />
                        ) : (
                          <View style={[styles.thumb, styles.thumbPlaceholder]}>
                            <Text>👕</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.outfitName}>{item.name}</Text>
                          <Text style={styles.tags} numberOfLines={1}>
                            {(item.tags ?? []).join(" · ")}
                          </Text>
                        </View>
                        <Text style={styles.usage}>worn {item.usageCount ?? 0}×</Text>
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.muted}>No outfits found.</Text>
                  }
                />

                {/* Actions */}
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => setDayModalOpen(false)}
                    style={[styles.btn, styles.btnGhost]}
                  >
                    <Text style={styles.btnGhostText}>Close</Text>
                  </Pressable>

                  <Pressable
                    onPress={async () => {
                      const dk = toDateKey(selectedDate);
                      await saveCalendarEntry(dk, null, note);
                      setDayModalOpen(false);
                    }}
                    style={[styles.btn, styles.btnWarn]}
                  >
                    <Text style={styles.btnText}>Clear outfit</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700" },
  navBtn: { padding: 8, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.05)" },
  navText: { fontSize: 18, fontWeight: "700" },

  weekRow: { flexDirection: "row", marginTop: 12, marginBottom: 6 },
  weekCell: { flex: 1, textAlign: "center", fontSize: 12, color: "#888" },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  dayCellMuted: { backgroundColor: "rgba(0,0,0,0.02)" },
  dayCellWithOutfit: { backgroundColor: "rgba(56,189,248,0.10)" }, // subtle cyan tint
  dayNum: { fontSize: 14, fontWeight: "600" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#06b6d4", marginTop: 4 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "white",
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "90%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  sectionLabel: { fontWeight: "700", marginTop: 4, marginBottom: 6 },

  outfitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#eee" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  outfitName: { fontWeight: "700" },
  tags: { color: "#666", fontSize: 12, marginTop: 2 },
  usage: { fontSize: 12, color: "#333", marginLeft: 6 },

  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, gap: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  btnGhost: { backgroundColor: "transparent" },
  btnGhostText: { color: "#333", fontWeight: "600" },
  btnWarn: { backgroundColor: "#ef4444" },
  btnText: { color: "white", fontWeight: "700" },

  muted: { color: "#888" },
});
