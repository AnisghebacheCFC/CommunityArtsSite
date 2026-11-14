/**
 * Builds the Dev Journal from entries.json and the HTML templates.
 * From this folder: node build.mjs
 * Layout lives in templates/ and dev-journal.css. Notes live in entries.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "../..");
const site = "https://communityarts.org.uk";
const basePath = "/anis-ghebache/dev-journal/";
const canonicalHome = `${site}${basePath}`;
const portrait = `${site}/images/facilitators/anis-ghebache.png`;
const portraitAlt = "Anis Ghebache speaking into a microphone.";
const categoryOrder = ["AI", "Filmmaking", "Animation", "Creative Technology", "Artistic Practice"];
const reservedSlugs = new Set(["templates", "index"]);
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const readTemplate = (name) => fs.readFileSync(path.join(root, "templates", name), "utf8");

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const safeUrl = (value) => {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (!url || /[\s"'<>\\]/.test(url)) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {
    return "";
  }
  return "";
};

const requireUrl = (value, context) => {
  const url = safeUrl(value);
  if (!url) throw new Error(`${context}: invalid URL ${value}`);
  return url;
};

const linkAttrs = (url) => {
  const safe = escapeHtml(url);
  return /^https?:\/\//i.test(url) ? `href="${safe}" rel="noreferrer"` : `href="${safe}"`;
};

const formatInline = (value, context) => {
  const source = String(value);
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let html = "";
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    html += escapeHtml(source.slice(last, match.index));
    if (match[1] !== undefined) {
      const url = requireUrl(match[2], context);
      html += `<a ${linkAttrs(url)}>${escapeHtml(match[1])}</a>`;
    } else if (match[3] !== undefined) {
      html += `<strong>${escapeHtml(match[3])}</strong>`;
    } else {
      html += `<em>${escapeHtml(match[4])}</em>`;
    }
    last = match.index + match[0].length;
  }
  html += escapeHtml(source.slice(last));
  return html;
};

const plainInline = (value) =>
  String(value)
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");

const fill = (template, tokens) =>
  template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(tokens, key)) {
      throw new Error(`Missing template token {{${key}}}`);
    }
    return tokens[key];
  });

const assertDate = (value, context) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${context}: date must be YYYY-MM-DD`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${context}: invalid date ${value}`);
  }
};

const formatDate = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
};

const slugifyCategory = (category) => {
  const slug = category
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) throw new Error(`Category needs a filter name: ${category}`);
  return slug;
};

const absoluteUrl = (src) => {
  if (src.startsWith("https://") || src.startsWith("http://")) return src;
  if (src.startsWith("/")) return `${site}${src}`;
  return `${site}/${src}`;
};

const jsonScript = (data) => JSON.stringify(data, null, 2).replace(/</g, "\\u003c");

const personEntity = () => ({
  "@type": "Person",
  "@id": `${canonicalHome}#anis-ghebache`,
  name: "Anis Ghebache",
  jobTitle: "Project Lead and Workshop Facilitator",
  description:
    "Anis Ghebache is an artist and animator. Born and raised in Elephant & Castle, he founded Community Arts and leads its workshops. His background includes experimental 3D animation, higher education and creative project coordination.",
  image: portrait,
  url: canonicalHome,
  worksFor: {
    "@type": "Organization",
    name: "Community Arts",
    url: `${site}/`,
  },
  knowsAbout: ["Artistic practice", "Animation", "Filmmaking", "Creative technology", "AI"],
});

const breadcrumbEntity = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

const imageMeta = ({ url, alt, width, height }) =>
  [
    `<meta property="og:image" content="${escapeHtml(url)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(alt)}" />`,
    width ? `<meta property="og:image:width" content="${Number(width)}" />` : "",
    height ? `<meta property="og:image:height" content="${Number(height)}" />` : "",
    `<meta name="twitter:image" content="${escapeHtml(url)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(alt)}" />`,
  ]
    .filter(Boolean)
    .join("\n    ");

const renderBlock = (block, context) => {
  if (typeof block === "string") return `<p>${formatInline(block, context)}</p>`;
  if (block && typeof block === "object") {
    if (typeof block.h2 === "string") return `<h2>${formatInline(block.h2, context)}</h2>`;
    if (typeof block.h3 === "string") return `<h3>${formatInline(block.h3, context)}</h3>`;
    if (Array.isArray(block.list)) {
      return `<ul>${block.list.map((item) => `<li>${formatInline(item, context)}</li>`).join("")}</ul>`;
    }
    if (Array.isArray(block.numbers)) {
      return `<ol>${block.numbers.map((item) => `<li>${formatInline(item, context)}</li>`).join("")}</ol>`;
    }
    if (typeof block.quote === "string") {
      return `<blockquote><p>${formatInline(block.quote, context)}</p></blockquote>`;
    }
  }
  throw new Error(`${context}: unsupported body block`);
};

const renderBody = (blocks, context) => {
  if (!blocks.length) return "";
  return `<div class="dj-prose">\n            ${blocks.map((block) => renderBlock(block, context)).join("\n            ")}\n          </div>`;
};

const plainBody = (blocks) =>
  blocks
    .map((block) => {
      if (typeof block === "string") return plainInline(block);
      if (typeof block.h2 === "string") return plainInline(block.h2);
      if (typeof block.h3 === "string") return plainInline(block.h3);
      if (typeof block.quote === "string") return plainInline(block.quote);
      if (Array.isArray(block.list)) return block.list.map(plainInline).join("\n");
      if (Array.isArray(block.numbers)) return block.numbers.map(plainInline).join("\n");
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

const captionHtml = (caption) =>
  caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";

const renderImages = (images) =>
  images
    .map((image, index) => {
      const dimensions = [
        image.width ? `width="${Number(image.width)}"` : "",
        image.height ? `height="${Number(image.height)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<figure class="dj-figure">
            <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" ${dimensions} loading="${index === 0 ? "eager" : "lazy"}" decoding="async" />
            ${captionHtml(image.caption)}
          </figure>`;
    })
    .join("\n          ");

const toEmbedUrl = (url) => {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    if (id) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  }
  if (host === "youtube.com" && parsed.pathname === "/watch") {
    const id = parsed.searchParams.get("v");
    if (id) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  }
  if (host === "vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  }
  return url;
};

const videoType = (src) => {
  const clean = src.split("?")[0].toLowerCase();
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".ogv") || clean.endsWith(".ogg")) return "video/ogg";
  return "video/mp4";
};

const renderVideos = (videos, context) =>
  videos
    .map((video) => {
      const caption = captionHtml(video.caption);
      if (video.placeholder === true) {
        return `<figure class="dj-video">
            <div class="dj-frame">Placeholder video</div>
            ${caption}
          </figure>`;
      }
      if (video.embed) {
        const embed = toEmbedUrl(requireUrl(video.embed, context));
        if (!embed.startsWith("https://")) throw new Error(`${context}: embed must use https`);
        const title = video.title || video.caption || "Embedded video";
        return `<figure class="dj-video">
            <div class="dj-embed">
              <iframe src="${escapeHtml(embed)}" title="${escapeHtml(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </div>
            ${caption}
          </figure>`;
      }
      const src = requireUrl(video.src, context);
      const poster = video.poster ? ` poster="${escapeHtml(requireUrl(video.poster, context))}"` : "";
      const track = video.captions
        ? `<track kind="captions" src="${escapeHtml(requireUrl(video.captions, context))}" srclang="en" label="${escapeHtml(video.captionsLabel || "English")}" default />`
        : "";
      return `<figure class="dj-video">
            <video controls playsinline preload="metadata"${poster}>
              <source src="${escapeHtml(src)}" type="${videoType(src)}" />
              ${track}
            </video>
            ${caption}
          </figure>`;
    })
    .join("\n          ");

const renderLinks = (links) => {
  if (!links.length) return "";
  const items = links
    .map((link) => `<li><a ${linkAttrs(link.href)}>${escapeHtml(link.label)}</a></li>`)
    .join("");
  return `<aside class="dj-links" aria-label="Links">
            <h2>Links</h2>
            <ul>${items}</ul>
          </aside>`;
};

const renderPager = (newer, older) => {
  if (!newer && !older) return "";
  const newerHtml = newer
    ? `<a class="is-prev" href="${escapeHtml(newer.url)}" rel="prev"><span>Newer</span>${escapeHtml(newer.title)}</a>`
    : "";
  const olderHtml = older
    ? `<a class="is-next" href="${escapeHtml(older.url)}" rel="next"><span>Older</span>${escapeHtml(older.title)}</a>`
    : "";
  return `<nav class="dj-pager" aria-label="More entries">${newerHtml}${olderHtml}</nav>`;
};

const renderBreadcrumb = (items) => {
  const parts = items
    .map((item, index) => {
      const current = index === items.length - 1;
      const crumb = current
        ? `<span aria-current="page">${escapeHtml(item.name)}</span>`
        : `<a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>`;
      const separator =
        index < items.length - 1 ? `<li aria-hidden="true">/</li>` : "";
      return `<li>${crumb}</li>${separator}`;
    })
    .join("");
  return `<nav class="dj-breadcrumb" aria-label="Breadcrumb"><ol>${parts}</ol></nav>`;
};

const loadEntries = () => {
  const source = JSON.parse(fs.readFileSync(path.join(root, "entries.json"), "utf8"));
  if (!Array.isArray(source.entries)) throw new Error("entries.json needs an entries array");
  const seen = new Set();
  const entries = source.entries.map((entry) => {
    const slug = entry.slug;
    const context = slug || entry.title || "entry";
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || reservedSlugs.has(slug)) {
      throw new Error(`${context}: slug must be lowercase words separated by hyphens`);
    }
    if (seen.has(slug)) throw new Error(`${slug}: duplicate slug`);
    seen.add(slug);
    for (const field of ["title", "category", "excerpt", "description"]) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) {
        throw new Error(`${slug}: ${field} is required`);
      }
    }
    assertDate(entry.date, slug);
    if (entry.updated) assertDate(entry.updated, `${slug} updated`);
    if (!Array.isArray(entry.body)) throw new Error(`${slug}: body must be an array`);
    const images = entry.images || [];
    const videos = entry.videos || [];
    const links = entry.links || [];
    if (!Array.isArray(images) || !Array.isArray(videos) || !Array.isArray(links)) {
      throw new Error(`${slug}: images, videos and links must be arrays`);
    }
    images.forEach((image) => {
      requireUrl(image.src, slug);
      if (typeof image.alt !== "string" || !image.alt.trim()) {
        throw new Error(`${slug}: each image needs alt text`);
      }
    });
    videos.forEach((video) => {
      const modes = [Boolean(video.src), Boolean(video.embed), video.placeholder === true].filter(Boolean);
      if (modes.length !== 1) {
        throw new Error(`${slug}: each video needs exactly one of src, embed or placeholder`);
      }
    });
    links.forEach((link) => {
      requireUrl(link.href, slug);
      if (typeof link.label !== "string" || !link.label.trim()) {
        throw new Error(`${slug}: each link needs a label`);
      }
    });
    if (entry.description.length > 160) {
      console.warn(`${slug}: description is ${entry.description.length} characters`);
    }
    return {
      ...entry,
      images,
      videos,
      links,
      modified: entry.updated || entry.date,
      url: `${basePath}${slug}/`,
      canonical: `${site}${basePath}${slug}/`,
    };
  });
  entries.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  return { notice: typeof source.notice === "string" ? source.notice.trim() : "", entries };
};

const orderedCategories = (entries) => {
  const present = new Set(entries.map((entry) => entry.category));
  const ordered = categoryOrder.filter((category) => present.has(category));
  const slugs = new Set();
  for (const entry of entries) {
    if (!ordered.includes(entry.category)) ordered.push(entry.category);
  }
  return ordered.map((category) => {
    const slug = slugifyCategory(category);
    if (slugs.has(slug)) throw new Error(`Category slug collision: ${category}`);
    slugs.add(slug);
    return { category, slug };
  });
};

const removeStaleEntries = (slugs) => {
  for (const name of fs.readdirSync(root)) {
    if (slugs.has(name)) continue;
    const directory = path.join(root, name);
    if (!fs.statSync(directory).isDirectory()) continue;
    const indexPath = path.join(directory, "index.html");
    if (!fs.existsSync(indexPath)) continue;
    const html = fs.readFileSync(indexPath, "utf8");
    if (html.includes("generated-dev-journal-entry")) fs.rmSync(directory, { recursive: true, force: true });
  }
};

const updateSitemap = (journalUrls) => {
  const sitemapPath = path.join(repo, "sitemap.xml");
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const newline = xml.includes("\r\n") ? "\r\n" : "\n";
  if (!xml.includes("</urlset>")) throw new Error("sitemap.xml is missing </urlset>");
  const cleaned = xml.replace(
    /\r?\n[ \t]*<url>\s*<loc>https:\/\/communityarts\.org\.uk\/anis-ghebache\/dev-journal\/[^<]*<\/loc>[\s\S]*?<\/url>/g,
    ""
  );
  const block = journalUrls
    .map(
      (item) =>
        `  <url>${newline}    <loc>${item.loc}</loc>${newline}    <lastmod>${item.lastmod}</lastmod>${newline}  </url>`
    )
    .join(newline);
  const next = cleaned.replace(`</urlset>`, `${block}${newline}</urlset>`);
  fs.writeFileSync(sitemapPath, next);
};

const checkPage = (file, html) => {
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) throw new Error(`${file} should have one h1`);
  if (!html.includes('rel="canonical"') || !html.includes("application/ld+json")) {
    throw new Error(`${file} is missing SEO metadata`);
  }
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!json) throw new Error(`${file} is missing structured data`);
  JSON.parse(json[1]);
};

const build = () => {
  const { notice, entries } = loadEntries();
  const categories = orderedCategories(entries);
  const headerTemplate = readTemplate("header.html");
  const footer = readTemplate("footer.html").trim();
  const cardTemplate = readTemplate("entry-card.html").trim();
  const indexTemplate = readTemplate("index.html");
  const entryTemplate = readTemplate("entry.html");
  const journalNav = (current) =>
    current
      ? `<span aria-current="page">Dev Journal</span>`
      : `<a href="${basePath}">Dev Journal</a>`;
  const header = (current) => fill(headerTemplate, { JOURNAL_NAV: journalNav(current) }).trim();
  const noun = entries.length === 1 ? "entry" : "entries";
  const filters = [
    `<button type="button" data-filter="all" data-slug="" aria-pressed="true" aria-controls="journal-entries">All</button>`,
    ...categories.map(
      (item) =>
        `<button type="button" data-filter="${escapeHtml(item.category)}" data-slug="${item.slug}" aria-pressed="false" aria-controls="journal-entries">${escapeHtml(item.category)}</button>`
    ),
  ].join("\n                ");
  const cards = entries
    .map((entry) =>
      fill(cardTemplate, {
        CATEGORY: escapeHtml(entry.category),
        DATE: escapeHtml(entry.date),
        DATE_DISPLAY: escapeHtml(formatDate(entry.date)),
        URL: escapeHtml(entry.url),
        TITLE: escapeHtml(entry.title),
        EXCERPT: escapeHtml(entry.excerpt),
      })
    )
    .join("\n              ");
  const description =
    "Exploring AI, filmmaking, animation, creative technology and artistic practice. A personal development journal by Anis Ghebache.";
  const indexJson = {
    "@context": "https://schema.org",
    "@graph": [
      personEntity(),
      {
        "@type": "Blog",
        "@id": `${canonicalHome}#journal`,
        name: "Anis Ghebache | Dev Journal",
        description,
        url: canonicalHome,
        inLanguage: "en-GB",
        author: { "@id": `${canonicalHome}#anis-ghebache` },
        publisher: {
          "@type": "Organization",
          name: "Community Arts",
          url: `${site}/`,
        },
        blogPost: entries.map((entry) => ({
          "@type": "BlogPosting",
          "@id": `${entry.canonical}#article`,
          headline: entry.title,
          url: entry.canonical,
          datePublished: entry.date,
          author: { "@id": `${canonicalHome}#anis-ghebache` },
        })),
      },
      breadcrumbEntity([
        { name: "Community Arts", url: `${site}/` },
        { name: "Dev Journal", url: canonicalHome },
      ]),
    ],
  };
  const indexHtml = fill(indexTemplate, {
    DOCUMENT_TITLE: escapeHtml("Anis Ghebache | Dev Journal"),
    DESCRIPTION: escapeHtml(description),
    CANONICAL: escapeHtml(canonicalHome),
    IMAGE_META: imageMeta({ url: portrait, alt: portraitAlt, width: 543, height: 724 }),
    JSON_LD: jsonScript(indexJson),
    HEADER: header(true),
    FOOTER: footer,
    NOTICE: notice ? `<p class="dj-note">${escapeHtml(notice)}</p>` : "",
    FILTERS: filters,
    STATUS: `Showing all ${entries.length} ${noun}`,
    ENTRIES: cards,
  });
  checkPage("index.html", indexHtml);
  fs.writeFileSync(path.join(root, "index.html"), indexHtml);

  removeStaleEntries(new Set(entries.map((entry) => entry.slug)));

  entries.forEach((entry, index) => {
    const context = entry.slug;
    const articleText = [entry.excerpt, plainBody(entry.body)].filter(Boolean).join("\n\n");
    const words = articleText.split(/\s+/).filter(Boolean);
    const schemaImages = entry.images.length
      ? entry.images.map((image) => absoluteUrl(image.src))
      : [portrait];
    const primaryImage = entry.images[0];
    const crumbs = [
      { name: "Community Arts", url: `${site}/` },
      { name: "Dev Journal", url: canonicalHome },
      { name: entry.title, url: entry.canonical },
    ];
    const entryJson = {
      "@context": "https://schema.org",
      "@graph": [
        personEntity(),
        {
          "@type": "Blog",
          "@id": `${canonicalHome}#journal`,
          name: "Anis Ghebache | Dev Journal",
          url: canonicalHome,
        },
        {
          "@type": "BlogPosting",
          "@id": `${entry.canonical}#article`,
          headline: entry.title,
          description: entry.description,
          articleSection: entry.category,
          datePublished: entry.date,
          dateModified: entry.modified,
          inLanguage: "en-GB",
          wordCount: words.length,
          articleBody: articleText,
          image: schemaImages,
          url: entry.canonical,
          mainEntityOfPage: { "@type": "WebPage", "@id": entry.canonical },
          author: { "@id": `${canonicalHome}#anis-ghebache` },
          publisher: {
            "@type": "Organization",
            name: "Community Arts",
            url: `${site}/`,
          },
          isPartOf: { "@id": `${canonicalHome}#journal` },
        },
        breadcrumbEntity(crumbs),
      ],
    };
    const updatedLine =
      entry.updated && entry.updated !== entry.date
        ? `<p class="dj-updated">Updated <time datetime="${escapeHtml(entry.updated)}">${escapeHtml(formatDate(entry.updated))}</time></p>`
        : "";
    const html = fill(entryTemplate, {
      DOCUMENT_TITLE: escapeHtml(`${entry.title} | Anis Ghebache`),
      DESCRIPTION: escapeHtml(entry.description),
      CANONICAL: escapeHtml(entry.canonical),
      IMAGE_META: imageMeta({
        url: primaryImage ? absoluteUrl(primaryImage.src) : portrait,
        alt: primaryImage ? primaryImage.alt : portraitAlt,
        width: primaryImage?.width || (primaryImage ? undefined : 543),
        height: primaryImage?.height || (primaryImage ? undefined : 724),
      }),
      DATE: escapeHtml(entry.date),
      MODIFIED: escapeHtml(entry.modified),
      CATEGORY: escapeHtml(entry.category),
      STYLESHEET: "../dev-journal.css",
      JSON_LD: jsonScript(entryJson),
      HEADER: header(false),
      FOOTER: footer,
      BREADCRUMB: renderBreadcrumb(crumbs.map((crumb) => ({ ...crumb, url: crumb.url.replace(site, "") || "/" }))),
      DATE_DISPLAY: escapeHtml(formatDate(entry.date)),
      TITLE: escapeHtml(entry.title),
      EXCERPT: escapeHtml(entry.excerpt),
      UPDATED_LINE: updatedLine,
      IMAGES: renderImages(entry.images),
      BODY: renderBody(entry.body, context),
      VIDEOS: renderVideos(entry.videos, context),
      LINKS: renderLinks(entry.links),
      PAGER: renderPager(
        index > 0 ? entries[index - 1] : null,
        index < entries.length - 1 ? entries[index + 1] : null
      ),
    });
    checkPage(entry.slug, html);
    const directory = path.join(root, entry.slug);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "index.html"), html);
  });

  updateSitemap([
    { loc: canonicalHome, lastmod: entries[0]?.date || "2026-11-12" },
    ...entries.map((entry) => ({ loc: entry.canonical, lastmod: entry.modified })),
  ]);

  console.log(`Dev Journal: ${entries.length} ${noun}`);
  for (const entry of entries) console.log(`- ${entry.date}  ${entry.category}  ${entry.slug}`);
};

build();
