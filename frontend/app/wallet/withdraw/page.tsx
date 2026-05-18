import { requireUser } from "@/lib/auth";
import { WithdrawForm } from "@/components/wallet/withdraw-form";

export const metadata = {
  title: "Withdraw — BothSafe Wallet",
};

export default async function WithdrawRoute() {
  await requireUser("/wallet/withdraw");
  return <WithdrawForm />;
}
