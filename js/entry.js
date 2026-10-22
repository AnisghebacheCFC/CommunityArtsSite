const params = new URLSearchParams(location.search);
const id = params.get("id");
const root = document.getElementById("entry");

const renderMedia = (entry) => {
  const images = (entry.image_urls || []).map((src) => `<img src="${src}" alt="" />`).join("");
  const videos = (entry.video_urls || [])
    .map((src) => `<video controls src="${src}"></video>`)
    .join("");
  const embeds = (entry.video_embeds || [])
    .map((src) => `<iframe src="${src}" allowfullscreen loading="lazy" height="360"></iframe>`)
    .join("");
  return `<div class="entry-media">${images}${videos}${embeds}</div>`;
};

(async () => {
  if (!id || !window.CAClient.configured()) {
    root.innerHTML = "<p class='status'>This entry is not available.</p>";
    return;
  }

  try {
    const { entry } = await window.CAClient.callFunction("public-journal", { action: "get", id });
    document.title = `${entry.title} · Community Arts`;
    root.innerHTML = `
    <time datetime="${entry.entry_date}">${window.CAClient.formatDate(entry.entry_date)}</time>
    <h1>${entry.title}</h1>
    <div class="prose">${entry.body_html}</div>
    ${renderMedia(entry)}
  `;
  } catch {
    root.innerHTML = "<p class='status'>This entry is not published.</p>";
  }
})();
