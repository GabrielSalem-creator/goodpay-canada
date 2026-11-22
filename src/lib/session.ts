import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = "t4g_profile";
export const DEMO_RECIPIENT = "00000000-0000-0000-0000-000000000001";
export const DEMO_PAYER = "00000000-0000-0000-0000-000000000002";

export function setProfileId(id: string | null) {
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("t4g-session"));
}

export function useProfileId() {
  const [state, setState] = useState<{ id: string | null; ready: boolean }>({ id: null, ready: false });
  useEffect(() => {
    const read = () => setState({ id: localStorage.getItem(KEY), ready: true });
    read();
    window.addEventListener("t4g-session", read);
    return () => window.removeEventListener("t4g-session", read);
  }, []);
  return state;
}

export function useProfile() {
  const { id, ready } = useProfileId();
  const q = useQuery({
    queryKey: ["profile", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return { profile: q.data ?? null, loading: !ready || (!!id && q.isLoading), id };
}
