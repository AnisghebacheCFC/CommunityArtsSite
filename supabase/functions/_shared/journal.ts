export const DEV_CATEGORIES = [
  "AI",
  "Filmmaking",
  "Animation",
  "Creative Technology",
  "Artistic Practice",
  "Fitness",
] as const;

export const ANNA_CATEGORIES = [
  "Child Development",
  "Activities",
  "Critical Engagement",
] as const;

const PERSONAL = {
  dev: { label: "Anis Ghebache · Journal", categories: DEV_CATEGORIES },
  anna: { label: "Anna Verdes · Journal", categories: ANNA_CATEGORIES },
} as const;

export const journalLabel = (journal: string, category?: string | null) => {
  if (journal === "community" || !journal) return "Community Journal";
  const place = PERSONAL[journal as keyof typeof PERSONAL];
  if (!place) return "Journal";
  return category ? `${place.label} · ${category}` : place.label;
};

export const journalFields = (journalRaw: string, categoryRaw: string) => {
  const journal = journalRaw === "dev" || journalRaw === "anna" || journalRaw === "community" ? journalRaw : "";
  if (!journal) return { error: "Choose a journal." };
  if (journal === "community") return { journal, dev_category: null };
  const place = PERSONAL[journal];
  const category = categoryRaw.trim();
  if (!place.categories.includes(category as never)) {
    return { error: "Choose a category." };
  }
  return { journal, dev_category: category };
};
