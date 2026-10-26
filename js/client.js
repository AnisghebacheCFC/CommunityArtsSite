const configured = () =>
  Boolean(window.CA?.supabaseUrl && window.CA?.supabaseAnonKey);

const client = () => {
  if (!configured() || !window.supabase?.createClient) return null;
  return window.supabase.createClient(window.CA.supabaseUrl, window.CA.supabaseAnonKey);
};

const functionsUrl = (name) =>
  `${window.CA.supabaseUrl.replace(/\/$/, "")}/functions/v1/${name}`;

const parseDate = (value) => {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const day = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  const parsed = day ? new Date(`${day[1]}T00:00:00`) : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parsed);
  } catch {
    return "";
  }
};

const dateInputValue = (value) => {
  const raw = String(value ?? "").trim();
  const day = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return day ? day[1] : "";
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

window.CAClient = { configured, client, functionsUrl, formatDate, dateInputValue, excerptFrom, callFunction };
