import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import { fetchUserBilling } from "@/lib/billing";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }
  const supabase = createSupabaseClient();

  const [{ count: recipesCreatedCount }, { count: commentsCount }, { count: unlockedCount }] = await Promise.all([
    supabase.from("recipes").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("recipes_unlocked").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const { billing, errorMessage } = await fetchUserBilling(userId);
  const subscriptionPlan = billing?.plan ?? "Not configured";
  const subscriptionStatus = billing?.status ?? "N/A";
  const creditsBalance = billing?.credits ?? "N/A";

  return (
    <main className="mx-auto max-w-4xl p-6 bg-black text-white">
      <h1 className="mb-6 text-3xl font-bold">Dashboard</h1>

      <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-md">
        <h2 className="mb-2 text-xl font-semibold">User</h2>
        <div className="grid gap-1 text-sm">
          <div>
            <span className="font-medium">Name:</span> {user.fullName ?? "Unnamed"}
          </div>
          <div>
            <span className="font-medium">Email:</span> {user?.emailAddresses?.[0]?.emailAddress ?? "-"}
          </div>
          <div className="text-xs opacity-60">
            User ID: {user.id}
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="text-sm opacity-70">Subscription</div>
          <div className="text-lg font-semibold">{subscriptionPlan}</div>
          <div className="text-sm">Status: {subscriptionStatus}</div>
          {errorMessage ? (
            <div className="mt-2 text-xs text-red-500">{errorMessage}</div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <a className="rounded bg-white px-3 py-1 text-black" href="/subscription">Upgrade</a>
            <a className="rounded border border-white/20 px-3 py-1" href="#">Manage</a>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="text-sm opacity-70">Credits</div>
          <div className="text-lg font-semibold">{creditsBalance}</div>
          <a className="mt-3 inline-block rounded bg-white px-3 py-1 text-black" href="#">Buy credits</a>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="text-sm opacity-70">Usage (demo)</div>
          <div className="text-sm">Recipes created: {recipesCreatedCount ?? 0}</div>
          <div className="text-sm">Comments: {commentsCount ?? 0}</div>
          <div className="text-sm">Unlocked: {unlockedCount ?? 0}</div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-md">
        <h2 className="mb-2 text-xl font-semibold">Next steps</h2>
        <ul className="list-disc pl-6 text-sm opacity-90">
          <li>Hook up Stripe webhooks and subscription tables</li>
          <li>Add a credits table and decrement on usage</li>
          <li>Reuse this data in the chat UI</li>
        </ul>
      </section>
    </main>
  );
}


