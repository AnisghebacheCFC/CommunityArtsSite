import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ADMIN_EMAIL = "anis@communityarts.org.uk";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_VIDEO = 12 * 1024 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const publicUrl = (path: string) => {
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  return `${base}/storage/v1/object/public/journal/${path}`;
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
    if (host === "vimeo.com") {
      return `https://player.vimeo.com/video/${url.pathname.split("/").filter(Boolean).pop()}`;
    }
    return "";
  } catch {
    return "";
  }
};

const signedUrls = async (supabase: ReturnType<typeof createClient>, paths: string[]) => {
  if (!paths.length) return [];
  const { data } = await supabase.storage.from("journal").createSignedUrls(paths, 60 * 20);
  return (data || []).map((item) => item.signedUrl).filter(Boolean);
};

const present = async (supabase: ReturnType<typeof createClient>, entry: Record<string, unknown>) => {
  const imagePaths = (entry.image_paths as string[]) || [];
  const videoPaths = (entry.video_paths as string[]) || [];
  const approved = entry.status === "approved";
  return {
    ...entry,
    image_urls: approved ? imagePaths.map(publicUrl) : await signedUrls(supabase, imagePaths),
    video_urls: approved ? videoPaths.map(publicUrl) : await signedUrls(supabase, videoPaths),
  };
};

const movePublic = async (supabase: ReturnType<typeof createClient>, path: string) => {
  if (path.startsWith("public/")) return path;
  const next = path.replace(/^pending\//, "public/");
  const { error } = await supabase.storage.from("journal").move(path, next);
  if (error) throw error;
  return next;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return json(401, { error: "Sign in required." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || userData.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    return json(403, { error: "Not authorised." });
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("admin_action_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hourAgo);
  if ((count || 0) >= 80) return json(429, { error: "Too many admin actions. Try again later." });

  const contentType = req.headers.get("content-type") || "";
  let action = "";
  let id = "";
  let form: FormData | null = null;
  let body: Record<string, unknown> = {};
  if (contentType.includes("multipart/form-data")) {
    form = await req.formData();
    action = String(form.get("action") || "");
    id = String(form.get("id") || "");
  } else {
    body = await req.json();
    action = String(body.action || "");
    id = String(body.id || "");
  }

  const allowed = ["list", "preview", "update", "approve", "reject", "unpublish", "delete"];
  if (!allowed.includes(action)) return json(400, { error: "Invalid action." });
  await supabase.from("admin_action_log").insert({ action });

  if (action === "list") {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, title, entry_date, status, created_at")
      .order("created_at", { ascending: false });
    if (error) return json(500, { error: "Could not load entries." });
    return json(200, { entries: data || [] });
  }

  if (!id) return json(400, { error: "Missing entry id." });
  const { data: entry, error } = await supabase.from("journal_entries").select("*").eq("id", id).maybeSingle();
  if (error || !entry) return json(404, { error: "Entry not found." });

  if (action === "preview") {
    return json(200, { entry: await present(supabase, entry) });
  }

  if (action === "delete") {
    const paths = [...(entry.image_paths || []), ...(entry.video_paths || [])];
    if (paths.length) await supabase.storage.from("journal").remove(paths);
    await supabase.from("journal_entries").delete().eq("id", id);
    return json(200, { message: "Entry deleted." });
  }

  if (action === "reject") {
    const { data: updated } = await supabase
      .from("journal_entries")
      .update({ status: "rejected", published_at: null })
      .eq("id", id)
      .select("*")
      .single();
    return json(200, { message: "Entry rejected.", entry: await present(supabase, updated) });
  }

  if (action === "unpublish") {
    const { data: updated } = await supabase
      .from("journal_entries")
      .update({ status: "unpublished", published_at: null })
      .eq("id", id)
      .select("*")
      .single();
    return json(200, { message: "Entry unpublished.", entry: await present(supabase, updated) });
  }

  if (action === "approve") {
    const imagePaths = await Promise.all((entry.image_paths || []).map((path: string) => movePublic(supabase, path)));
    const videoPaths = await Promise.all((entry.video_paths || []).map((path: string) => movePublic(supabase, path)));
    const imageUrls = imagePaths.map(publicUrl);
    const videoUrls = videoPaths.map(publicUrl);
    const published = {
      status: "approved",
      published_at: new Date().toISOString(),
      image_paths: imagePaths,
      video_paths: videoPaths,
      image_urls: imageUrls,
      video_urls: videoUrls,
      featured_path: imageUrls[0] || null,
    };
    const { data: updated } = await supabase.from("journal_entries").update(published).eq("id", id).select("*").single();
    return json(200, { message: "Entry published.", entry: await present(supabase, updated) });
  }

  if (action === "update" && form) {
    const title = String(form.get("title") || "").trim();
    const entryDate = String(form.get("entry_date") || "").trim();
    const bodyHtml = sanitizeHtml(String(form.get("body_html") || "").trim());
    if (!title || !entryDate || !bodyHtml) return json(400, { error: "Title, date and body are required." });

    const removeImages = new Set(form.getAll("remove_image").map(String).filter(Boolean));
    const removeVideos = new Set(form.getAll("remove_video").map(String).filter(Boolean));
    let imagePaths = ((entry.image_paths || []) as string[]).filter((path) => !removeImages.has(path));
    let videoPaths = ((entry.video_paths || []) as string[]).filter((path) => !removeVideos.has(path));
    const removed = [...removeImages, ...removeVideos];
    if (removed.length) await supabase.storage.from("journal").remove(removed);

    const folder = entry.status === "approved" ? "public" : "pending";
    const images = form.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
    const videos = form.getAll("videos").filter((item): item is File => item instanceof File && item.size > 0);
    for (const file of images) {
      if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE) {
        return json(400, { error: "Images must be JPG, PNG, WEBP or GIF under 4MB." });
      }
      const safe = file.name.replace(/[^\w.\-]+/g, "-").slice(-80);
      const path = `${folder}/${id}/images-${imagePaths.length}-${safe}`;
      const { error: uploadError } = await supabase.storage.from("journal").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) return json(500, { error: "Could not store image." });
      imagePaths.push(path);
    }
    for (const file of videos) {
      if (!VIDEO_TYPES.includes(file.type) || file.size > MAX_VIDEO) {
        return json(400, { error: "Videos must be MP4 or WEBM under 12MB." });
      }
      const safe = file.name.replace(/[^\w.\-]+/g, "-").slice(-80);
      const path = `${folder}/${id}/videos-${videoPaths.length}-${safe}`;
      const { error: uploadError } = await supabase.storage.from("journal").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) return json(500, { error: "Could not store video." });
      videoPaths.push(path);
    }

    const embeds = String(form.get("embeds") || "")
      .split("\n")
      .map(embedUrl)
      .filter(Boolean)
      .slice(0, 3);
    const excerpt = bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    const imageUrls = entry.status === "approved" ? imagePaths.map(publicUrl) : [];
    const videoUrls = entry.status === "approved" ? videoPaths.map(publicUrl) : [];
    const { data: updated, error: updateError } = await supabase
      .from("journal_entries")
      .update({
        title,
        entry_date: entryDate,
        body_html: bodyHtml,
        excerpt,
        image_paths: imagePaths,
        video_paths: videoPaths,
        video_embeds: embeds,
        image_urls: imageUrls,
        video_urls: videoUrls,
        featured_path: imageUrls[0] || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) return json(500, { error: "Could not save the entry." });
    return json(200, { message: "Saved. The public journal will update for approved entries.", entry: await present(supabase, updated) });
  }

  return json(400, { error: "Invalid update." });
});
