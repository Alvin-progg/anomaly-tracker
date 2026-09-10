import { Skeleton } from "@/app/components/ui/skeleton";

export default function AlertsLoading() {
  return (
    <>
      <div className="h-16 shrink-0 flex items-center px-7 bg-white border-b border-[#D1D9E6]">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>
      <main className="flex-1 p-7 flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </main>
    </>
  );
}
