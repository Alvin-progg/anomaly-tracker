import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { getActiveFiscalYear } from "@/app/lib/config/fiscal-years";
import { DocumentsContent } from "./documents-content";

export default async function PersonnelDocumentsPage() {
  const session = await verifySession();
  if (session.role !== "personnel") {
    redirect("/admin");
  }

  const enabled = await isModuleEnabledForPersonnel("document_creation");

  /**
   * The forms stay hand-keyed — the filed sheets name offices and account codes the ledger does not
   * hold — but the fiscal year is not one of those things. It is configured in one place, so seed
   * it here instead of asking the user to remember it. Every field stays editable: printing a
   * registry page for a closed year is legitimate.
   */
  const activeYear = enabled ? await getActiveFiscalYear() : null;

  return (
    <>
      <Header
        title="Document Creation"
        subtitle="Create and print official budget documents"
        username={session.email}
      />
      <main className="flex-1 p-7">
        {enabled ? (
          <DocumentsContent fiscalYearLabel={activeYear?.label ?? ""} fiscalYearEnd={activeYear?.endDate ?? ""} />
        ) : (
          <p className="text-sm text-[#6B7A99]">This section is currently unavailable. Contact your System Administrator.</p>
        )}
      </main>
    </>
  );
}
