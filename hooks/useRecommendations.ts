// hooks/useRecommendations.ts
import { differenceInCalendarDays } from "date-fns";

export type Outfit = {
  id: string; name: string;
  tags: string[]; itemIds: string[];
  thumbnailUrl?: string;
  usageCount: number;
  lastWorn?: { toDate: () => Date }; // Firestore Timestamp-like
  colors?: string[]; warmth?: "light"|"mid"|"warm";
};

export type UserPreferences = {
  tagWeights?: Record<string, number>; // e.g. {"formal":1.5,"gym":-0.5}
  avoidTags?: string[];
  minRepeatDays?: number;              // e.g. 7
  colorPrefs?: Record<string, number>;
};

export type RecContext = { tags: string[] }; // e.g. ["formal","mild","weekday"]

const daysSince = (ts?: {toDate:()=>Date}) =>
  ts ? Math.max(0, differenceInCalendarDays(new Date(), ts.toDate())) : 999;

const tagMatchScore = (ctx: string[], outfitTags: string[]) =>
  Math.min(ctx.reduce((s,t)=>s+(outfitTags.includes(t)?1:0),0), 4);

const userWeightsScore = (outfitTags: string[], w?: Record<string,number>) =>
  (w ? outfitTags.reduce((a,t)=>a+(w[t]??0),0) : 0);

const avoidPenalty = (outfitTags: string[], avoid?: string[]) =>
  (avoid && avoid.some(t=>outfitTags.includes(t))) ? 2 : 0;

const repeatPenalty = (d: number, min?: number) =>
  (!min || d>=min) ? 0 : (min-d)*0.3;

const popularityBump = (u: number) => Math.log(1+u)/4;

// crude diversity vs. already picked
const similarityPenalty = (curr: Outfit, chosen: Outfit[]) => {
  const s = chosen.reduce((acc, o)=>{
    const overlap = o.tags.filter(t=>curr.tags.includes(t)).length;
    return acc + overlap;
  },0);
  return s*0.25;
};

export function scoreOutfit(
  outfit: Outfit, ctx: RecContext, prefs: UserPreferences, chosen: Outfit[]
){
  const d = daysSince(outfit.lastWorn);
  const score =
    1.2*tagMatchScore(ctx.tags, outfit.tags) +
    0.8*userWeightsScore(outfit.tags, prefs.tagWeights) -
    0.7*avoidPenalty(outfit.tags, prefs.avoidTags) +
    0.3*popularityBump(outfit.usageCount) -
    0.9*repeatPenalty(d, prefs.minRepeatDays) -
    similarityPenalty(outfit, chosen);
  return { score, reasons: { d } };
}

export function rankOutfits(
  outfits: Outfit[], ctx: RecContext, prefs: UserPreferences, k = 10
){
  const picked: Outfit[] = [];
  const candidates = [...outfits];
  const results: {outfit:Outfit;score:number}[] = [];

  while (picked.length < Math.min(k, candidates.length)) {
    let best: {i:number; s:number} | null = null;
    for (let i=0;i<candidates.length;i++){
      const { score } = scoreOutfit(candidates[i], ctx, prefs, picked);
      if (!best || score>best.s) best = { i, s: score };
    }
    if (!best) break;
    const [chosen] = candidates.splice(best.i,1);
    picked.push(chosen);
    results.push({ outfit: chosen, score: best.s });
  }
  return results;
}
