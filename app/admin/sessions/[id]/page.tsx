import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";
import { SessionDetailView } from "@/components/admin/session-detail-view";

export const metadata: Metadata = {
  title: "Session Details | MAC Best Dressed",
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
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Loading session...
              </span>
            </div>
          </div>
        }
      >
        <SessionDetailContent params={props.params} />
      </Suspense>
    </AdminGate>
  );
}
