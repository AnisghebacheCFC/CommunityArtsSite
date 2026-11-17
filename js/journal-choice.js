window.CAJournalChoice = (() => {
  const CATEGORIES = {
    community: [],
    dev: ["AI", "Filmmaking", "Animation", "Creative Technology", "Artistic Practice"],
    anna: ["Child Development", "Activities", "Critical Engagement"],
  };

  const LABELS = {
    community: "Community Journal",
    dev: "Anis Ghebache · Journal",
    anna: "Anna Verdes · Journal",
  };

  const selectedJournal = (root) => root.querySelector('input[name="journal"]:checked')?.value || "community";

  const fillCategories = (select, journal, current) => {
    const categories = CATEGORIES[journal] || [];
    const keep = current && categories.includes(current) ? current : "";
    select.innerHTML =
      `<option value="">Choose a category</option>` +
      categories.map((name) => `<option>${name}</option>`).join("");
    select.value = keep;
  };

  const bind = ({ form, field, select }) => {
    const sync = (current) => {
      const journal = selectedJournal(form);
      const personal = journal === "dev" || journal === "anna";
      field.hidden = !personal;
      select.required = personal;
      fillCategories(select, journal, personal ? current || select.value : "");
      if (!personal) select.value = "";
    };
    form.querySelectorAll('input[name="journal"]').forEach((input) => {
      input.addEventListener("change", () => sync());
    });
    return { sync, selectedJournal: () => selectedJournal(form) };
  };

  const placeLabel = (entry) => LABELS[entry.journal] || LABELS.community;

  return { CATEGORIES, LABELS, bind, placeLabel };
})();
