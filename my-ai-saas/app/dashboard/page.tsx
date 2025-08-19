import { redirect } from "next/navigation";

export default async function DashboardPage() {
  // Route retired: keep placeholder and redirect users to Social Twin
  redirect("/social-twin");
}


