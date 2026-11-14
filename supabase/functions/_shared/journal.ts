export const DEV_CATEGORIES = [
  "AI",
  "Filmmaking",
  "Animation",
  "Creative Technology",
  "Artistic Practice",
] as const;

export const journalFields = (journalRaw: string, categoryRaw: string) => {
  const journal = journalRaw === "dev" || journalRaw === "community" ? journalRaw : "";
  if (!journal) return { error: "Choose Community Journal or Dev Journal." };
  if (journal === "community") return { journal, dev_category: null };
  const devCategory = categoryRaw.trim();
  if (!DEV_CATEGORIES.includes(devCategory as (typeof DEV_CATEGORIES)[number])) {
    return { error: "Choose a Dev Journal category." };
  }
  return { journal, dev_category: devCategory };
};
