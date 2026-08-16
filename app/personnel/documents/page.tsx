import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { DocumentsContent } from "./documents-content";

export default async function PersonnelDocumentsPage() {
  const session = await verifySession();
  if (session.role !== "personnel") {
    redirect("/admin");
  }

  const enabled = await isModuleEnabledForPersonnel("document_creation");

  return (
    <>
      <Header title="Document Creation" subtitle="Create and print official budget documents" username={session.email} />
      <main className="flex-1 p-7">
        {enabled ? (
          <DocumentsContent />
        ) : (
          <p className="text-sm text-[#6B7A99]">This section is currently unavailable. Contact your System Administrator.</p>
        )}
      </main>
    </>
  );
}
