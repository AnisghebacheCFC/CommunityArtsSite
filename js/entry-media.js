(() => {
  const article = document.querySelector("[data-entry-id]");
  const media = document.getElementById("entry-media");
  const id = article?.dataset.entryId;
  if (!id || !media || !window.CAClient?.configured()) return;

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  window.CAClient.callFunction("public-journal", { action: "get", id })
    .then(({ entry }) => {
      const images = (entry.image_urls || [])
        .map((src) => `<img src="${escapeHtml(src)}" alt="" />`)
        .join("");
      const videos = (entry.video_urls || [])
        .map((src) => `<video controls src="${escapeHtml(src)}"></video>`)
        .join("");
      const embeds = (entry.video_embeds || [])
        .map(
          (src) =>
            `<iframe src="${escapeHtml(src)}" title="Embedded video" loading="lazy" allowfullscreen height="360"></iframe>`,
        )
        .join("");
      if (images || videos || embeds) media.innerHTML = images + videos + embeds;
    })
    .catch(() => {});
})();
