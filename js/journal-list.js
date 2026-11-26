(async () => {
  const root = document.getElementById("journal-list");
  if (!root) return;

  if (!window.CAClient.configured()) {
    root.innerHTML =
      "<p class='status'>Journal entries will appear here once the site is connected to Supabase and an entry is approved.</p>";
    return;
  }

  try {
    const { entries: published } = await window.CAClient.callFunction("public-journal", {
      action: "list",
      journal: "community",
    });
    const entries = (published || []).filter((entry) => entry.journal !== "dev" && entry.journal !== "anna" && entry.journal !== "miki");
    if (!entries.length) {
      root.innerHTML = "<p class='status'>No journal entries have been published yet.</p>";
      return;
    }

    const cards = await Promise.all(
      entries.map(async (entry) => {
        const image = entry.featured_path
          ? `<img src="${entry.featured_path}" alt="" />`
          : "";
        const href = await window.CAJournalUrl(entry.id, `entry.html?id=${encodeURIComponent(entry.id)}`);
        return `<article class="journal-card">
        ${image}
        <time datetime="${entry.entry_date}">${window.CAClient.formatDate(entry.entry_date)}</time>
        <h3>${entry.title}</h3>
        <p>${entry.excerpt || ""}</p>
        <a href="${href}">Read the full entry</a>
      </article>`;
      }),
    );
    root.innerHTML = cards.join("");
  } catch {
    if (!root.querySelector("a")) {
      root.innerHTML = "<p class='status'>The journal could not be loaded just now.</p>";
    }
  }
})();
