export const THRESHOLD_MODULES = {
  obligations: "Obligations",
  allotments: "Allotments",
  liquidations: "Liquidations",
  all_modules: "All Modules",
} as const;

export const THRESHOLD_TYPES = {
  percentage: "Percentage",
  days: "Days",
  amount: "Amount (₱)",
  flag: "Flag (On/Off)",
} as const;

export type ThresholdModule = keyof typeof THRESHOLD_MODULES;
export type ThresholdType = keyof typeof THRESHOLD_TYPES;

export function isThresholdModule(value: string): value is ThresholdModule {
  return value in THRESHOLD_MODULES;
}

export function isThresholdType(value: string): value is ThresholdType {
  return value in THRESHOLD_TYPES;
}
