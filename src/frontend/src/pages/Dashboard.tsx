import { useEffect, useState } from "react";
import type { DashboardStats } from "../backend";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useActor } from "../hooks/useActor";
import { formatDate, formatRupees } from "../utils/format";
import Calendar from "./Calendar";

interface Props {
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ onNavigate }: Props) {
  const { actor } = useActor();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor) return;
    setLoading(true);
    actor
      .getDashboardStats()
      .then((s) => {
        setStats(s);
      })
      .finally(() => setLoading(false));
  }, [actor]);

  if (loading) {
    return (
      <div
        data-ocid="dashboard.loading_state"
        className="text-center py-20 text-gray-400"
      >
        Loading dashboard...
      </div>
    );
  }

  return (
    <div data-ocid="dashboard.section">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">
              Balance in Hand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats ? formatRupees(stats.balanceInHand) : "--"}
            </div>
            <div className="text-xs opacity-75 mt-1">Available to lend</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">
              Principal Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats ? formatRupees(stats.principalOutstanding) : "--"}
            </div>
            <div className="text-xs opacity-75 mt-1">Total principal lent</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats ? formatRupees(stats.totalOutstanding) : "--"}
            </div>
            <div className="text-xs opacity-75 mt-1">With interest</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <Button
          data-ocid="dashboard.disburse_loan.primary_button"
          onClick={() => onNavigate("loans")}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          + Disburse Loan
        </Button>
        <Button
          data-ocid="dashboard.record_payment.secondary_button"
          onClick={() => onNavigate("payments")}
          variant="outline"
        >
          Record Payment
        </Button>
        <Button
          data-ocid="dashboard.add_customer.secondary_button"
          onClick={() => onNavigate("customers")}
          variant="outline"
        >
          Add Customer
        </Button>
      </div>

      {/* Collection Calendar */}
      <div className="mt-2">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Collection Calendar
        </h3>
        <Calendar />
      </div>
    </div>
  );
}
