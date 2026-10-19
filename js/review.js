const ADMIN_EMAIL = "anis@communityarts.org.uk";
const supabase = window.CAClient.configured() ? window.CAClient.client() : null;
const status = document.getElementById("status");
const loginForm = document.getElementById("login-form");
const dashboard = document.getElementById("dashboard");
const list = document.getElementById("list");
const editor = document.getElementById("editor");
const media = document.getElementById("entry-media");
const body = document.getElementById("entry-body");

let current = null;

const sessionToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
};

const callAdmin = async (payload, files) => {
  const accessToken = await sessionToken();
  if (!accessToken) throw new Error("Sign in first.");
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    apikey: window.CA.supabaseAnonKey,
  };
  let bodyPayload;
  if (files) {
    bodyPayload = files;
    if (!bodyPayload.has("action")) bodyPayload.set("action", payload.action);
    if (payload.id) bodyPayload.set("id", payload.id);
  } else {
    headers["Content-Type"] = "application/json";
    bodyPayload = JSON.stringify(payload);
  }
  const response = await fetch(window.CAClient.functionsUrl("moderate-journal"), {
    method: "POST",
    headers,
    body: bodyPayload,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
};

const showLogin = () => {
  loginForm.hidden = false;
  dashboard.hidden = true;
  editor.hidden = true;
};

const showDashboard = async () => {
  loginForm.hidden = true;
  dashboard.hidden = false;
  const result = await callAdmin({ action: "list" });
  list.innerHTML = (result.entries || [])
    .map(
      (entry) => `<article class="journal-card">
        <time datetime="${entry.entry_date}">${window.CAClient.formatDate(entry.entry_date)}</time>
        <h3>${entry.title}</h3>
        <p class="status">${entry.status}</p>
        <a href="#${entry.id}" data-id="${entry.id}">Edit</a>
      </article>`,
    )
    .join("") || "<p class='status'>No entries yet.</p>";
};

const renderMedia = (entry) => {
  const images = (entry.image_urls || [])
    .map((src, i) => `<label><img src="${src}" alt="" /><input type="checkbox" name="remove_image" value="${entry.image_paths[i] || ""}" /> Remove image</label>`)
    .join("");
  const videos = (entry.video_urls || [])
    .map((src, i) => `<label><video controls src="${src}"></video><input type="checkbox" name="remove_video" value="${entry.video_paths[i] || ""}" /> Remove video</label>`)
    .join("");
  media.innerHTML = images + videos;
};

const openEntry = async (id) => {
  const result = await callAdmin({ action: "preview", id });
  current = result.entry;
  document.getElementById("entry-id").value = current.id;
  document.getElementById("entry-title").value = current.title;
  document.getElementById("entry-date").value = current.entry_date;
  body.innerHTML = current.body_html || "";
  document.getElementById("entry-embeds").value = (current.video_embeds || []).join("\n");
  renderMedia(current);
  editor.hidden = false;
  editor.scrollIntoView({ behavior: "smooth" });
};

document.querySelectorAll(".toolbar [data-cmd]").forEach((button) => {
  button.addEventListener("click", () => {
    document.execCommand(button.dataset.cmd, false);
    body.focus();
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) {
    status.textContent = "Supabase is not configured.";
    return;
  }
  status.textContent = "Signing in…";
  const password = new FormData(loginForm).get("password");
  const { error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  });
  if (error) {
    status.textContent = "Login failed.";
    return;
  }
  loginForm.reset();
  status.textContent = "";
  try {
    await showDashboard();
  } catch (err) {
    status.textContent = err.message;
    showLogin();
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  current = null;
  showLogin();
  status.textContent = "Signed out.";
});

list.addEventListener("click", (event) => {
  const link = event.target.closest("[data-id]");
  if (!link) return;
  event.preventDefault();
  openEntry(link.dataset.id).catch((err) => {
    status.textContent = err.message;
  });
});

editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(editor);
  data.set("action", "update");
  data.set("body_html", body.innerHTML.trim());
  try {
    const result = await callAdmin({ action: "update", id: data.get("id") }, data);
    status.textContent = result.message || "Saved.";
    current = result.entry;
    renderMedia(current);
    await showDashboard();
  } catch (err) {
    status.textContent = err.message;
  }
});

const runAction = async (action) => {
  if (!current) return;
  if (action === "delete" && !confirm("Delete this entry permanently?")) return;
  try {
    const result = await callAdmin({ action, id: current.id });
    status.textContent = result.message;
    if (action === "delete") {
      editor.hidden = true;
      current = null;
    } else if (result.entry) {
      current = result.entry;
    }
    await showDashboard();
  } catch (err) {
    status.textContent = err.message;
  }
};

document.getElementById("approve").addEventListener("click", () => runAction("approve"));
document.getElementById("unpublish").addEventListener("click", () => runAction("unpublish"));
document.getElementById("reject").addEventListener("click", () => runAction("reject"));
document.getElementById("delete").addEventListener("click", () => runAction("delete"));

(async () => {
  if (!supabase) {
    status.textContent = "Supabase is not configured.";
    return;
  }
  const token = await sessionToken();
  if (!token) return;
  try {
    await showDashboard();
  } catch {
    await supabase.auth.signOut();
    showLogin();
  }
})();
