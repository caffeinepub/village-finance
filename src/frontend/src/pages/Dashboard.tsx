import { useEffect, useState } from "react";
import {
  type BalanceTransaction,
  type DashboardStats,
  Variant_adjustment_collection_disbursal,
} from "../backend";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useActor } from "../hooks/useActor";
import { formatDate, formatRupees } from "../utils/format";

interface Props {
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ onNavigate }: Props) {
  const { actor } = useActor();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor) return;
    setLoading(true);
    Promise.all([actor.getDashboardStats(), actor.getAllTransactions()])
      .then(([s, t]) => {
        setStats(s);
        const sorted = [...t].sort((a, b) => Number(b.date) - Number(a.date));
        setTransactions(sorted.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, [actor]);

  const txTypeColor = (type: Variant_adjustment_collection_disbursal) => {
    if (type === Variant_adjustment_collection_disbursal.disbursal)
      return "bg-red-100 text-red-700";
    if (type === Variant_adjustment_collection_disbursal.collection)
      return "bg-green-100 text-green-700";
    return "bg-blue-100 text-blue-700";
  };

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

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div
              data-ocid="transactions.empty_state"
              className="text-center py-8 text-gray-400"
            >
              No transactions yet
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx, i) => (
                <div
                  key={tx.id.toString()}
                  data-ocid={`transactions.item.${i + 1}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-sm">{tx.description}</div>
                    <div className="text-xs text-gray-500">
                      {formatDate(tx.date)} · Ref: {tx.referenceId}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={txTypeColor(tx.type)}>{tx.type}</Badge>
                    <span
                      className={`font-bold ${tx.type === Variant_adjustment_collection_disbursal.disbursal ? "text-red-600" : "text-green-600"}`}
                    >
                      {tx.type ===
                      Variant_adjustment_collection_disbursal.disbursal
                        ? "-"
                        : "+"}
                      {formatRupees(tx.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
