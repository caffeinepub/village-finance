import { useEffect, useState } from "react";
import type { Customer, Loan } from "../backend";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useActor } from "../hooks/useActor";
import { formatRupees } from "../utils/format";

interface EMIEntry {
  loan: Loan;
  customer: Customer;
  dueDate: Date;
  emiNumber: number;
  amount: bigint;
  status: "overdue" | "today" | "soon" | "upcoming";
}

export default function Calendar() {
  const { actor } = useActor();
  const [entries, setEntries] = useState<EMIEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor) return;
    (async () => {
      const [loans, customers] = await Promise.all([
        actor.getAllLoans(),
        actor.getAllCustomers(),
      ]);
      const now = new Date();
      const in30 = new Date();
      in30.setDate(now.getDate() + 30);
      const result: EMIEntry[] = [];

      for (const loan of loans) {
        if (loan.status !== "active") continue;
        const customer = customers.find((c) => c.id === loan.customerId);
        if (!customer) continue;
        const payments = await actor.getPaymentsByLoan(loan.loanId);
        const paidCount = payments.length;
        const disbursedMs = Number(loan.disbursedAt) / 1_000_000;
        const disbursed = new Date(disbursedMs);
        let nextEMI: EMIEntry | null = null;

        for (let i = paidCount; i < Number(loan.tenureMonths); i++) {
          const due = new Date(disbursed);
          due.setMonth(due.getMonth() + i + 1);
          if (due > in30) break;
          const daysUntil = Math.ceil(
            (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          let status: EMIEntry["status"] = "upcoming";
          if (daysUntil < 0) status = "overdue";
          else if (daysUntil === 0) status = "today";
          else if (daysUntil <= 4) status = "soon";
          nextEMI = {
            loan,
            customer,
            dueDate: due,
            emiNumber: i + 1,
            amount: loan.emi,
            status,
          };
        }
        if (nextEMI) result.push(nextEMI);
      }
      result.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      setEntries(result);
      setLoading(false);
    })();
  }, [actor]);

  const statusColor = (s: EMIEntry["status"]) => {
    if (s === "overdue") return "bg-red-100 border-red-300";
    if (s === "today") return "bg-orange-100 border-orange-300";
    if (s === "soon") return "bg-yellow-100 border-yellow-300";
    return "bg-blue-50 border-blue-200";
  };

  const badgeColor = (s: EMIEntry["status"]) => {
    if (s === "overdue") return "bg-red-500";
    if (s === "today") return "bg-orange-500";
    if (s === "soon") return "bg-yellow-500 text-yellow-900";
    return "bg-blue-500";
  };

  const sendReminder = (entry: EMIEntry) => {
    const msg = `Dear ${entry.customer.name}, your EMI of ${formatRupees(entry.amount)} for loan ${entry.loan.loanId} is due on ${entry.dueDate.toLocaleDateString("en-IN")}. Please pay on time. - Village Finance`;
    window.open(
      `https://wa.me/${entry.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  };

  if (loading)
    return (
      <div
        data-ocid="calendar.loading_state"
        className="text-center py-20 text-gray-400"
      >
        Loading calendar...
      </div>
    );

  return (
    <div data-ocid="calendar.section">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">
        Collection Calendar
      </h2>
      <p className="text-gray-500 mb-6">
        Upcoming EMI due dates in the next 30 days
      </p>

      <div className="flex gap-3 mb-4 flex-wrap text-xs">
        {(["overdue", "today", "soon", "upcoming"] as const).map((s) => (
          <div
            key={s}
            className={`px-3 py-1 rounded-full border ${statusColor(s)}`}
          >
            {s}
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div
          data-ocid="calendar.empty_state"
          className="text-center py-20 text-gray-400"
        >
          No upcoming EMIs in next 30 days.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e, i) => (
            <Card
              key={`${e.loan.loanId}-${e.emiNumber}`}
              data-ocid={`calendar.item.${i + 1}`}
              className={`border-2 ${statusColor(e.status)}`}
            >
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{e.customer.name}</span>
                    <Badge className={badgeColor(e.status)}>{e.status}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {e.loan.loanId} · EMI #{e.emiNumber}
                  </div>
                  <div className="text-sm font-medium text-indigo-700">
                    Due:{" "}
                    {e.dueDate.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {formatRupees(e.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {e.customer.phone}
                    </div>
                  </div>
                  <Button
                    data-ocid={`calendar.reminder_button.${i + 1}`}
                    onClick={() => sendReminder(e)}
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    Send Reminder
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
