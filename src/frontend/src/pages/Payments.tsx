import { useEffect, useRef, useState } from "react";
import type { Customer, Loan, Payment, Village } from "../backend";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
import {
  formatDateTime,
  formatRupees,
  rupeeInputToPaise,
} from "../utils/format";

export default function Payments() {
  const { actor } = useActor();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [penalty, setPenalty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actor) return;
    Promise.all([
      actor.getAllLoans(),
      actor.getAllCustomers(),
      actor.getAllVillages(),
    ]).then(([l, c, v]) => {
      setLoans(l);
      setCustomers(c);
      setVillages(v);
    });
  }, [actor]);

  const selectedLoan = loans.find((l) => l.loanId === selectedLoanId);
  const customer = selectedLoan
    ? customers.find((c) => c.id === selectedLoan.customerId)
    : null;
  const village = selectedLoan
    ? villages.find((v) => v.id === selectedLoan.villageId)
    : null;

  const recordPayment = async () => {
    if (!actor || !selectedLoan || !amount) return;
    setSaving(true);
    try {
      const payment = await actor.recordPayment(
        selectedLoan.loanId,
        selectedLoan.customerId,
        rupeeInputToPaise(amount),
        rupeeInputToPaise(penalty || "0"),
        notes,
      );
      setReceipt(payment);
      setAmount("");
      setPenalty("");
      setNotes("");
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const shareWhatsApp = async () => {
    if (!receipt || !customer) return;
    const text = `Village Finance Receipt\nReceipt No: ${receipt.receiptNo}\nDate: ${new Date(Number(receipt.paymentDate) / 1_000_000).toLocaleString("en-IN")}\nCustomer: ${customer.name}\nLoan ID: ${receipt.loanId}\nAmount Paid: ${formatRupees(receipt.amountPaid)}${receipt.penalty > 0n ? `\nPenalty: ${formatRupees(receipt.penalty)}` : ""}\nOutstanding Principal: ${formatRupees(receipt.outstandingPrincipal)}\nTotal Outstanding: ${formatRupees(receipt.totalOutstanding)}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div data-ocid="payments.section">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Record Payment</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select Loan</Label>
              <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                <SelectTrigger data-ocid="payments.loan.select">
                  <SelectValue placeholder="Search by Loan ID or customer" />
                </SelectTrigger>
                <SelectContent>
                  {loans
                    .filter((l) => l.status === "active")
                    .map((l) => {
                      const c = customers.find((x) => x.id === l.customerId);
                      return (
                        <SelectItem key={l.loanId} value={l.loanId}>
                          {l.loanId} - {c?.name}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            {selectedLoan && (
              <div className="bg-blue-50 p-3 rounded-lg text-sm space-y-1">
                <div>
                  <span className="text-gray-500">Customer:</span>{" "}
                  <span className="font-medium">{customer?.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Village:</span>{" "}
                  <span className="font-medium">{village?.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">EMI:</span>{" "}
                  <span className="font-medium">
                    {formatRupees(selectedLoan.emi)}
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label>Amount Received (₹)</Label>
              <Input
                data-ocid="payments.amount.input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>
                Penalty (₹){" "}
                <span className="text-gray-400 font-normal">optional</span>
              </Label>
              <Input
                data-ocid="payments.penalty.input"
                type="number"
                value={penalty}
                onChange={(e) => setPenalty(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                data-ocid="payments.notes.input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
            <Button
              data-ocid="payments.submit.primary_button"
              onClick={recordPayment}
              disabled={saving || !selectedLoanId || !amount}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {saving ? "Processing..." : "Record Payment"}
            </Button>
          </CardContent>
        </Card>

        {/* Receipt */}
        {receipt && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={receiptRef}
                className="bg-white border-2 border-indigo-200 rounded-xl p-5"
              >
                <div className="text-center border-b border-gray-200 pb-3 mb-4">
                  <div className="text-2xl">🏦</div>
                  <div className="font-bold text-indigo-700 text-lg">
                    Village Finance
                  </div>
                  <div className="text-xs text-gray-500">
                    Official Payment Receipt
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Receipt No" value={receipt.receiptNo} />
                  <Row
                    label="Date & Time"
                    value={formatDateTime(receipt.paymentDate)}
                  />
                  <Row label="Customer" value={customer?.name || "--"} />
                  <Row label="Loan ID" value={receipt.loanId} />
                  <div className="border-t pt-2 mt-2">
                    <Row
                      label="Amount Received"
                      value={formatRupees(receipt.amountPaid)}
                      bold
                    />
                    {receipt.penalty > 0n && (
                      <Row
                        label="Penalty"
                        value={formatRupees(receipt.penalty)}
                      />
                    )}
                    <Row
                      label="Outstanding Principal"
                      value={formatRupees(receipt.outstandingPrincipal)}
                    />
                    <Row
                      label="Total Outstanding"
                      value={formatRupees(receipt.totalOutstanding)}
                      bold
                    />
                  </div>
                </div>
              </div>
              <Button
                data-ocid="payments.whatsapp.primary_button"
                onClick={shareWhatsApp}
                className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white"
              >
                Share on WhatsApp
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}:</span>
      <span className={bold ? "font-bold text-indigo-700" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}
