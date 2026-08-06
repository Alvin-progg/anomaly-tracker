"use client";

import type { ReactNode } from "react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 bg-[rgba(10,20,40,0.5)] flex items-center justify-center z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-[10px] w-[520px] max-h-[90vh] overflow-auto px-7 py-7 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <div className="text-base font-bold text-[#1F3864]">{title}</div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-[#6B7A99] text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
