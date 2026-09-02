"use client";

import { useState } from "react";
import { OrsDocument } from "./ors-document";
import { AbcDocument } from "./abc-document";
import { SaaoDocument } from "./saao-document";
import { SefDocument } from "./sef-document";
import { RaaoLedgerDocument } from "./raao-ledger-document";

/** Tab labels are the forms' own printed titles — see the scans in `sample/`. */
const TABS = [
  { key: "ors", label: "Obligation Request" },
  { key: "abc", label: "Approved Budget for the Contract" },
  { key: "saao", label: "Status of Appropriation, Allotment and Obligations" },
  { key: "sef", label: "Special Education Fund" },
  { key: "raao", label: "RAAO — Personal Services" },
] as const;

type DocType = (typeof TABS)[number]["key"];

export function DocumentsContent({
  fiscalYearLabel,
  fiscalYearEnd,
}: {
  fiscalYearLabel: string;
  fiscalYearEnd: string;
}) {
  const [docType, setDocType] = useState<DocType>("ors");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="no-print flex flex-wrap gap-5 border-b border-[#D1D9E6]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setDocType(t.key)}
            className={`pb-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              docType === t.key ? "text-[#1F3864] border-[#1F3864]" : "text-[#6B7A99] border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/*
        Every form stays mounted and the inactive ones are hidden with CSS. Rendering only the
        active tab unmounted the others, silently discarding everything typed — worst on the RAAO
        registry, which can hold 23 columns across many bands. `hidden` also keeps the inactive
        forms out of the print output, which relies on there being one visible `.print-area`.
      */}
      <div hidden={docType !== "ors"}>
        <OrsDocument />
      </div>
      <div hidden={docType !== "abc"}>
        <AbcDocument />
      </div>
      <div hidden={docType !== "saao"}>
        <SaaoDocument defaultAsOf={fiscalYearEnd} />
      </div>
      <div hidden={docType !== "sef"}>
        <SefDocument defaultAsOf={fiscalYearEnd} />
      </div>
      <div hidden={docType !== "raao"}>
        <RaaoLedgerDocument defaultFiscalYear={fiscalYearLabel} />
      </div>
    </div>
  );
}
