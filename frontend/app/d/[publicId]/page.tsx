import { DealRoomPage } from "@/components/deal/deal-room-page";

export default async function DealPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <DealRoomPage publicId={publicId} />;
}
