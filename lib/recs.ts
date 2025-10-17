import {
  collection, getDocs, getFirestore,
} from "firebase/firestore";
import { tagsFromEventTitle } from "./calendarTags";
import type { Outfit } from "../types/models";

export type RecContext = {
  desiredTags: string[];
  avoidOutfitIds?: Set<string>;
  today: Date;
};

type OutfitLite = Omit<Outfit, "lastWorn" > & { 
    lastWorn?: Date;
};



function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function toDateMaybe(t?: any): Date | undefined {
  if (!t) return undefined;
  if (t instanceof Date) return t;
  if (typeof t?.toDate === "function") return t.toDate();
  return undefined;
}

function jaccard(a: string[], b: string[]) {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.max(1, A.size + B.size - inter);
}
function daysSince(d?: Date, base = new Date()): number {
  if (!d) return 365;
  const ms = base.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
function recencyBoost(d?: Date, base = new Date()) {
  const days = daysSince(d, base);
  if (days <= 2) return -0.8;
  if (days <= 7) return -0.3;
  if (days >= 45) return +0.35;
  if (days >= 21) return +0.2;
  return 0;
}
function feedbackBoost(avgFeedback?: number) {
  if (avgFeedback == null) return 0;
  return 0.25 * avgFeedback; // -0.25..+0.25
}

export function scoreOutfit(
  outfit: OutfitLite,
  ctx: RecContext,
  avgFeedback?: number
): number {
  const tagMatch = jaccard(outfit.tags ?? [], ctx.desiredTags);
  const diversity = recencyBoost(toDateMaybe(outfit.lastWorn), ctx.today);
  const like = feedbackBoost(avgFeedback);
  const novelty = (outfit.usageCount ?? 0) === 0 ? 0.2 : 0;
  const avoid = ctx.avoidOutfitIds?.has(outfit.id) ? -1 : 0;

  const w = { tag: 0.7, diversity: 0.5, like: 0.3, novelty: 0.2, avoid: 1.0 };
  return (
    w.tag * tagMatch +
    w.diversity * diversity +
    w.like * like +
    w.novelty * novelty +
    (avoid < 0 ? -w.avoid : 0)
  );
}

export async function recommendOutfitsForDate(
  date = new Date(),
  topK = 5
) {
  const db = getFirestore();

  // 1) Gather desired tags from that day's events
  const eventsSnap = await getDocs(collection(db, "events"));
  const desired = new Set<string>();
  eventsSnap.forEach((d) => {
    const ev = d.data() as any;
    const start = toDateMaybe(ev.start);
    if (start && sameDay(start, date)) {
      tagsFromEventTitle(ev.title).forEach((t) => desired.add(t));
    }
  });
  if (desired.size === 0) desired.add("casual");

  // 2) Load outfits
  const outfitsSnap = await getDocs(collection(db, "outfits"));
  const outfits: OutfitLite[] = [];
  outfitsSnap.forEach((doc) => {
    const d = doc.data() as any;
    outfits.push({
      id: d.id ?? doc.id,
      name: d.name,
      tags: d.tags ?? [],
      usageCount: d.usageCount ?? 0,
      lastWorn: toDateMaybe(d.lastWorn),
      itemIds: d.itemIds ?? [],
      thumbnailUrl: d.thumbnailUrl,
    });
  });

  // 3) Avoid yesterday (optional: you can query wearEvents to make this accurate)
  const avoid = new Set<string>();
  // (Later: fetch wearEvents where date == yesterday and fill avoid with outfitId)

  const ctx: RecContext = { desiredTags: [...desired], avoidOutfitIds: avoid, today: date };

  // 4) (Optional) average feedback per outfit (skip for now)
  const avgFeedbackByOutfit = new Map<string, number>();

  // 5) Score
  const scored = outfits
    .map((o) => ({ outfit: o, score: scoreOutfit(o, ctx, avgFeedbackByOutfit.get(o.id)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.outfit);

  return { desiredTags: [...desired], outfits: scored };
}
