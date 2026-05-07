import { requireUser } from '@/lib/auth';
import { DashboardPage } from '@/components/deal/dashboard-page';

export const metadata = {
  title: 'Dashboard — BothSafe',
  description: 'Manage all your deals in one place.',
};

export default async function Dashboard() {
  const user = await requireUser('/dashboard');
  return <DashboardPage user={user} />;
}
