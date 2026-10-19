import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

const publicUrl = (path: string) => {
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  return `${base}/storage/v1/object/public/journal/${path}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return json(401, { error: "Sign in required." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || userData.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    return json(403, { error: "This review inbox is not authorised." });
  }

  const { id, token, action } = await req.json();
  if (!id || !token || !["preview", "approve", "reject"].includes(action)) {
    return json(400, { error: "Invalid review request." });
  }

  const { data: entry, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !entry) return json(404, { error: "Entry not found." });
  if (entry.review_token_hash !== await sha256(token)) {
    return json(403, { error: "This review link is not valid." });
  }

  const signed = async (paths: string[]) => {
    if (!paths.length) return [];
    const { data } = await supabase.storage.from("journal").createSignedUrls(paths, 60 * 20);
    return (data || []).map((item) => item.signedUrl).filter(Boolean);
  };

  if (action === "preview") {
    return json(200, {
      entry: {
        ...entry,
        image_urls: await signed(entry.image_paths || []),
        video_urls: await signed(entry.video_paths || []),
      },
    });
  }

  if (entry.status !== "pending") return json(400, { error: "This entry has already been reviewed." });

  if (action === "reject") {
    await supabase.from("journal_entries").update({ status: "rejected" }).eq("id", id);
    return json(200, { message: "Entry rejected.", entry: { ...entry, status: "rejected" } });
  }

  const move = async (path: string) => {
    const next = path.replace(/^pending\//, "public/");
    const { error: moveError } = await supabase.storage.from("journal").move(path, next);
    if (moveError) throw moveError;
    return next;
  };

  const imagePaths = await Promise.all((entry.image_paths || []).map(move));
  const videoPaths = await Promise.all((entry.video_paths || []).map(move));
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
  await supabase.from("journal_entries").update(published).eq("id", id);

  return json(200, {
    message: "Entry published.",
    entry: { ...entry, ...published },
  });
});
