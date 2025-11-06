// functions/src/index.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// Initialize Admin SDK once
initializeApp();
const db = getFirestore();

type CalendarEntry = {
  date?: string;           // "YYYY-MM-DD"
  outfitId?: string | null;
  outfitTags?: string[];
};

export const onCalendarEntryWrite = onDocumentWritten(
  "users/{uid}/calendarEntries/{date}",
  async (event) => {
    const { uid, date } = event.params as { uid: string; date: string };

    // before/after may be undefined on create/delete
    const before = event.data?.before.exists ? (event.data!.before.data() as CalendarEntry) : undefined;
    const after  = event.data?.after.exists  ? (event.data!.after.data()  as CalendarEntry) : undefined;

    const prevOutfitId = before?.outfitId ?? null;
    const prevTags     = before?.outfitTags ?? [];
    const newOutfitId  = after?.outfitId ?? null;
    const newTags      = after?.outfitTags ?? [];

    // If nothing relevant changed, bail early
    const changed =
      prevOutfitId !== newOutfitId ||
      JSON.stringify(prevTags) !== JSON.stringify(newTags);
    if (!changed) return;

    const batch = db.batch();
    const outfitRef = (id: string) => db.doc(`users/${uid}/outfits/${id}`);
    const tagRef    = (tag: string) => db.doc(`users/${uid}/analytics/tagUsage/${tag}`);

    const inc = FieldValue.increment(1);
    const dec = FieldValue.increment(-1);

    // Decrement old outfit & tags if outfit changed/removed
    if (prevOutfitId && prevOutfitId !== newOutfitId) {
      batch.set(outfitRef(prevOutfitId), { usageCount: dec }, { merge: true });
      prevTags.forEach((t) => {
        batch.set(tagRef(t), { tag: t, count: dec }, { merge: true });
      });
    }

    // Increment new outfit & tags if set
    if (newOutfitId) {
      batch.set(
        outfitRef(newOutfitId),
        {
          usageCount: inc,
          lastWorn: Timestamp.fromDate(new Date(date)) // date is "YYYY-MM-DD"
        },
        { merge: true }
      );
      newTags.forEach((t) => {
        batch.set(tagRef(t), { tag: t, count: inc }, { merge: true });
      });
    }

    await batch.commit();
  }
);
