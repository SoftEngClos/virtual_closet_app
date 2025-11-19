export interface RecommendableOutfit {
    id: string;
    name?: string;
    tags?: string[];
    usageCount?: number;
    lastWornAt?: string | Date;
    [key: string]: any;
}

export interface RecommendationOptions {
    desiredTags?: string[];
    excludeIds?: string[];
    limit?: number;

}

export function scoreOutfit(
    outfit: RecommendableOutfit,
    desiredTags: string[]
) : number {
    const outfitTags = (outfit.tags ?? []).map((t) => t.toLowerCase());
    const wanted = desiredTags.map((t) => t.toLowerCase());

    // Tag overlap: each matching tag is a positive bump
    const tagMatches = wanted.filter((t) => outfitTags.includes(t)).length;
    let score = tagMatches * 10;

    // Slight penalty if the outfit is used a lot
  if (typeof outfit.usageCount === "number") {
    score -= outfit.usageCount * 0.2;
  }

  // Optional: penalty if worn very recently (last 3 days)
  if (outfit.lastWornAt) {
    const last = outfit.lastWornAt instanceof Date
      ? outfit.lastWornAt
      : new Date(outfit.lastWornAt);

    if (!Number.isNaN(last.getTime())) {
      const now = new Date();
      const diffMs = now.getTime() - last.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays >= 0 && diffDays < 3) {
        score -= 3; // don't recommend stuff you literally just wore
      }
    }
  }

  return score;
}

/**
 * Main recommendation function:
 *  - filters by excludeIds
 *  - scores by tag overlap + simple usage heuristics
 *  - sorts descending by score
 *  - trims to `limit` if provided
 */
export function recommendOutfits(
  outfits: RecommendableOutfit[],
  options: RecommendationOptions = {}
): RecommendableOutfit[] {
  const {
    desiredTags = [],
    excludeIds = [],
    limit,
  } = options;

  const excludeSet = new Set(excludeIds);

  const scored = outfits
    .filter((o) => !excludeSet.has(o.id))
    .map((o) => ({
      outfit: o,
      score: scoreOutfit(o, desiredTags),
    }))
    // Don’t recommend outfits that score 0 when we actually requested tags
    .filter((entry) => (desiredTags.length ? entry.score > 0 : true))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const nameA = (a.outfit.name ?? "").toLowerCase();
      const nameB = (b.outfit.name ?? "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

  const trimmed = typeof limit === "number" ? scored.slice(0, limit) : scored;

  return trimmed.map((entry) => entry.outfit);
}