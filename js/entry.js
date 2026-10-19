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

  const supabase = window.CAClient.client();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("title, entry_date, body_html, image_urls, video_urls, video_embeds, status")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (error || !data) {
    root.innerHTML = "<p class='status'>This entry is not published.</p>";
    return;
  }

  document.title = `${data.title} · Community Arts`;
  root.innerHTML = `
    <time datetime="${data.entry_date}">${window.CAClient.formatDate(data.entry_date)}</time>
    <h1>${data.title}</h1>
    ${renderMedia(data)}
    <div class="prose">${data.body_html}</div>
  `;
})();
