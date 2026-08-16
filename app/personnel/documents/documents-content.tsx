"use client";

import { useState } from "react";
import { OrsDocument } from "./ors-document";
import { AbcDocument } from "./abc-document";
import { SaaoDocument } from "./saao-document";
import { RaaoLedgerDocument } from "./raao-ledger-document";

const TABS = [
  { key: "ors", label: "Obligation Request (ORS)" },
  { key: "abc", label: "Approved Budget for Contract (ABC)" },
  { key: "saao", label: "Status of Appropriations (SAAO)" },
  { key: "raao", label: "RAAO Ledger Entry" },
] as const;

type DocType = (typeof TABS)[number]["key"];

export function DocumentsContent() {
  const [docType, setDocType] = useState<DocType>("ors");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="no-print flex gap-5 border-b border-[#D1D9E6]">
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

      {docType === "ors" && <OrsDocument />}
      {docType === "abc" && <AbcDocument />}
      {docType === "saao" && <SaaoDocument />}
      {docType === "raao" && <RaaoLedgerDocument />}
    </div>
  );
}
