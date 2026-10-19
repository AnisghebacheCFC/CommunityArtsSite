(async () => {
  const root = document.getElementById("journal-list");
  if (!root) return;

  if (!window.CAClient.configured()) {
    root.innerHTML =
      "<p class='status'>Journal entries will appear here once the site is connected to Supabase and an entry is approved.</p>";
    return;
  }

  try {
    const { entries } = await window.CAClient.callFunction("public-journal", { action: "list" });
    if (!entries?.length) {
      root.innerHTML = "<p class='status'>No journal entries have been published yet.</p>";
      return;
    }

    root.innerHTML = entries
      .map((entry) => {
        const image = entry.featured_path
          ? `<img src="${entry.featured_path}" alt="" />`
          : "";
        return `<article class="journal-card">
        ${image}
        <time datetime="${entry.entry_date}">${window.CAClient.formatDate(entry.entry_date)}</time>
        <h3>${entry.title}</h3>
        <p>${entry.excerpt || ""}</p>
        <a href="entry.html?id=${entry.id}">Read the full entry</a>
      </article>`;
      })
      .join("");
  } catch {
    root.innerHTML = "<p class='status'>The journal could not be loaded just now.</p>";
  }
})();
