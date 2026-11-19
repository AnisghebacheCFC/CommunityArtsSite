(async () => {
  const list = document.getElementById("journal-entries");
  const buttons = [...document.querySelectorAll(".dj-filters [data-filter]")];
  const status = document.getElementById("filter-status");
  const empty = document.getElementById("filter-empty");
  if (!list || !buttons.length) return;

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  const slugToFilter = new Map();
  const excludedFromAll = new Set();
  buttons.forEach((button) => {
    if (button.dataset.slug) slugToFilter.set(button.dataset.slug, button.dataset.filter);
    if (button.hasAttribute("data-exclude-from-all")) excludedFromAll.add(button.dataset.filter);
  });

  const labelFor = (filter) => {
    const button = buttons.find((item) => item.dataset.filter === filter);
    return button ? button.textContent.trim() : filter;
  };

  const apply = (filter, updateHistory) => {
    const entries = [...list.querySelectorAll(".dj-entry")];
    const known = buttons.some((button) => button.dataset.filter === filter);
    const active = known ? filter : "all";
    let shown = 0;

    entries.forEach((entry) => {
      const match = active === "all"
        ? !excludedFromAll.has(entry.dataset.category)
        : entry.dataset.category === active;
      entry.hidden = !match;
      if (match) shown += 1;
    });

    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.filter === active ? "true" : "false");
    });

    if (status) {
      const noun = shown === 1 ? "entry" : "entries";
      status.textContent =
        active === "all"
          ? `Showing all ${shown} ${noun}`
          : `Showing ${shown} ${noun} in ${labelFor(active)}`;
    }

    if (empty) empty.hidden = shown !== 0 || entries.length === 0;

    if (!updateHistory) return;
    const slug = active === "all" ? "" : buttons.find((button) => button.dataset.filter === active)?.dataset.slug || "";
    const nextUrl = slug ? `#${slug}` : `${location.pathname}${location.search}`;
    history.pushState({ filter: active }, "", nextUrl);
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-pressed") === "true") return;
      apply(button.dataset.filter, true);
    });
  });

  window.addEventListener("popstate", () => {
    const slug = location.hash.replace(/^#/, "");
    apply(slug ? slugToFilter.get(slug) || "all" : "all", false);
  });

  const showMessage = (message) => {
    list.innerHTML = `<p class="dj-empty">${escapeHtml(message)}</p>`;
    if (status) status.textContent = message;
    if (empty) empty.hidden = true;
  };

  if (!window.CAClient?.configured()) {
    showMessage("Journal entries will appear here once the site is connected and an entry is approved.");
    return;
  }

  try {
    const { entries: published } = await window.CAClient.callFunction("public-journal", {
      action: "list",
      journal: "dev",
    });
    const entries = (published || []).filter((entry) => entry.journal === "dev");
    if (!entries.length) {
      showMessage("No Journal entries have been published yet.");
      return;
    }

    list.innerHTML = entries
      .map((entry) => {
        const image = entry.featured_path
          ? `<img src="${escapeHtml(entry.featured_path)}" alt="" />`
          : "";
        const date = window.CAClient.formatDate(entry.entry_date);
        return `<article class="dj-entry" data-category="${escapeHtml(entry.dev_category || "")}">
          ${image}
          <p class="dj-meta">
            <time datetime="${escapeHtml(window.CAClient.dateInputValue(entry.entry_date))}">${escapeHtml(date)}</time>
            <span aria-hidden="true">·</span>
            <span class="dj-category">${escapeHtml(entry.dev_category || "")}</span>
          </p>
          <h3><a href="entry.html?id=${encodeURIComponent(entry.id)}">${escapeHtml(entry.title)}</a></h3>
          <p>${escapeHtml(entry.excerpt || "")}</p>
        </article>`;
      })
      .join("");

    const initial = location.hash.replace(/^#/, "");
    apply(initial ? slugToFilter.get(initial) || "all" : "all", false);
  } catch {
    showMessage("The Journal could not be loaded just now.");
  }
})();
