import { supabase } from "@/lib/supabase/client";

type PopularSearchRow = {
  normalized_term: string;
  search_count: number | string;
};

export async function fetchPopularSearchTerms(limit = 8) {
  const { data, error } = await supabase.rpc(
    "list_popular_storefront_searches",
    { p_limit: limit },
  );

  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      console.warn(
        "Popular searches are unavailable until migration 013 is applied.",
      );
      return [];
    }

    console.error("Failed to fetch popular searches:", error);
    throw error;
  }

  return ((data ?? []) as PopularSearchRow[]).map(
    (row) => row.normalized_term,
  );
}
