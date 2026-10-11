import { CustomerChat } from "@/components/chat";
export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  return <CustomerChat orgId={(await params).orgId} />;
}
