import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";
import { SessionsList } from "@/components/admin/sessions-list";

export const metadata: Metadata = {
  title: "Host console | MAC best dressed",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return (
    <AdminGate>
      <SessionsList />
    </AdminGate>
  );
}
