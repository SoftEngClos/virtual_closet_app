export const OCCASION_MAP: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /interview|career\s*fair|presentation/i, tags: ["business"] },
  { pattern: /wedding|banquet|gala/i, tags: ["formal"] },
  { pattern: /gym|workout|practice/i, tags: ["athleisure"] },
  { pattern: /class|lecture|campus|meeting/i, tags: ["casual"] },
  { pattern: /date|dinner/i, tags: ["smart-casual"] },
  { pattern: /party|night\s*out/i, tags: ["party"] },
];

export function tagsFromEventTitle(title?: string): string[] {
  if (!title) return [];
  const hit = OCCASION_MAP.find((m) => m.pattern.test(title));
  return hit ? hit.tags : [];
}
