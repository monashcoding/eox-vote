import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";
import { SessionsList } from "@/components/admin/sessions-list";

export const metadata: Metadata = {
  title: "Host console | EOX 2026 Best Dressed",
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
