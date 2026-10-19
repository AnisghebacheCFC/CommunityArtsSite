const configured = () =>
  Boolean(window.CA?.supabaseUrl && window.CA?.supabaseAnonKey);

const client = () => {
  if (!configured() || !window.supabase?.createClient) return null;
  return window.supabase.createClient(window.CA.supabaseUrl, window.CA.supabaseAnonKey);
};

const functionsUrl = (name) =>
  `${window.CA.supabaseUrl.replace(/\/$/, "")}/functions/v1/${name}`;

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
};

const excerptFrom = (html, length = 180) => {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};

const callFunction = async (name, payload) => {
  const response = await fetch(functionsUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: window.CA.supabaseAnonKey,
      Authorization: `Bearer ${window.CA.supabaseAnonKey}`,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
};

window.CAClient = { configured, client, functionsUrl, formatDate, excerptFrom, callFunction };
