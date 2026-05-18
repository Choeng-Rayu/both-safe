import { requireUser } from "@/lib/auth";
import { WalletPage } from "@/components/wallet/wallet-page";

export const metadata = {
  title: "Wallet — BothSafe",
  description: "Your BothSafe wallet balance, recent activity, and withdrawals.",
};

export default async function WalletRoute() {
  const user = await requireUser("/wallet");
  return <WalletPage user={user} />;
}
