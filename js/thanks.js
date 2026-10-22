const THANKS_DIR = "images/special thanks";

const THANKS_LAYERS = [
  [
    { name: "Draper Hall", credit: "Workshop venue", logo: `${THANKS_DIR}/drapertogether.png` },
    { name: "Barbican", credit: "Plant materials", logo: `${THANKS_DIR}/barb.png` },
    { name: "PlantSocieTree", credit: "Plant materials", logo: `${THANKS_DIR}/plantsocietree.webp` },
    { name: "Bird & Blend Tea Co.", credit: "Tea donations", logo: `${THANKS_DIR}/birdandblend.png` },
  ],
  [
    { name: "Walworth Garden", credit: "Plant materials &amp; advice", logo: `${THANKS_DIR}/walworthgarden.webp` },
    { name: "", credit: "", logo: "" },
    { name: "", credit: "", logo: "" },
    { name: "", credit: "", logo: "" },
  ],
];

const root = document.getElementById("thanks-layers");
if (root) {
  root.innerHTML = THANKS_LAYERS.filter((layer) => layer.length)
    .map(
      (layer) =>
        `<ul class="thanks-list">${layer
          .map((item) => {
            const src = item.logo ? encodeURI(item.logo) : "";
            const logo = src ? `<img src="${src}" alt="" />` : "";
            return `<li class="thanks-item">
      <div class="thanks-logo">${logo}</div>
      <h3>${item.name}</h3>
      ${item.credit ? `<p>${item.credit}</p>` : ""}
    </li>`;
          })
          .join("")}</ul>`,
    )
    .join("");
}
