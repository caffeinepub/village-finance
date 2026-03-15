import { useCallback, useEffect, useRef, useState } from "react";
import type { Loan, Payment, Village } from "../backend";
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
import type { CustomerFull } from "../types";
import { captureElementAsBlob } from "../utils/captureReceipt";
import {
  formatDateTime,
  formatRupees,
  rupeeInputToPaise,
} from "../utils/format";

export default function Payments() {
  const { actor } = useActor();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<CustomerFull[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [penalty, setPenalty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [loanClosedMsg, setLoanClosedMsg] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(() => {
    if (!actor) return;
    const actor_ = actor as any;
    const paymentsPromise = actor_.getAllPayments
      ? actor_.getAllPayments()
      : Promise.resolve([]);
    Promise.all([
      actor.getAllLoans(),
      actor.getAllCustomers(),
      actor.getAllVillages(),
      paymentsPromise,
    ]).then(([l, c, v, p]) => {
      setLoans(l);
      setCustomers(c as CustomerFull[]);
      setVillages(v);
      const sorted = [...(p as Payment[])].sort(
        (a, b) => Number(b.paymentDate) - Number(a.paymentDate),
      );
      setAllPayments(sorted);
    });
  }, [actor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedLoan = loans.find((l) => l.loanId === selectedLoanId);
  const customer = selectedLoan
    ? customers.find((c) => c.id === selectedLoan.customerId)
    : null;
  const village = selectedLoan
    ? villages.find((v) => v.id === selectedLoan.villageId)
    : null;

  // Compute remaining outstanding for selected loan — include penalties in total paid
  const loanTotalPaid = selectedLoan
    ? allPayments
        .filter((p) => p.loanId === selectedLoan.loanId)
        .reduce((sum, p) => sum + p.amountPaid + p.penalty, 0n)
    : 0n;
  const remainingOutstanding = selectedLoan
    ? selectedLoan.totalAmount > loanTotalPaid
      ? selectedLoan.totalAmount - loanTotalPaid
      : 0n
    : 0n;

  // Auto-fill last EMI: if remaining outstanding <= standard EMI, pre-fill with exact remaining
  useEffect(() => {
    if (selectedLoan && remainingOutstanding > 0n) {
      const standardEmi = selectedLoan.emi;
      if (remainingOutstanding <= standardEmi) {
        setAmount((Number(remainingOutstanding) / 100).toFixed(2));
      } else {
        setAmount((Number(standardEmi) / 100).toFixed(2));
      }
    } else {
      setAmount("");
    }
  }, [selectedLoan, remainingOutstanding]);

  const receiptCustomer = receipt
    ? customers.find((c) => c.id === receipt.customerId)
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

      // Check if loan is fully paid — if totalOutstanding is 0, loan is now closed
      if (payment.totalOutstanding === 0n) {
        setLoanClosedMsg(true);
        setSelectedLoanId("");
        setTimeout(() => setLoanClosedMsg(false), 5000);
      }

      loadData();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const captureReceiptById = async (id: string): Promise<Blob | null> => {
    const el = document.getElementById(id);
    if (!el) return null;
    return captureElementAsBlob(el);
  };

  const captureMainReceipt = async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;
    return captureElementAsBlob(receiptRef.current);
  };

  // WhatsApp share: try image share on mobile, else download + open wa.me
  const doShare = async (
    blob: Blob | null,
    p: Payment,
    customerName: string,
  ) => {
    if (
      blob &&
      navigator.canShare &&
      navigator.canShare({
        files: [new File([blob], "receipt.png", { type: "image/png" })],
      })
    ) {
      const file = new File([blob], `VF_Receipt_${p.receiptNo}.png`, {
        type: "image/png",
      });
      await navigator.share({
        title: "Village Finance Receipt",
        text: `Payment receipt for ${customerName} - ${p.receiptNo}`,
        files: [file],
      });
    } else if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VF_Receipt_${p.receiptNo}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setTimeout(() => {
        const text = buildSMSText(p, customerName);
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          "_blank",
        );
      }, 500);
    } else {
      const text = buildSMSText(p, customerName);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  // SMS share: open sms: scheme with pre-filled text
  const doSMS = (p: Payment, customerName: string) => {
    const text = buildSMSText(p, customerName);
    window.open(`sms:?body=${encodeURIComponent(text)}`, "_blank");
  };

  function buildSMSText(p: Payment, customerName: string): string {
    return [
      "Village Finance Payment Receipt",
      `Receipt: ${p.receiptNo}`,
      `Customer: ${customerName}`,
      `Loan: ${p.loanId}`,
      `Date: ${new Date(Number(p.paymentDate) / 1_000_000).toLocaleString("en-IN")}`,
      `Amount Paid: ${formatRupees(p.amountPaid)}`,
      `Outstanding Principal: ${formatRupees(p.outstandingPrincipal)}`,
      `Total Outstanding: ${formatRupees(p.totalOutstanding)}`,
    ].join("\n");
  }

  const shareWhatsApp = async () => {
    if (!receipt || !receiptCustomer) return;
    setSharing("main-wa");
    try {
      const blob = await captureMainReceipt();
      await doShare(blob, receipt, receiptCustomer.name);
    } catch (e) {
      console.error("Share failed:", e);
    } finally {
      setSharing(null);
    }
  };

  const shareSMS = () => {
    if (!receipt || !receiptCustomer) return;
    doSMS(receipt, receiptCustomer.name);
  };

  const shareHistoryWhatsApp = async (p: Payment) => {
    const cust = customers.find((c) => c.id === p.customerId);
    setSharing(`${p.receiptNo}-wa`);
    try {
      const blob = await captureReceiptById(`receipt-${p.receiptNo}`);
      await doShare(blob, p, cust?.name || "Customer");
    } catch (e) {
      console.error("Share failed:", e);
    } finally {
      setSharing(null);
    }
  };

  const shareHistorySMS = (p: Payment) => {
    const cust = customers.find((c) => c.id === p.customerId);
    doSMS(p, cust?.name || "Customer");
  };

  const downloadHistoryReceipt = async (p: Payment) => {
    setDownloading(p.receiptNo);
    try {
      const blob = await captureReceiptById(`receipt-${p.receiptNo}`);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VF_Receipt_${p.receiptNo}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div data-ocid="payments.section">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Record Payment</h2>

      {/* Loan closed success banner */}
      {loanClosedMsg && (
        <div
          data-ocid="payments.loan_closed.success_state"
          className="mb-4 bg-green-100 border border-green-400 text-green-800 rounded-lg px-4 py-3 flex items-center gap-2 font-semibold"
        >
          ✅ Loan fully paid and closed! The loan account has been marked as
          Closed.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select Loan</Label>
              <Select
                value={selectedLoanId}
                onValueChange={(v) => {
                  setSelectedLoanId(v);
                  setAmount("");
                  setPenalty("");
                }}
              >
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
                <div>
                  <span className="text-gray-500">Remaining Outstanding:</span>{" "}
                  <span
                    className={`font-semibold ${
                      remainingOutstanding === 0n
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatRupees(remainingOutstanding)}
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
                onChange={(e) => {
                  const val = e.target.value;
                  if (selectedLoan && val !== "") {
                    const enteredPaise = Math.round(
                      Number.parseFloat(val) * 100,
                    );
                    const maxPaise = Number(remainingOutstanding);
                    if (enteredPaise > maxPaise && maxPaise >= 0) {
                      setAmount((maxPaise / 100).toFixed(2));
                      return;
                    }
                  }
                  setAmount(val);
                }}
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

        {/* Latest Receipt */}
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
                  <Row label="Customer" value={receiptCustomer?.name || "--"} />
                  <Row label="Loan ID" value={receipt.loanId} />
                  <div className="border-t pt-2 mt-2 space-y-2">
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
                <div className="text-center mt-4 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-400">
                    {receipt.totalOutstanding === 0n
                      ? "🎉 Loan Fully Paid & Closed!"
                      : "Thank you for your payment"}
                  </div>
                </div>
              </div>
              {/* Share buttons for latest receipt */}
              <div className="flex gap-3 mt-4">
                <Button
                  data-ocid="payments.whatsapp.primary_button"
                  onClick={shareWhatsApp}
                  disabled={sharing === "main-wa"}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  {sharing === "main-wa" ? "Preparing..." : "📤 WhatsApp"}
                </Button>
                <Button
                  data-ocid="payments.sms.secondary_button"
                  onClick={shareSMS}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  💬 SMS
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment History */}
      {allPayments.length > 0 && (
        <div className="mt-10">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            Payment History
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {allPayments.map((p, idx) => {
              const cust = customers.find((c) => c.id === p.customerId);
              const isLatest = idx === 0;
              return (
                <div
                  key={p.receiptNo}
                  data-ocid={`payments.history.item.${idx + 1}`}
                  className={`rounded-xl border-2 overflow-hidden ${
                    isLatest
                      ? "border-green-400 shadow-lg shadow-green-100"
                      : "border-indigo-100 shadow-md"
                  }`}
                >
                  {isLatest && (
                    <div className="bg-green-500 text-white text-xs font-bold text-center py-1">
                      ✓ Latest Payment
                    </div>
                  )}
                  <div id={`receipt-${p.receiptNo}`} className="bg-white p-4">
                    <div className="text-center border-b border-gray-200 pb-2 mb-3">
                      <div className="text-lg">🏦</div>
                      <div className="font-bold text-indigo-700 text-sm">
                        Village Finance
                      </div>
                      <div className="text-xs text-gray-400">
                        Official Payment Receipt
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <Row label="Receipt No" value={p.receiptNo} />
                      <Row
                        label="Date & Time"
                        value={formatDateTime(p.paymentDate)}
                      />
                      <Row label="Customer" value={cust?.name || "--"} />
                      <Row label="Loan ID" value={p.loanId} />
                      <div className="border-t pt-1.5 mt-1.5 space-y-1.5">
                        <Row
                          label="Amount Received"
                          value={formatRupees(p.amountPaid)}
                          bold
                        />
                        {p.penalty > 0n && (
                          <Row
                            label="Penalty"
                            value={formatRupees(p.penalty)}
                          />
                        )}
                        <Row
                          label="Outstanding Principal"
                          value={formatRupees(p.outstandingPrincipal)}
                        />
                        <Row
                          label="Total Outstanding"
                          value={formatRupees(p.totalOutstanding)}
                          bold
                        />
                      </div>
                    </div>
                    <div className="text-center mt-3 pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-400">
                        Thank you for your payment
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 flex gap-2">
                    <Button
                      data-ocid={`payments.history.whatsapp.button.${idx + 1}`}
                      size="sm"
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs"
                      disabled={sharing === `${p.receiptNo}-wa`}
                      onClick={() => shareHistoryWhatsApp(p)}
                    >
                      {sharing === `${p.receiptNo}-wa` ? "..." : "📤 WhatsApp"}
                    </Button>
                    <Button
                      data-ocid={`payments.history.sms.button.${idx + 1}`}
                      size="sm"
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs"
                      onClick={() => shareHistorySMS(p)}
                    >
                      💬 SMS
                    </Button>
                    <Button
                      data-ocid={`payments.history.download.button.${idx + 1}`}
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      disabled={downloading === p.receiptNo}
                      onClick={() => downloadHistoryReceipt(p)}
                    >
                      {downloading === p.receiptNo ? "..." : "⬇"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
