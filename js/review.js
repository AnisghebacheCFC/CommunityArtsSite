const supabase = window.CAClient.configured() ? window.CAClient.client() : null;
const params = new URLSearchParams(location.search);
const entryId = params.get("id");
const token = params.get("token");
const status = document.getElementById("status");
const preview = document.getElementById("preview");
const actions = document.getElementById("actions");
const authPanel = document.getElementById("auth-panel");

const callModerate = async (payload, accessToken) => {
  const response = await fetch(window.CAClient.functionsUrl("moderate-journal"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: window.CA.supabaseAnonKey,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
};

const showEntry = (entry) => {
  preview.innerHTML = `
    <time datetime="${entry.entry_date}">${window.CAClient.formatDate(entry.entry_date)}</time>
    <h2>${entry.title}</h2>
    <p class="status">Status: ${entry.status}</p>
    <div class="entry-media">
      ${(entry.image_urls || []).map((src) => `<img src="${src}" alt="" />`).join("")}
      ${(entry.video_urls || []).map((src) => `<video controls src="${src}"></video>`).join("")}
      ${(entry.video_embeds || [])
        .map((src) => `<iframe src="${src}" allowfullscreen height="360"></iframe>`)
        .join("")}
    </div>
    <div class="prose">${entry.body_html}</div>
  `;
  actions.hidden = entry.status !== "pending";
};

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const email = new FormData(event.target).get("email");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.href },
  });
  status.textContent = error ? error.message : "Check the review inbox for a login link.";
});

const moderate = async (action) => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    status.textContent = "Sign in first.";
    return;
  }
  try {
    const result = await callModerate({ id: entryId, token, action }, accessToken);
    status.textContent = result.message;
    if (result.entry) showEntry(result.entry);
  } catch (error) {
    status.textContent = error.message;
  }
};

document.getElementById("approve").addEventListener("click", () => moderate("approve"));
document.getElementById("reject").addEventListener("click", () => moderate("reject"));

(async () => {
  if (!supabase || !entryId) {
    status.textContent = "Missing review configuration or entry id.";
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  authPanel.hidden = true;
  try {
    const result = await callModerate({ id: entryId, token, action: "preview" }, data.session.access_token);
    showEntry(result.entry);
  } catch (error) {
    status.textContent = error.message;
  }
})();
