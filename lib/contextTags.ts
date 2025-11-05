// lib/contextTags.ts
export function inferContextTagsFromEvent(title?: string) {
  const t = (title||"").toLowerCase();
  const tags: string[] = [];
  if (/(interview|work|presentation)/.test(t)) tags.push("formal");
  if (/(class|campus|errand)/.test(t)) tags.push("casual");
  if (/(gym|training|run|workout)/.test(t)) tags.push("gym");
  if (/(party|date|dinner)/.test(t)) tags.push("smart-casual");
  // add weekday/weekend if you like
  return tags;
}
