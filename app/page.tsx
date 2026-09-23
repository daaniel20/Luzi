import dynamic from "next/dynamic";

const ScheduleApp = dynamic(
  () => import("@/components/luzi/schedule-app").then((mod) => mod.ScheduleApp),
  {
    ssr: false,
    loading: () => (
      <main className="flex h-dvh items-center justify-center px-6 text-center">
        <p className="text-2xl font-bold text-[#355067]">פותחים את הלוח...</p>
      </main>
    ),
  }
);

export default function Page() {
  return <ScheduleApp />;
}
