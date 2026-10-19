import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { signMedia } from "../_shared/media.ts";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const presentApproved = async (
  supabase: ReturnType<typeof createClient>,
  entry: Record<string, unknown>,
) => {
  const imageUrls = await signMedia(supabase, (entry.image_paths as string[]) || []);
  const videoUrls = await signMedia(supabase, (entry.video_paths as string[]) || []);
  return {
    id: entry.id,
    title: entry.title,
    entry_date: entry.entry_date,
    excerpt: entry.excerpt,
    body_html: entry.body_html,
    video_embeds: entry.video_embeds || [],
    image_urls: imageUrls,
    video_urls: videoUrls,
    featured_path: imageUrls[0] || null,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { action, id } = await req.json().catch(() => ({ action: "list" }));

  if (action === "get") {
    if (!id) return json(400, { error: "Missing entry id." });
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, title, entry_date, excerpt, body_html, image_paths, video_paths, video_embeds, status")
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle();
    if (error) return json(500, { error: "Could not load the entry." });
    if (!data) return json(404, { error: "This entry is not published." });
    return json(200, { entry: await presentApproved(supabase, data) });
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, title, entry_date, excerpt, image_paths, video_paths, video_embeds, status")
    .eq("status", "approved")
    .order("entry_date", { ascending: false });
  if (error) return json(500, { error: "Could not load the journal." });
  const entries = await Promise.all((data || []).map((entry) => presentApproved(supabase, entry)));
  return json(200, { entries });
});
