const form = document.getElementById("submit-form");
const statusEl = document.getElementById("status");
const bodyEl = document.getElementById("body");
document.getElementById("started").value = String(Date.now());

document.querySelectorAll(".toolbar [data-cmd]").forEach((button) => {
  button.addEventListener("click", () => {
    document.execCommand(button.dataset.cmd, false);
    bodyEl.focus();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!window.CAClient.configured()) {
    statusEl.textContent = "Submissions are not connected yet. Add Supabase keys to js/config.js.";
    return;
  }

  const data = new FormData(form);
  data.set("body_html", bodyEl.innerHTML.trim());
  if (!data.get("body_html") || data.get("body_html") === "<br>") {
    statusEl.textContent = "Please add some writing before submitting.";
    return;
  }

  statusEl.textContent = "Sending for review…";
  try {
    const response = await fetch(window.CAClient.functionsUrl("submit-journal"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${window.CA.supabaseAnonKey}`,
        apikey: window.CA.supabaseAnonKey,
      },
      body: data,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Submission failed.");
    form.reset();
    bodyEl.innerHTML = "";
    statusEl.textContent = "Received. It will stay private until it is approved.";
  } catch (error) {
    statusEl.textContent = error.message;
  }
});
