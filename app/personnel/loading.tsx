import { Skeleton } from "@/app/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <div className="h-16 shrink-0 flex items-center px-7 bg-white border-b border-[#D1D9E6]">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <main className="flex-1 p-7 flex flex-col gap-5">
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </main>
    </>
  );
}
