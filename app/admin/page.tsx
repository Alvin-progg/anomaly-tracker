import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { logoutAction } from "@/app/lib/auth/actions";

export default async function AdminPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/personnel");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-xl font-bold text-[#1F3864]">Admin Portal</h1>
      <p className="text-sm text-gray-600">Signed in as {session.email}</p>
      <form action={logoutAction}>
        <button type="submit" className="px-4 py-2 bg-[#1F3864] text-white rounded-lg text-sm font-semibold">
          Log out
        </button>
      </form>
    </main>
  );
}
