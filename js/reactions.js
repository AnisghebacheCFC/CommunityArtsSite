(() => {
  const REACTIONS = [
    ["love", "❤️", "Love", "/images/reactions/heart.webp"],
    ["applaud", "👏", "Applaud", "/images/reactions/applause.webp"],
    ["inspired", "💡", "Inspired", "/images/reactions/inspired.webp"],
    ["growth", "🌱", "Growth", "/images/reactions/growth.webp"],
    ["together", "🤝", "Together", "/images/reactions/together.webp"],
  ];

  const clientId = () => {
    const key = "ca-journal-client";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  };

  const paint = (bar, counts, mine) => {
    bar.querySelectorAll("button").forEach((button) => {
      const name = button.dataset.reaction;
      const count = bar.querySelector(`[data-count="${name}"]`);
      const chosen = mine.includes(name);
      if (count) count.textContent = String(counts[name] || 0);
      button.setAttribute("aria-pressed", chosen ? "true" : "false");
      button.disabled = chosen;
    });
  };

  const play = (button, src) =>
    new Promise((resolve) => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const emoji = button.querySelector("[aria-hidden]");
      const img = document.createElement("img");
      img.className = "reaction-burst";
      img.alt = "";
      let settled = false;
      let started = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        img.remove();
        resolve();
      };
      const run = () => {
        if (started) return;
        started = true;
        const fade = img.animate(
          [
            { opacity: 0, transform: "translate(-50%, -50%) scale(0.9)" },
            { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
          ],
          { duration: reduce ? 160 : 380, easing: "ease-out", fill: "forwards" },
        );
        fade.finished
          .then(() => {
            window.setTimeout(() => {
              if (reduce || !emoji) {
                img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" }).finished.then(finish);
                return;
              }
              const target = emoji.getBoundingClientRect();
              const current = img.getBoundingClientRect();
              const dx = target.left + target.width / 2 - (current.left + current.width / 2);
              const dy = target.top + target.height / 2 - (current.top + current.height / 2);
              const scale = Math.max(0.08, target.width / Math.max(current.width, 1));
              img
                .animate(
                  [
                    { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
                    {
                      opacity: 1,
                      transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`,
                    },
                  ],
                  { duration: 320, easing: "cubic-bezier(0.45, 0, 1, 1)", fill: "forwards" },
                )
                .finished.then(() =>
                  img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" }).finished,
                )
                .then(finish);
            }, reduce ? 200 : 1000);
          })
          .catch(finish);
      };
      document.body.appendChild(img);
      img.addEventListener("error", finish, { once: true });
      img.addEventListener("load", run, { once: true });
      img.src = src;
      if (img.complete && img.naturalWidth) run();
    });

  const thank = (button) => {
    const note = document.createElement("span");
    note.className = "reaction-thanks";
    note.textContent = "Thank you!";
    let surface = button.parentElement;
    while (surface) {
      const color = getComputedStyle(surface).backgroundColor;
      if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") break;
      surface = surface.parentElement;
    }
    note.style.background = surface ? getComputedStyle(surface).backgroundColor : "var(--paper)";
    button.appendChild(note);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    note
      .animate(
        [
          { opacity: 0, transform: "translate(-50%, -50%)" },
          { opacity: 1, offset: 0.35, transform: "translate(-50%, calc(-50% - 1.75rem))" },
          { opacity: 0, transform: "translate(-50%, calc(-50% - 3rem))" },
        ],
        { duration: reduce ? 500 : 1100, easing: "ease-out", fill: "forwards" },
      )
      .finished.then(() => note.remove())
      .catch(() => note.remove());
  };

  const mount = (article) => {
    const root = article || document.querySelector("[data-entry-id]");
    const bar = root?.querySelector("[data-reactions]");
    const entryId = root?.dataset.entryId;
    if (!root || !bar || !entryId || bar.dataset.ready === "true" || !window.CAClient?.configured()) return;
    bar.dataset.ready = "true";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Reactions");
    bar.innerHTML = REACTIONS.map(
      ([name, emoji, label]) =>
        `<button type="button" data-reaction="${name}" aria-pressed="false"><span aria-hidden="true">${emoji}</span> ${label} <span class="reactions-count" data-count="${name}">0</span></button>`,
    ).join("");

    const id = clientId();
    const load = (action, reaction) =>
      window.CAClient.callFunction("journal-reactions", {
        action,
        entry_id: entryId,
        client_id: id,
        reaction,
      });

    let holdPaint = false;
    load("list")
      .then(({ counts, mine }) => {
        if (!holdPaint) paint(bar, counts || {}, mine || []);
      })
      .catch(() => {});

    bar.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled || button.getAttribute("aria-pressed") === "true") return;
      const name = button.dataset.reaction;
      const art = REACTIONS.find(([reaction]) => reaction === name)?.[3];
      button.disabled = true;
      holdPaint = true;
      const saved = load("add", name)
        .then((result) => ({ ok: true, result }))
        .catch(() => ({ ok: false }));
      play(button, art).then(() => saved).then((outcome) => {
        holdPaint = false;
        if (!outcome.ok) {
          button.disabled = false;
          return;
        }
        const previous = Number(button.querySelector("[data-count]")?.textContent) || 0;
        paint(bar, outcome.result.counts || {}, outcome.result.mine || []);
        const next = Number(button.querySelector("[data-count]")?.textContent) || 0;
        if (next > previous) thank(button);
      });
    });
  };

  const mountAll = () => {
    document.querySelectorAll("[data-entry-id]").forEach((article) => mount(article));
  };

  window.CAReactions = { mount, mountAll };
  if (!document.getElementById("journal-list")) mountAll();
})();
