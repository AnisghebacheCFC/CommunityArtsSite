import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { signMedia } from "../_shared/media.ts";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data, error } = await supabase
    .from("featured_artwork")
    .select("image_path, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return json(500, { error: "Could not load the featured artwork." });
  if (!data?.image_path) return json(200, {});
  const [imageUrl] = await signMedia(supabase, [data.image_path]);
  return json(200, {
    image_url: imageUrl || "",
    title: "",
    artist: "",
    journal_url: "",
    uploaded_at: data.updated_at || "",
  });
});
