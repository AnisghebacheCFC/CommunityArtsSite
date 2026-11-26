import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = "https://communityarts.org.uk";
const endpoint = "https://njsmvpdgdsoalbmmcxhh.supabase.co/functions/v1/public-journal";
const key = "sb_publishable_MqY7bonc7YdJ4gTkwyot6w_2LS2ZyOY";
const manifestPath = path.join(root, "journal", "manifest.json");

const journals = {
  community: {
    folder: "journal",
    archive: "/#journal",
    archiveLabel: "Community Journal",
    listFile: path.join(root, "index.html"),
    listStart: "<!-- journal-static:start -->",
    listEnd: "<!-- journal-static:end -->",
    card: "community",
  },
  dev: {
    folder: path.join("anis-ghebache", "dev-journal"),
    archive: "/anis-ghebache/dev-journal/",
    archiveLabel: "Anis Ghebache · Journal",
    listFile: path.join(root, "anis-ghebache", "dev-journal", "index.html"),
    listStart: "<!-- journal-static:start -->",
    listEnd: "<!-- journal-static:end -->",
    card: "personal",
  },
  anna: {
    folder: path.join("anna-verdes", "journal"),
    archive: "/anna-verdes/journal/",
    archiveLabel: "Anna Verdes · Journal",
    listFile: path.join(root, "anna-verdes", "journal", "index.html"),
    listStart: "<!-- journal-static:start -->",
    listEnd: "<!-- journal-static:end -->",
    card: "personal",
  },
  miki: {
    folder: path.join("miki-takekawa", "journal"),
    archive: "/miki-takekawa/journal/",
    archiveLabel: "Miki Takekawa · Journal",
    listFile: path.join(root, "miki-takekawa", "journal", "index.html"),
    listStart: "<!-- journal-static:start -->",
    listEnd: "<!-- journal-static:end -->",
    card: "personal",
  },
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const formatDate = (value) => {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const slugify = (title) => {
  const base = String(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return base || "entry";
};

const callJournal = async (body) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The journal could not be loaded.");
  return result;
};

const replaceBetween = (source, start, end, inner) => {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end);
  if (startAt < 0 || endAt < startAt) throw new Error(`Missing markers ${start}`);
  return `${source.slice(0, startAt + start.length)}\n${inner}\n${source.slice(endAt)}`;
};

const descriptionFrom = (entry) => {
  const text = String(entry.excerpt || entry.title || "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 160 ? `${text.slice(0, 157).trim()}…` : text;
};

const communityPage = (entry, url) => `<!DOCTYPE html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(entry.title)} | Community Arts</title>
    <meta name="description" content="${escapeHtml(descriptionFrom(entry))}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(entry.title)} | Community Arts" />
    <meta property="og:description" content="${escapeHtml(descriptionFrom(entry))}" />
    <meta property="og:url" content="${url}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
    <script type="application/ld+json">
      ${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: entry.title,
        description: descriptionFrom(entry),
        datePublished: String(entry.entry_date).slice(0, 10),
        inLanguage: "en-GB",
        url,
        author: { "@type": "Organization", name: "Community Arts", url: `${site}/` },
        publisher: { "@type": "Organization", name: "Community Arts", url: `${site}/` },
        mainEntityOfPage: url,
      }).replace(/</g, "\\u003c")}
    </script>
  </head>
  <body>
    <main class="page">
      <p class="eyebrow"><a href="/#journal">Community Journal</a></p>
      <article id="entry" data-entry-id="${escapeHtml(entry.id)}">
        <time datetime="${escapeHtml(String(entry.entry_date).slice(0, 10))}">${escapeHtml(formatDate(entry.entry_date))}</time>
        <h1>${escapeHtml(entry.title)}</h1>
        <div class="prose">${entry.body_html || ""}</div>
        <div id="entry-media" class="entry-media"></div>
      </article>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
    <script src="/js/config.js"></script>
    <script src="/js/client.js"></script>
    <script src="/js/entry-media.js"></script>
  </body>
</html>
`;

const personalPage = (entry, url, journal) => {
  const people = {
    dev: ["Anis Ghebache", "/anis-ghebache/dev-journal/dev-journal.css", `${site}/anis-ghebache/dev-journal/`],
    anna: ["Anna Verdes", "/anna-verdes/journal/journal.css", `${site}/anna-verdes/journal/`],
    miki: ["Miki Takekawa", "/miki-takekawa/journal/journal.css", `${site}/miki-takekawa/journal/`],
  };
  const [author, css, authorUrl] = people[journal];
  return `<!DOCTYPE html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(entry.title)} | ${escapeHtml(author)}</title>
    <meta name="description" content="${escapeHtml(descriptionFrom(entry))}" />
    <meta name="author" content="${escapeHtml(author)}" />
    <meta name="theme-color" content="#100e0c" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(entry.title)} | ${escapeHtml(author)}" />
    <meta property="og:description" content="${escapeHtml(descriptionFrom(entry))}" />
    <meta property="og:url" content="${url}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${css}" />
    <script type="application/ld+json">
      ${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: entry.title,
        description: descriptionFrom(entry),
        datePublished: String(entry.entry_date).slice(0, 10),
        articleSection: entry.dev_category || undefined,
        inLanguage: "en-GB",
        url,
        author: { "@type": "Person", name: author, url: authorUrl },
        publisher: { "@type": "Organization", name: "Community Arts", url: `${site}/` },
        mainEntityOfPage: url,
      }).replace(/</g, "\\u003c")}
    </script>
  </head>
  <body>
    <a class="dj-skip" href="#content">Skip to content</a>
    <header class="dj-bar">
      <a class="dj-home" href="/">Community Arts</a>
      <a href="${journals[journal].archive}">Journal</a>
    </header>
    <main id="content" class="dj-main" tabindex="-1">
      <div class="dj-reading">
        <article class="dj-article" data-entry-id="${escapeHtml(entry.id)}">
          <header class="dj-article-header">
            <p class="dj-kicker">
              <span class="dj-category">${escapeHtml(entry.dev_category || "")}</span>
              <span aria-hidden="true">·</span>
              <time datetime="${escapeHtml(String(entry.entry_date).slice(0, 10))}">${escapeHtml(formatDate(entry.entry_date))}</time>
            </p>
            <h1>${escapeHtml(entry.title)}</h1>
            <p class="dj-byline">By <a rel="author" href="${journals[journal].archive}">${escapeHtml(author)}</a></p>
          </header>
          <div class="dj-prose">${entry.body_html || ""}</div>
          <div id="entry-media" class="entry-media"></div>
        </article>
      </div>
    </main>
    <footer class="dj-footer">
      <p><a href="/">Community Arts</a> · Elephant &amp; Castle, Southwark</p>
    </footer>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
    <script src="/js/config.js"></script>
    <script src="/js/client.js"></script>
    <script src="/js/entry-media.js"></script>
  </body>
</html>
`;
};

const communityCard = (entry, href) => `<article class="journal-card">
        <time datetime="${escapeHtml(String(entry.entry_date).slice(0, 10))}">${escapeHtml(formatDate(entry.entry_date))}</time>
        <h3>${escapeHtml(entry.title)}</h3>
        <p>${escapeHtml(entry.excerpt || "")}</p>
        <a href="${href}">Read the full entry</a>
      </article>`;

const personalCard = (entry, href) => `<article class="dj-entry" data-category="${escapeHtml(entry.dev_category || "")}">
          <p class="dj-meta">
            <time datetime="${escapeHtml(String(entry.entry_date).slice(0, 10))}">${escapeHtml(formatDate(entry.entry_date))}</time>
            <span aria-hidden="true">·</span>
            <span class="dj-category">${escapeHtml(entry.dev_category || "")}</span>
          </p>
          <h3><a href="${href}">${escapeHtml(entry.title)}</a></h3>
          <p>${escapeHtml(entry.excerpt || "")}</p>
        </article>`;

const loadEntries = async (journal) => {
  const { entries } = await callJournal({ action: "list", journal });
  const full = [];
  for (const item of entries || []) {
    const { entry } = await callJournal({ action: "get", id: item.id });
    if (entry?.journal === journal && entry.status === "approved") full.push(entry);
  }
  return full;
};

const previousPaths = async () => {
  try {
    const saved = JSON.parse(await readFile(manifestPath, "utf8"));
    return Array.isArray(saved.paths) ? saved.paths : [];
  } catch {
    return [];
  }
};

const uniqueSlug = (title, id, used) => {
  let slug = slugify(title);
  const reserved = new Set(["entry", "index", "redirects", "manifest"]);
  if (reserved.has(slug) || used.has(slug)) slug = `${slug}-${String(id).slice(0, 8)}`;
  used.add(slug);
  return slug;
};

const published = [];
const redirects = {};
const batches = [];

for (const [journal, config] of Object.entries(journals)) {
  batches.push({ journal, config, entries: await loadEntries(journal) });
}

for (const oldPath of await previousPaths()) {
  await rm(path.join(root, oldPath), { recursive: true, force: true });
}

for (const { journal, config, entries } of batches) {
  const cards = [];
  const used = new Set();
  for (const entry of entries) {
    const slug = uniqueSlug(entry.title, entry.id, used);
    const relative = `${config.folder.replaceAll("\\", "/")}/${slug}`;
    const href = `/${relative}/`;
    const url = `${site}${href}`;
    const html = journal === "community" ? communityPage(entry, url) : personalPage(entry, url, journal);
    const directory = path.join(root, config.folder, slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), html);
    published.push(relative);
    redirects[entry.id] = href;
    cards.push(config.card === "community" ? communityCard(entry, href) : personalCard(entry, href));
  }
  const list = await readFile(config.listFile, "utf8");
  const empty = config.card === "community"
    ? "<p class='status'>No journal entries have been published yet.</p>"
    : "<p class=\"dj-empty\">No journal entries have been published yet.</p>";
  const next = replaceBetween(config.listFile && list, config.listStart, config.listEnd, cards.join("\n") || empty);
  await writeFile(config.listFile, next);
}

await mkdir(path.join(root, "journal"), { recursive: true });
await writeFile(path.join(root, "journal", "redirects.json"), `${JSON.stringify(redirects, null, 2)}\n`);
await writeFile(manifestPath, `${JSON.stringify({ paths: published }, null, 2)}\n`);

const sitemapPath = path.join(root, "sitemap.xml");
const sitemap = await readFile(sitemapPath, "utf8");
const urls = published
  .map((relative) => `  <url>\n    <loc>${site}/${relative}/</loc>\n  </url>`)
  .join("\n");
await writeFile(
  sitemapPath,
  replaceBetween(sitemap, "<!-- journal-sitemap:start -->", "<!-- journal-sitemap:end -->", urls),
);

console.log(`Published ${published.length} journal entries.`);
