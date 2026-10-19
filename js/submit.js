const form = document.getElementById("submit-form");
const status = document.getElementById("status");
const body = document.getElementById("body");
document.getElementById("started").value = String(Date.now());

document.querySelectorAll(".toolbar [data-cmd]").forEach((button) => {
  button.addEventListener("click", () => {
    document.execCommand(button.dataset.cmd, false);
    body.focus();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!window.CAClient.configured()) {
    status.textContent = "Submissions are not connected yet. Add Supabase keys to js/config.js.";
    return;
  }

  const data = new FormData(form);
  data.set("body_html", body.innerHTML.trim());
  if (!data.get("body_html") || data.get("body_html") === "<br>") {
    status.textContent = "Please add some writing before submitting.";
    return;
  }

  status.textContent = "Sending for review…";
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
    body.innerHTML = "";
    status.textContent = "Received. It will stay private until it is approved.";
  } catch (error) {
    status.textContent = error.message;
  }
});
