// types/app.d.ts
export type FirebaseTimestamp = any; // from Firestore 'Timestamp'

export type CalendarEntry = {
  date: string;              // "YYYY-MM-DD" (local date key)
  outfitId?: string | null;
  outfitName?: string | null;
  outfitTags?: string[];
  note?: string;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
};

export type Outfit = {
  id: string;
  name: string;
  tags: string[];
  itemIds: string[];
  thumbnailUrl?: string;
  usageCount: number;
  lastWorn?: FirebaseTimestamp;
};
