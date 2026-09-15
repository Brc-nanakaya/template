import { requireUser } from "@/lib/auth/server";
import { OrdinanceAdmin } from "@/components/rag/OrdinanceAdmin";

export default async function RagAdminPage() {
  const user = await requireUser("/rag/admin");
  return <OrdinanceAdmin isAdmin={user.role === "admin"} />;
}
