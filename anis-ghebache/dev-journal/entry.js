const params = new URLSearchParams(location.search);
const id = params.get("id");
const root = document.getElementById("entry");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const setMeta = (selector, attribute, value) => {
  const node = document.head.querySelector(selector);
  if (node) node.setAttribute(attribute, value);
};

const renderMedia = (entry) => {
  const images = (entry.image_urls || [])
    .map(
      (src) => `<figure class="dj-figure"><img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" /></figure>`,
    )
    .join("");
  const videos = (entry.video_urls || [])
    .map((src) => `<figure class="dj-video"><video controls playsinline preload="metadata" src="${escapeHtml(src)}"></video></figure>`)
    .join("");
  const embeds = (entry.video_embeds || [])
    .map(
      (src) => `<figure class="dj-video"><div class="dj-embed"><iframe src="${escapeHtml(src)}" title="Embedded video" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div></figure>`,
    )
    .join("");
  return `${images}${videos}${embeds}`;
};

(async () => {
  if (!id || !window.CAClient?.configured()) {
    root.innerHTML = "<p class='dj-empty'>This entry is not available.</p>";
    return;
  }

  try {
    const { entry } = await window.CAClient.callFunction("public-journal", { action: "get", id });
    if (entry.journal === "anna") {
      location.replace(`/anna-verdes/journal/entry.html?id=${encodeURIComponent(id)}`);
      return;
    }
    if (entry.journal && entry.journal !== "dev") {
      location.replace(`/entry.html?id=${encodeURIComponent(id)}`);
      return;
    }

    const title = `${entry.title} | Anis Ghebache`;
    const description = entry.excerpt || "A note from Anis Ghebache's Journal.";
    const canonical = `https://communityarts.org.uk/anis-ghebache/dev-journal/entry.html?id=${encodeURIComponent(id)}`;
    document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta("#canonical", "href", canonical);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", canonical);
    setMeta('meta[property="article:section"]', "content", entry.dev_category || "");
    document.getElementById("breadcrumb-current").textContent = entry.title;

    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Person",
          "@id": "https://communityarts.org.uk/anis-ghebache/dev-journal/#anis-ghebache",
          name: "Anis Ghebache",
          url: "https://communityarts.org.uk/anis-ghebache/dev-journal/",
        },
        {
          "@type": "BlogPosting",
          headline: entry.title,
          description,
          datePublished: entry.entry_date,
          articleSection: entry.dev_category || undefined,
          inLanguage: "en-GB",
          url: canonical,
          image: entry.image_urls?.length
            ? entry.image_urls
            : ["https://communityarts.org.uk/images/facilitators/anis-ghebache.png"],
          author: { "@id": "https://communityarts.org.uk/anis-ghebache/dev-journal/#anis-ghebache" },
          publisher: {
            "@type": "Organization",
            name: "Community Arts",
            url: "https://communityarts.org.uk/",
          },
          mainEntityOfPage: canonical,
        },
      ],
    };
    const schemaNode = document.getElementById("entry-schema");
    if (schemaNode) schemaNode.textContent = JSON.stringify(schema);

    const date = window.CAClient.formatDate(entry.entry_date);
    root.innerHTML = `
      <header class="dj-article-header">
        <p class="dj-kicker">
          <span class="dj-category">${escapeHtml(entry.dev_category || "")}</span>
          <span aria-hidden="true">·</span>
          <time datetime="${escapeHtml(window.CAClient.dateInputValue(entry.entry_date))}">${escapeHtml(date)}</time>
        </p>
        <h1 id="entry-title">${escapeHtml(entry.title)}</h1>
        <p class="dj-byline">By <a rel="author" href="/anis-ghebache/dev-journal/">Anis Ghebache</a></p>
      </header>
      <div class="dj-prose">${entry.body_html || ""}</div>
      ${renderMedia(entry)}
    `;
    root.setAttribute("aria-labelledby", "entry-title");
  } catch {
    root.innerHTML = "<p class='dj-empty'>This entry is not published.</p>";
  }
})();
