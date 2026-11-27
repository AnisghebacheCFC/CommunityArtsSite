import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const REACTIONS = ["love", "applaud", "inspired", "growth", "together"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const payload = await req.json().catch(() => ({}));
  const entryId = String(payload.entry_id || "");
  const clientId = String(payload.client_id || "");
  const reaction = String(payload.reaction || "");
  if (!UUID.test(entryId) || !UUID.test(clientId)) return json(400, { error: "Missing entry." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .select("id, journal, status")
    .eq("id", entryId)
    .maybeSingle();
  if (entryError) return json(500, { error: "Could not load reactions." });
  if (!entry || entry.status !== "approved" || (entry.journal && entry.journal !== "community")) {
    return json(404, { error: "This entry cannot be reacted to." });
  }

  if (payload.action === "add") {
    if (!REACTIONS.includes(reaction)) return json(400, { error: "Choose a reaction." });
    const { error } = await supabase.from("journal_reactions").insert({
      entry_id: entryId,
      client_id: clientId,
      reaction,
    });
    if (error && error.code !== "23505") return json(500, { error: "Could not save the reaction." });
  } else if (payload.action !== "list") {
    return json(400, { error: "Unknown action." });
  }

  const { data: rows, error } = await supabase
    .from("journal_reactions")
    .select("reaction, client_id")
    .eq("entry_id", entryId);
  if (error) return json(500, { error: "Could not load reactions." });

  const counts = Object.fromEntries(REACTIONS.map((name) => [name, 0]));
  const mine: string[] = [];
  for (const row of rows || []) {
    if (counts[row.reaction] != null) counts[row.reaction] += 1;
    if (row.client_id === clientId) mine.push(row.reaction);
  }
  return json(200, { counts, mine });
});
