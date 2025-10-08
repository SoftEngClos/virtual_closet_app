// hooks/useCalendar.ts
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  getDoc,
  serverTimestamp,
  deleteField,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "firebaseConfig";
import { startOfMonth, endOfMonth, toDateKey } from "../lib/date";
import type { CalendarEntry, Outfit } from "../types/app";

// Collection path builders
const userRoot = (uid: string) => `users/${uid}`;
const outfitsPath = (uid: string) => `${userRoot(uid)}/outfits`;
const calendarPath = (uid: string) => `${userRoot(uid)}/calendarEntries`;
const tagAnalyticsPath = (uid: string) => `${userRoot(uid)}/analytics/tagUsage`;

export function useMonthEntries(viewDate: Date) {
  const [entries, setEntries] = useState<Record<string, CalendarEntry>>({});
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const start = toDateKey(startOfMonth(viewDate));
    const end = toDateKey(endOfMonth(viewDate));
    const ref = collection(db, calendarPath(uid));

    // We store docs with id = "YYYY-MM-DD", so we can simply listen to the month range.
    const unsub = onSnapshot(
      query(ref, orderBy("__name__")),
      (snap) => {
        const next: Record<string, CalendarEntry> = {};
        snap.docs.forEach((d) => {
          const id = d.id;
          if (id >= start && id <= end) {
            next[id] = { ...(d.data() as CalendarEntry) };
          }
        });
        setEntries(next);
      },
      (e) => console.warn("calendar listen error", e)
    );
    return unsub;
  }, [uid, viewDate]);

  return entries;
}

export function useOutfits() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const ref = collection(db, outfitsPath(uid));
    const unsub = onSnapshot(
      query(ref, orderBy("name")),
      (snap) => {
        setOutfits(
          snap.docs.map((d) => {
    // Take all fields except a possible 'id' that might exist in Firestore
    const data = d.data() as Omit<Outfit, "id">;
    return { id: d.id, ...data };
  })
);
      },
      (e) => console.warn("outfits listen error", e)
    );
    return unsub;
  }, [uid]);

  return outfits;
}

export async function saveCalendarEntry(
  dateKey: string,
  outfitId: string | null,
  note?: string
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");

  const entryRef = doc(db, calendarPath(uid), dateKey);

  if (!outfitId) {
    // clear outfit fields but keep note if provided
    await setDoc(
      entryRef,
      {
        date: dateKey,
        outfitId: null,
        outfitName: null,
        outfitTags: [],
        note: note ?? deleteField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  // Snapshot the outfit name & tags for history
  const outfitRef = doc(db, outfitsPath(uid), outfitId);
  const outfitSnap = await getDoc(outfitRef);
  if (!outfitSnap.exists()) throw new Error("Outfit not found");
  const outfit = outfitSnap.data() as Outfit;

  await setDoc(
    entryRef,
    {
      date: dateKey,
      outfitId,
      outfitName: outfit.name,
      outfitTags: outfit.tags ?? [],
      note: note ?? deleteField(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // NOTE: We rely on Cloud Function (below) to increment/decrement:
  // - outfits/{id}.usageCount
  // - analytics/tagUsage/{tag}.count
  // - outfits/{id}.lastWorn
}

export async function clearCalendarEntry(dateKey: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");

  const entryRef = doc(db, calendarPath(uid), dateKey);
  await updateDoc(entryRef, {
    outfitId: null,
    outfitName: null,
    outfitTags: [],
    updatedAt: serverTimestamp(),
  });
}
