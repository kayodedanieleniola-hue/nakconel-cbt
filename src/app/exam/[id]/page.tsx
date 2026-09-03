import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ExamClient from "@/components/ExamClient";

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/login");

  const { id } = await params;
  return <ExamClient examId={id} />;
}
