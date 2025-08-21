import { createSupabaseClient } from "./supabase";

export type UserBilling = {
  plan: string;
  status: string;
  credits: number;
};

export async function fetchUserBilling(userId: string): Promise<{
  billing: UserBilling | null;
  errorMessage?: string;
}> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("user_billing")
    .select("plan,status,credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Most likely table missing or RLS/policy issue. Return a helpful message.
    return {
      billing: null,
      errorMessage:
        "Billing data not available yet. Ensure the 'user_billing' table exists and RLS policies allow reads.",
    };
  }

  if (!data) {
    return { billing: null };
  }

  const billing: UserBilling = {
    plan: (data as any).plan,
    status: (data as any).status,
    credits: Number((data as any).credits ?? 0),
  };
  return { billing };
}



