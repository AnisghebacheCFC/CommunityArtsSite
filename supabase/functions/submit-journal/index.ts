import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_VIDEO = 12 * 1024 * 1024;
const ADMIN_EMAIL = "anis@communityarts.org.uk";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const sanitizeHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");

const embedUrl = (raw: string) => {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const id = url.searchParams.get("v") || url.pathname.split("/").pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (host === "vimeo.com") return `https://player.vimeo.com/video/${url.pathname.split("/").filter(Boolean).pop()}`;
    return "";
  } catch {
    return "";
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const form = await req.formData();
  if (String(form.get("company") || "")) return json(400, { error: "Rejected." });

  const started = Number(form.get("started") || 0);
  if (!started || Date.now() - started < 2500) return json(400, { error: "Please wait a moment and try again." });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("submission_log")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", hourAgo);
  if ((count || 0) >= 5) return json(429, { error: "Too many submissions. Try again later." });

  const title = String(form.get("title") || "").trim();
  const entryDate = String(form.get("entry_date") || "").trim();
  const bodyHtml = sanitizeHtml(String(form.get("body_html") || "").trim());
  if (!title || !entryDate || !bodyHtml) return json(400, { error: "Title, date and body are required." });

  const images = form.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
  const videos = form.getAll("videos").filter((item): item is File => item instanceof File && item.size > 0);
  if (images.length > 6) return json(400, { error: "Maximum 6 images." });
  if (videos.length > 2) return json(400, { error: "Maximum 2 videos. Use a link for larger files." });
  for (const file of images) {
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE) {
      return json(400, { error: "Images must be JPG, PNG, WEBP or GIF under 4MB." });
    }
  }
  for (const file of videos) {
    if (!VIDEO_TYPES.includes(file.type) || file.size > MAX_VIDEO) {
      return json(400, { error: "Videos must be MP4 or WEBM under 12MB, or use a YouTube/Vimeo link." });
    }
  }

  const embeds = String(form.get("embeds") || "")
    .split("\n")
    .map(embedUrl)
    .filter(Boolean)
    .slice(0, 3);

  const excerpt = bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  const token = crypto.randomUUID() + crypto.randomUUID();
  const reviewTokenHash = await sha256(token);
  const id = crypto.randomUUID();

  const imagePaths: string[] = [];
  const videoPaths: string[] = [];
  const upload = async (file: File, kind: "images" | "videos", bag: string[]) => {
    const safe = file.name.replace(/[^\w.\-]+/g, "-").slice(-80);
    const path = `pending/${id}/${kind}-${bag.length}-${safe}`;
    const { error } = await supabase.storage.from("journal").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    bag.push(path);
  };

  try {
    for (const file of images) await upload(file, "images", imagePaths);
    for (const file of videos) await upload(file, "videos", videoPaths);
  } catch {
    return json(500, { error: "Could not store attachments." });
  }

  const { error: insertError } = await supabase.from("journal_entries").insert({
    id,
    title,
    entry_date: entryDate,
    body_html: bodyHtml,
    excerpt,
    status: "pending",
    review_token_hash: reviewTokenHash,
    image_paths: imagePaths,
    video_paths: videoPaths,
    video_embeds: embeds,
  });
  if (insertError) return json(500, { error: "Could not save the entry." });
  await supabase.from("submission_log").insert({ ip });

  const site = Deno.env.get("SITE_URL") || "https://communityarts.org.uk";
  const reviewLink = `${site}/review.html?id=${id}&token=${token}`;
  const preview = excerpt || title;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "Community Arts <notifications@communityarts.org.uk>",
        to: [ADMIN_EMAIL],
        subject: `Journal entry pending: ${title}`,
        text: [
          `Title: ${title}`,
          `Date: ${entryDate}`,
          `Preview: ${preview}`,
          "",
          `Review (sign in required): ${reviewLink}`,
        ].join("\n"),
      }),
    });
  }

  return json(200, { ok: true });
});
