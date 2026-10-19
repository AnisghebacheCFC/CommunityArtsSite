import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEEK = 60 * 60 * 24 * 7;

export const signMedia = async (
  supabase: ReturnType<typeof createClient>,
  paths: string[],
) => {
  const clean = (paths || []).filter(Boolean);
  if (!clean.length) return [];
  const { data } = await supabase.storage.from("journal").createSignedUrls(clean, WEEK);
  return (data || []).map((item) => item.signedUrl).filter(Boolean);
};
