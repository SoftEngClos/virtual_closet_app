import { useEffect, useState } from "react";
import { recommendOutfitsForDate } from "../lib/recs";

export function useRecommendations(date: Date, topK = 5) {
  const [loading, setLoading] = useState(true);
  const [desiredTags, setDesiredTags] = useState<string[]>([]);
  const [outfits, setOutfits] = useState<any[]>([]);

  useEffect(() => {
    let ok = true;
    (async () => {
      setLoading(true);
      try {
        const res = await recommendOutfitsForDate(date, topK);
        if (ok) {
          setDesiredTags(res.desiredTags);
          setOutfits(res.outfits);
        }
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => { ok = false; };
  }, [date, topK]);

  return { loading, desiredTags, outfits };
}
