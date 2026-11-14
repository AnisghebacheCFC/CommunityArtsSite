(function () {
  const buttons = [...document.querySelectorAll(".dj-filters [data-filter]")];
  const entries = [...document.querySelectorAll(".dj-entry")];
  const status = document.getElementById("filter-status");
  const empty = document.getElementById("filter-empty");
  if (!buttons.length || !entries.length) return;

  const slugToFilter = new Map();
  buttons.forEach((button) => {
    if (button.dataset.slug) slugToFilter.set(button.dataset.slug, button.dataset.filter);
  });

  const labelFor = (filter) => {
    const button = buttons.find((item) => item.dataset.filter === filter);
    return button ? button.textContent.trim() : filter;
  };

  const apply = (filter, updateHistory) => {
    const known = buttons.some((button) => button.dataset.filter === filter);
    const active = known ? filter : "all";
    let shown = 0;

    entries.forEach((entry) => {
      const match = active === "all" || entry.dataset.category === active;
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

    if (empty) empty.hidden = shown !== 0;

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

  const initial = location.hash.replace(/^#/, "");
  if (initial && slugToFilter.has(initial)) apply(slugToFilter.get(initial), false);
})();
