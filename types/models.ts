import type { Timestamp as FirebaseTimestamp } from "firebase/firestore";

export type Outfit = {
  id: string;
  name: string;
  tags: string[];
  itemIds: string[];
  thumbnailUrl?: string;
  usageCount: number;
  lastWorn?: FirebaseTimestamp;
};

export type WearEvent = {
  id?: string;
  outfitId: string;
  date: FirebaseTimestamp;
  eventId?: string;
  feedback?: number; // -1..1
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: FirebaseTimestamp;
  end?: FirebaseTimestamp;
  location?: string;
  notes?: string;
};
