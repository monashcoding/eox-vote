import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";

export const metadata: Metadata = {
  title: "Admin Console | MAC Best Dressed",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminGate />;
}
