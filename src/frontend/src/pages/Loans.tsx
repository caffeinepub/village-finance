import { useCallback, useEffect, useState } from "react";
import type { Customer, Loan, Payment, Village } from "../backend";
import { Variant_closed_active } from "../backend";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useActor } from "../hooks/useActor";
import { formatDate, formatRupees, rupeeInputToPaise } from "../utils/format";

export default function Loans() {
  const { actor } = useActor();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [form, setForm] = useState({
    customerId: "",
    principal: "",
    interestRate: "",
    tenure: "",
    processingFee: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!actor) return;
    Promise.all([
      actor.getAllLoans(),
      actor.getAllCustomers(),
      actor.getAllVillages(),
    ])
      .then(([l, c, v]) => {
        setLoans(l);
        setCustomers(c);
        setVillages(v);
      })
      .finally(() => setLoading(false));
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const getCustomer = (id: bigint) => customers.find((c) => c.id === id);
  const getVillage = (id: bigint) => villages.find((v) => v.id === id);

  const principal = Number.parseFloat(form.principal) || 0;
  const rate = Number.parseFloat(form.interestRate) || 0;
  const tenure = Number.parseInt(form.tenure) || 0;
  const totalInterest = (principal * rate * tenure) / 100;
  const totalAmount = principal + totalInterest;
  const emi = tenure > 0 ? totalAmount / tenure : 0;

  const disburse = async () => {
    if (!actor || !form.customerId || !form.principal) return;
    setSaving(true);
    try {
      const customer = customers.find(
        (c) => c.id.toString() === form.customerId,
      );
      if (!customer) return;
      await actor.disburseLoan(
        customer.id,
        customer.villageId,
        rupeeInputToPaise(form.principal),
        BigInt(Math.round(rate * 100)),
        BigInt(tenure),
        rupeeInputToPaise(form.processingFee || "0"),
      );
      setDisburseOpen(false);
      setForm({
        customerId: "",
        principal: "",
        interestRate: "",
        tenure: "",
        processingFee: "",
      });
      load();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const viewDetail = async (loan: Loan) => {
    setDetailLoan(loan);
    if (actor) {
      const p = await actor.getPaymentsByLoan(loan.loanId);
      setPayments(p);
    }
  };

  if (loading)
    return (
      <div
        data-ocid="loans.loading_state"
        className="text-center py-20 text-gray-400"
      >
        Loading...
      </div>
    );

  return (
    <div data-ocid="loans.section">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Loans</h2>
        <Button
          data-ocid="loans.disburse.primary_button"
          onClick={() => setDisburseOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          + Disburse Loan
        </Button>
      </div>

      {loans.length === 0 ? (
        <div
          data-ocid="loans.empty_state"
          className="text-center py-20 text-gray-400"
        >
          No loans yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loans.map((loan, i) => {
            const customer = getCustomer(loan.customerId);
            const village = getVillage(loan.villageId);
            return (
              <Card
                key={loan.id.toString()}
                data-ocid={`loans.item.${i + 1}`}
                className="border-0 shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => viewDetail(loan)}
              >
                <div
                  className={`p-4 text-white ${
                    loan.status === Variant_closed_active.active
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                      : "bg-gradient-to-r from-gray-500 to-gray-600"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-mono text-sm opacity-80">
                        {loan.loanId}
                      </div>
                      <div className="font-bold text-lg">
                        {customer?.name || "--"}
                      </div>
                      {village && (
                        <div className="text-xs opacity-75">
                          {village.shortCode} - {village.name}
                        </div>
                      )}
                    </div>
                    <Badge
                      className={
                        loan.status === Variant_closed_active.active
                          ? "bg-green-400 text-green-900"
                          : "bg-gray-300 text-gray-700"
                      }
                    >
                      {loan.status}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500">Principal</div>
                    <div className="font-bold">
                      {formatRupees(loan.principal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">EMI</div>
                    <div className="font-bold">{formatRupees(loan.emi)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Tenure</div>
                    <div className="font-bold">
                      {loan.tenureMonths.toString()} months
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Processing Fee</div>
                    <div className="font-bold">
                      {formatRupees(loan.processingFee)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Total Amount</div>
                    <div className="font-bold text-indigo-700">
                      {formatRupees(loan.totalAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Disbursed</div>
                    <div className="font-bold">
                      {formatDate(loan.disbursedAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Disburse Dialog */}
      <Dialog open={disburseOpen} onOpenChange={setDisburseOpen}>
        <DialogContent data-ocid="loans.disburse.dialog" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disburse New Loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Customer</Label>
              <Select
                value={form.customerId}
                onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))}
              >
                <SelectTrigger data-ocid="loans.customer.select">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id.toString()} value={c.id.toString()}>
                      {c.name} - {c.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Principal (₹)</Label>
                <Input
                  data-ocid="loans.principal.input"
                  type="number"
                  value={form.principal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, principal: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Interest Rate (%)</Label>
                <Input
                  data-ocid="loans.rate.input"
                  type="number"
                  value={form.interestRate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, interestRate: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Tenure (months)</Label>
                <Input
                  data-ocid="loans.tenure.input"
                  type="number"
                  value={form.tenure}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tenure: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Processing Fee (₹)</Label>
                <Input
                  data-ocid="loans.fee.input"
                  type="number"
                  value={form.processingFee}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, processingFee: e.target.value }))
                  }
                />
              </div>
            </div>
            {principal > 0 && rate > 0 && tenure > 0 && (
              <div className="bg-indigo-50 p-3 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total Interest:</span>
                  <span className="font-bold">₹{totalInterest.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Amount:</span>
                  <span className="font-bold">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-indigo-700">
                  <span>Monthly EMI:</span>
                  <span className="font-bold">₹{emi.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              data-ocid="loans.cancel.cancel_button"
              variant="outline"
              onClick={() => setDisburseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="loans.disburse.confirm_button"
              onClick={disburse}
              disabled={saving}
            >
              {saving ? "Processing..." : "Disburse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        open={!!detailLoan}
        onOpenChange={(v) => !v && setDetailLoan(null)}
      >
        <DialogContent data-ocid="loans.detail.dialog" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Loan Details - {detailLoan?.loanId}</DialogTitle>
          </DialogHeader>
          {detailLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Customer:</span>{" "}
                  <span className="font-medium">
                    {getCustomer(detailLoan.customerId)?.name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Village:</span>{" "}
                  <span className="font-medium">
                    {getVillage(detailLoan.villageId)?.shortCode}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Principal:</span>{" "}
                  <span className="font-medium">
                    {formatRupees(detailLoan.principal)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">EMI:</span>{" "}
                  <span className="font-medium">
                    {formatRupees(detailLoan.emi)}
                  </span>
                </div>
              </div>
              <div>
                <div className="font-semibold mb-2">Payment History</div>
                {payments.length === 0 ? (
                  <div className="text-center text-gray-400 py-4">
                    No payments yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {payments.map((p, i) => (
                      <div
                        key={p.id.toString()}
                        data-ocid={`loan_payments.item.${i + 1}`}
                        className="flex justify-between text-sm bg-gray-50 p-2 rounded"
                      >
                        <span>{formatDate(p.paymentDate)}</span>
                        <span className="font-medium text-green-700">
                          {formatRupees(p.amountPaid)}
                        </span>
                        <span className="text-gray-500">
                          Bal: {formatRupees(p.totalOutstanding)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              data-ocid="loans.detail.close_button"
              variant="outline"
              onClick={() => setDetailLoan(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
