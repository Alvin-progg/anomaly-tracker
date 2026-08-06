import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";

export default async function AdminPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/personnel");
  }

  return (
    <>
      <Header title="Dashboard" subtitle="Overview of system activity" username={session.email} />
      <main className="flex-1 p-7">
        <p className="text-sm text-[#6B7A99]">Signed in as {session.email}</p>
      </main>
    </>
  );
}
