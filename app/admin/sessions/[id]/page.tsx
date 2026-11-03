import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminGate } from "@/components/admin/admin-gate";
import { SessionDetailView } from "@/components/admin/session-detail-view";

export const metadata: Metadata = {
  title: "Session | EOX Best Dressed",
  robots: {
    index: false,
    follow: false,
  },
};

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

async function SessionDetailContent({ params }: SessionPageProps) {
  const { id } = await params;
  return <SessionDetailView sessionId={id} />;
}

export default function SessionDetailPage(props: SessionPageProps) {
  return (
    <AdminGate>
      <Suspense
        fallback={
          <div className="space-y-6" aria-busy="true">
            <Skeleton className="h-24" />
            <Skeleton className="h-96" />
          </div>
        }
      >
        <SessionDetailContent params={props.params} />
      </Suspense>
    </AdminGate>
  );
}
