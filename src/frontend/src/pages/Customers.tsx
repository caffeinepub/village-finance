import { Principal } from "@icp-sdk/core/principal";
import { FileText, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Loan, Payment, Village } from "../backend";
import { Variant_closed_active } from "../backend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { CustomerFull } from "../types";
import { captureElementAsBlob } from "../utils/captureReceipt";
import { formatDate, formatRupees, rupeeInputToPaise } from "../utils/format";

interface UploadedDoc {
  name: string;
  url: string;
  type: string;
  size: number;
}

function maskAadhar(aadhar: string): string {
  if (!aadhar || aadhar.length < 4) return aadhar || "--";
  const digits = aadhar.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

function ReceiptCard({
  payment,
  customerName,
  loanId,
  receiptRef,
}: {
  payment: Payment;
  customerName: string;
  loanId: string;
  receiptRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={receiptRef}
      className="bg-white border-2 border-teal-200 rounded-xl p-5"
    >
      <div className="text-center border-b border-gray-200 pb-3 mb-4">
        <div className="text-2xl">🏦</div>
        <div className="font-bold text-teal-700 text-lg">Village Finance</div>
        <div className="text-xs text-gray-500">Payment Receipt</div>
        <div className="text-xs text-gray-400 mt-1">#{payment.receiptNo}</div>
      </div>
      <div className="space-y-2 text-sm">
        <RRow label="Receipt No" value={payment.receiptNo} />
        <RRow label="Date" value={formatDate(payment.paymentDate)} />
        <RRow label="Customer" value={customerName} />
        <RRow label="Loan ID" value={loanId} />
        <div className="border-t pt-2 mt-2 space-y-2">
          <RRow
            label="Amount Paid"
            value={formatRupees(payment.amountPaid)}
            bold
          />
          {payment.penalty > 0n && (
            <RRow label="Penalty" value={formatRupees(payment.penalty)} />
          )}
          <RRow
            label="Outstanding Principal"
            value={formatRupees(payment.outstandingPrincipal)}
          />
          <RRow
            label="Total Outstanding"
            value={formatRupees(payment.totalOutstanding)}
            bold
          />
        </div>
        {payment.notes && (
          <div className="border-t pt-2 mt-2">
            <RRow label="Notes" value={payment.notes} />
          </div>
        )}
      </div>
      <div className="text-center mt-4 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-400">Thank you for your payment</div>
      </div>
    </div>
  );
}

function RRow({
  label,
  value,
  bold,
}: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span
        className={`text-right ${bold ? "font-bold text-teal-800" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

function buildPaymentSMSText(
  payment: Payment,
  customerName: string,
  loanId: string,
): string {
  return [
    "Village Finance Payment Receipt",
    `Receipt: ${payment.receiptNo}`,
    `Date: ${formatDate(payment.paymentDate)}`,
    `Customer: ${customerName}`,
    `Loan ID: ${loanId}`,
    `Amount Paid: ${formatRupees(payment.amountPaid)}`,
    payment.penalty > 0n ? `Penalty: ${formatRupees(payment.penalty)}` : null,
    `Outstanding Principal: ${formatRupees(payment.outstandingPrincipal)}`,
    `Total Outstanding: ${formatRupees(payment.totalOutstanding)}`,
    payment.notes ? `Notes: ${payment.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Open WhatsApp safely — opens window before any async work to avoid popup blockers */
async function shareViaWhatsApp(
  receiptEl: HTMLElement | null,
  payment: Payment,
  customerName: string,
  loanId: string,
  setSharingState: (v: boolean) => void,
) {
  setSharingState(true);
  const smsText = buildPaymentSMSText(payment, customerName, loanId);
  try {
    // Try native share (mobile) first — this is a direct user gesture so no popup block
    if (
      receiptEl &&
      navigator.canShare &&
      navigator.canShare({
        files: [new File([new Blob()], "t.png", { type: "image/png" })],
      })
    ) {
      const blob = await captureElementAsBlob(receiptEl);
      if (blob) {
        await navigator.share({
          title: "Village Finance Payment Receipt",
          files: [
            new File([blob], `VF_Receipt_${payment.receiptNo}.png`, {
              type: "image/png",
            }),
          ],
        });
        setSharingState(false);
        return;
      }
    }

    // Desktop / fallback: open WhatsApp link directly in same tab to avoid popup block
    if (receiptEl) {
      const blob = await captureElementAsBlob(receiptEl);
      if (blob) {
        // Download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VF_Receipt_${payment.receiptNo}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
    // Open WhatsApp — use location assign to avoid popup blocking
    window.open(`https://wa.me/?text=${encodeURIComponent(smsText)}`, "_blank");
  } catch (e) {
    // If share was cancelled by user, just ignore; otherwise try direct link
    if (e instanceof Error && e.name !== "AbortError") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(smsText)}`,
        "_blank",
      );
    }
  } finally {
    setSharingState(false);
  }
}

export default function Customers() {
  const { actor } = useActor();
  const [customers, setCustomers] = useState<CustomerFull[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CustomerFull | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    aadharNo: "",
    villageId: "",
  });
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerFull | null>(null);
  const [forecloseLoanTarget, setForeCloseLoanTarget] = useState<Loan | null>(
    null,
  );
  const [foreclosingLoan, setForeclosingLoan] = useState(false);
  const [foreclosurePayments, setForeclosurePayments] = useState<Payment[]>([]);
  const [foreclosureAmountReceived, setForeclosureAmountReceived] =
    useState("");
  const [foreclosureLoadingPayments, setForeclosureLoadingPayments] =
    useState(false);

  // View Loans state
  const [viewLoansCustomer, setViewLoansCustomer] =
    useState<CustomerFull | null>(null);
  const [customerLoans, setCustomerLoans] = useState<Loan[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);

  // Payment state
  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [loanPayments, setLoanPayments] = useState<Payment[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    penalty: "0",
    notes: "",
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Receipt state (after new payment)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [receiptLoanId, setReceiptLoanId] = useState("");
  const [receiptCustomerName, setReceiptCustomerName] = useState("");
  const [sharingReceipt, setSharingReceipt] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // View receipts state (per loan) — list first, then detail
  const [viewReceiptsLoan, setViewReceiptsLoan] = useState<Loan | null>(null);
  const [viewReceiptsPayments, setViewReceiptsPayments] = useState<Payment[]>(
    [],
  );
  const [viewReceiptsLoading, setViewReceiptsLoading] = useState(false);
  const [selectedHistoryPayment, setSelectedHistoryPayment] =
    useState<Payment | null>(null);
  const [sharingHistoryReceipt, setSharingHistoryReceipt] = useState(false);
  const historyReceiptRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!actor) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      actor.getAllCustomers(),
      actor.getAllVillages(),
      actor.getAllLoans(),
      actor.getAllPayments(),
    ])
      .then(([c, v, loans, payments]) => {
        setCustomers(Array.isArray(c) ? c : []);
        setVillages(Array.isArray(v) ? v : []);
        setAllLoans(Array.isArray(loans) ? loans : []);
        setAllPayments(Array.isArray(payments) ? payments : []);
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setCustomers([]);
        setVillages([]);
        setAllLoans([]);
        setAllPayments([]);
      })
      .finally(() => setLoading(false));
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  // Compute remaining outstanding across all active loans for a customer
  const getLoanStats = (customerId: bigint) => {
    try {
      const loans = allLoans.filter((l) => l.customerId === customerId);
      const totalLoans = loans.length;
      const activeLoans = loans.filter(
        (l) => l.status === Variant_closed_active.active,
      );
      const remainingOutstanding = activeLoans.reduce((sum, loan) => {
        try {
          const totalAmount = BigInt(loan.totalAmount ?? 0);
          const paid = allPayments
            .filter((p) => p.loanId === loan.loanId)
            .reduce((s, p) => {
              try {
                return s + BigInt(p.amountPaid ?? 0) + BigInt(p.penalty ?? 0);
              } catch {
                return s;
              }
            }, 0n);
          const remaining = totalAmount - paid;
          return sum + (remaining > 0n ? remaining : 0n);
        } catch {
          return sum;
        }
      }, 0n);
      return { totalLoans, remainingOutstanding };
    } catch {
      return { totalLoans: 0, remainingOutstanding: 0n };
    }
  };

  const openAdd = () => {
    setEdit(null);
    setForm({ name: "", phone: "", address: "", aadharNo: "", villageId: "" });
    setDocs([]);
    setPhoneError("");
    setOpen(true);
  };

  const openEdit = (c: CustomerFull) => {
    setEdit(c);
    setForm({
      name: c.name,
      phone: c.phone,
      address: c.address,
      aadharNo: c.aadharNo || "",
      villageId: c.villageId.toString(),
    });
    setDocs([]);
    setPhoneError("");
    setOpen(true);
  };

  const handlePhoneChange = (value: string) => {
    setForm((f) => ({ ...f, phone: value }));
    if (phoneError) setPhoneError("");
    if (value) {
      const duplicate = customers.find(
        (c) => c.phone === value && (!edit || c.id !== edit.id),
      );
      if (duplicate)
        setPhoneError(
          "This mobile number is already registered to another customer.",
        );
    }
  };

  const save = async () => {
    if (!actor || !form.name || !form.villageId) return;
    const duplicate = customers.find(
      (c) => c.phone === form.phone && (!edit || c.id !== edit.id),
    );
    if (duplicate) {
      setPhoneError(
        "This mobile number is already registered to another customer.",
      );
      return;
    }
    setSaving(true);
    try {
      if (edit) {
        await actor.updateCustomer(
          edit.id,
          form.name,
          form.phone,
          form.address,
          form.aadharNo,
          BigInt(form.villageId),
        );
      } else {
        await actor.createCustomer(
          form.name,
          form.phone,
          form.address,
          form.aadharNo,
          BigInt(form.villageId),
          Principal.anonymous(),
        );
      }
      setOpen(false);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("mobile number")) {
        setPhoneError(
          "This mobile number is already registered to another customer.",
        );
      } else {
        alert(`Error saving customer: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!actor || !deleteTarget) return;
    await actor.deleteCustomer(deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  const computeOutstandingPrincipal = (loan: Loan, pmts: Payment[]): bigint => {
    const totalPaid = pmts.reduce(
      (sum, p) => sum + p.amountPaid + p.penalty,
      0n,
    );
    const outstandingTotal = loan.totalAmount - totalPaid;
    if (loan.totalAmount === 0n) return loan.principal;
    return (loan.principal * outstandingTotal) / loan.totalAmount;
  };

  const confirmForecloseLoan = async () => {
    if (!actor || !forecloseLoanTarget) return;
    const principalOutstandingBigInt = computeOutstandingPrincipal(
      forecloseLoanTarget,
      foreclosurePayments,
    );
    const foreclosureFeeBigInt = (principalOutstandingBigInt * 3n) / 100n;
    const foreclosureTotalPaise =
      principalOutstandingBigInt + foreclosureFeeBigInt;
    const amountPaise = BigInt(
      Math.round(Number.parseFloat(foreclosureAmountReceived) * 100),
    );
    if (amountPaise !== foreclosureTotalPaise) {
      alert(
        `Amount must equal the foreclosure amount: ₹${(Number(foreclosureTotalPaise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      );
      return;
    }
    setForeclosingLoan(true);
    try {
      await actor.forecloseLoan(forecloseLoanTarget.loanId, amountPaise);
      setForeCloseLoanTarget(null);
      if (viewLoansCustomer) {
        const loans = await actor.getLoansByCustomer(viewLoansCustomer.id);
        setCustomerLoans(loans as Loan[]);
      }
      alert("Loan foreclosed and closed successfully.");
    } catch (err) {
      console.error("Foreclose loan error:", err);
      alert(`Failed to foreclose loan: ${String(err)}`);
    } finally {
      setForeclosingLoan(false);
    }
  };

  const getVillage = (id: bigint) => villages.find((v) => v.id === id);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newDocs: UploadedDoc[] = [];
    for (const file of files) {
      newDocs.push({
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
        size: file.size,
      });
    }
    setDocs((prev) => [...prev, ...newDocs]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeDoc = (name: string) => {
    setDocs((prev) => {
      const doc = prev.find((d) => d.name === name);
      if (doc) URL.revokeObjectURL(doc.url);
      return prev.filter((d) => d.name !== name);
    });
  };

  const viewLoans = async (c: CustomerFull) => {
    setViewLoansCustomer(c);
    setCustomerLoans([]);
    setLoansLoading(true);
    try {
      if (actor) {
        const loans = await actor.getLoansByCustomer(c.id);
        setCustomerLoans(
          [...loans].sort(
            (a, b) => Number(b.disbursedAt) - Number(a.disbursedAt),
          ),
        );
      }
    } catch (e) {
      console.error("Failed to load loans:", e);
    } finally {
      setLoansLoading(false);
    }
  };

  const openRecordPayment = async (loan: Loan) => {
    if (!actor) return;
    setPaymentLoan(loan);
    setPaymentError("");
    const pmts = await actor.getPaymentsByLoan(loan.loanId);
    setLoanPayments(pmts);
    const totalPaid = pmts.reduce(
      (sum, p) => sum + p.amountPaid + p.penalty,
      0n,
    );
    const remaining = loan.totalAmount - totalPaid;
    const emiNum = Number(loan.emi) / 100;
    const remainingNum = Number(remaining) / 100;
    const prefill = Math.min(emiNum, remainingNum);
    setPaymentForm({
      amount: prefill > 0 ? prefill.toFixed(2) : "",
      penalty: "0",
      notes: "",
    });
  };

  const submitPayment = async () => {
    if (!actor || !paymentLoan || !viewLoansCustomer) return;
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setPaymentError("Please enter a valid amount.");
      return;
    }
    const totalPaid = loanPayments.reduce(
      (sum, p) => sum + p.amountPaid + p.penalty,
      0n,
    );
    const remaining = paymentLoan.totalAmount - totalPaid;
    const amountPaise = rupeeInputToPaise(paymentForm.amount);
    const penaltyPaise = rupeeInputToPaise(paymentForm.penalty || "0");
    if (amountPaise + penaltyPaise > remaining) {
      setPaymentError(
        `Amount exceeds remaining outstanding (${formatRupees(remaining)}).`,
      );
      return;
    }
    setPaymentSaving(true);
    setPaymentError("");
    try {
      const payment = await actor.recordPayment(
        paymentLoan.loanId,
        viewLoansCustomer.id,
        amountPaise,
        penaltyPaise,
        paymentForm.notes,
      );
      setPaymentLoan(null);
      setReceiptPayment(payment);
      setReceiptLoanId(paymentLoan.loanId);
      setReceiptCustomerName(viewLoansCustomer.name);
      const loans = await actor.getLoansByCustomer(viewLoansCustomer.id);
      setCustomerLoans(
        [...loans].sort(
          (a, b) => Number(b.disbursedAt) - Number(a.disbursedAt),
        ),
      );
      load();
    } catch (e) {
      setPaymentError(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPaymentSaving(false);
    }
  };

  const openViewReceipts = async (loan: Loan) => {
    setViewReceiptsLoan(loan);
    setViewReceiptsPayments([]);
    setSelectedHistoryPayment(null);
    setViewReceiptsLoading(true);
    try {
      if (actor) {
        const pmts = await actor.getPaymentsByLoan(loan.loanId);
        setViewReceiptsPayments(
          [...pmts].sort(
            (a, b) => Number(a.paymentDate) - Number(b.paymentDate),
          ),
        );
      }
    } catch (e) {
      console.error("Failed to load receipts:", e);
    } finally {
      setViewReceiptsLoading(false);
    }
  };

  const getRemainingOutstanding = () => {
    if (!paymentLoan) return 0n;
    const totalPaid = loanPayments.reduce(
      (sum, p) => sum + p.amountPaid + p.penalty,
      0n,
    );
    return paymentLoan.totalAmount - totalPaid;
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  if (loading)
    return (
      <div
        data-ocid="customers.loading_state"
        className="text-center py-20 text-gray-400"
      >
        Loading...
      </div>
    );

  return (
    <div data-ocid="customers.section">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
        <div className="flex gap-3">
          <Input
            data-ocid="customers.search.search_input"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60"
          />
          <Button
            data-ocid="customers.add.primary_button"
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            + Add Customer
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          data-ocid="customers.empty_state"
          className="text-center py-20 text-gray-400"
        >
          No customers found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const village = getVillage(c.villageId);
            const { totalLoans, remainingOutstanding } = getLoanStats(c.id);
            return (
              <Card
                key={c.id.toString()}
                data-ocid={`customers.item.${i + 1}`}
                className="border-0 shadow-md overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full text-left bg-gradient-to-r from-teal-500 to-cyan-600 p-4 text-white hover:from-teal-600 hover:to-cyan-700 transition-colors cursor-pointer"
                  onClick={() => viewLoans(c)}
                  data-ocid={`customers.view_loans.button.${i + 1}`}
                  title="Tap to view loans"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold">{c.name}</div>
                      <div className="text-sm opacity-80">{c.phone}</div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                          🏦 {totalLoans} {totalLoans === 1 ? "Loan" : "Loans"}
                        </span>
                        {remainingOutstanding > 0n && (
                          <span className="text-xs bg-amber-400/80 text-amber-950 px-2 py-0.5 rounded-full font-semibold">
                            Outstanding: {formatRupees(remainingOutstanding)}
                          </span>
                        )}
                        {totalLoans > 0 && remainingOutstanding === 0n && (
                          <span className="text-xs bg-green-300/80 text-green-900 px-2 py-0.5 rounded-full font-semibold">
                            ✓ Fully Paid
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full shrink-0">
                      View →
                    </div>
                  </div>
                </button>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1">{c.address}</div>
                  {c.aadharNo && (
                    <div className="text-xs text-gray-500 mb-1">
                      Aadhar: {maskAadhar(c.aadharNo)}
                    </div>
                  )}
                  {village && (
                    <div className="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                      {village.shortCode} - {village.name}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      data-ocid={`customers.edit_button.${i + 1}`}
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(c)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <Button
                      data-ocid={`customers.delete_button.${i + 1}`}
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(c)}
                      className="flex-1"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View Loans Dialog */}
      <Dialog
        open={!!viewLoansCustomer}
        onOpenChange={(v) => !v && setViewLoansCustomer(null)}
      >
        <DialogContent
          data-ocid="customers.loans.dialog"
          className="max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>Customer Loans</DialogTitle>
          </DialogHeader>
          {viewLoansCustomer && (
            <>
              <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl p-4 text-white mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center font-bold text-2xl">
                    {viewLoansCustomer.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-lg">
                      {viewLoansCustomer.name}
                    </div>
                    <div className="text-sm opacity-85">
                      📞 {viewLoansCustomer.phone}
                    </div>
                    {viewLoansCustomer.address && (
                      <div className="text-xs opacity-75">
                        📍 {viewLoansCustomer.address}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {viewLoansCustomer.aadharNo && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      Aadhar: {maskAadhar(viewLoansCustomer.aadharNo)}
                    </span>
                  )}
                  {getVillage(viewLoansCustomer.villageId) && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      🏘 {getVillage(viewLoansCustomer.villageId)?.shortCode} -{" "}
                      {getVillage(viewLoansCustomer.villageId)?.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="font-semibold text-gray-700 mb-2">
                Loan Accounts
              </div>
              {loansLoading ? (
                <div
                  data-ocid="customers.loans.loading_state"
                  className="text-center py-8 text-gray-400"
                >
                  Loading loans...
                </div>
              ) : customerLoans.length === 0 ? (
                <div
                  data-ocid="customers.loans.empty_state"
                  className="text-center py-8 text-gray-400"
                >
                  No loans found for this customer.
                </div>
              ) : (
                <div className="space-y-3">
                  {customerLoans.map((loan, idx) => {
                    const isActive =
                      loan.status === Variant_closed_active.active;
                    return (
                      <div
                        key={loan.loanId}
                        data-ocid={`customers.loans.item.${idx + 1}`}
                        className={`rounded-lg border-2 overflow-hidden ${isActive ? "border-teal-300" : "border-gray-200"}`}
                      >
                        <div
                          className={`px-4 py-2 flex items-center justify-between ${isActive ? "bg-teal-50" : "bg-gray-50"}`}
                        >
                          <span className="font-mono text-sm font-bold text-gray-700">
                            {loan.loanId}
                          </span>
                          <Badge
                            className={
                              isActive
                                ? "bg-teal-100 text-teal-800"
                                : "bg-gray-200 text-gray-600"
                            }
                          >
                            {loan.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 text-sm">
                          <div>
                            <span className="text-gray-500">Principal:</span>{" "}
                            <span className="font-semibold">
                              {formatRupees(loan.principal)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">EMI:</span>{" "}
                            <span className="font-semibold text-teal-700">
                              {formatRupees(loan.emi)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total:</span>{" "}
                            <span className="font-semibold">
                              {formatRupees(loan.totalAmount)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Tenure:</span>{" "}
                            <span className="font-semibold">
                              {loan.tenureMonths.toString()} months
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Disbursed:</span>{" "}
                            <span className="font-semibold">
                              {formatDate(loan.disbursedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 px-4 pb-3">
                          {isActive && (
                            <Button
                              data-ocid={`customers.record_payment.button.${idx + 1}`}
                              size="sm"
                              onClick={() => openRecordPayment(loan)}
                              className="bg-teal-600 hover:bg-teal-700 text-white text-xs flex-1"
                            >
                              💰 Record Payment
                            </Button>
                          )}
                          <Button
                            data-ocid={`customers.view_receipts.button.${idx + 1}`}
                            size="sm"
                            variant="outline"
                            onClick={() => openViewReceipts(loan)}
                            className="text-xs flex-1"
                          >
                            🧾 Receipts
                          </Button>
                          {isActive && (
                            <Button
                              data-ocid="loan.foreclose_button"
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!actor) return;
                                setForeCloseLoanTarget(loan);
                                setForeclosureAmountReceived("");
                                setForeclosureLoadingPayments(true);
                                try {
                                  const pmts = await actor.getPaymentsByLoan(
                                    loan.loanId,
                                  );
                                  setForeclosurePayments(pmts as Payment[]);
                                } finally {
                                  setForeclosureLoadingPayments(false);
                                }
                              }}
                              className="text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                            >
                              🔒 Fore Close
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <DialogFooter>
            <Button
              data-ocid="customers.loans.close_button"
              variant="outline"
              onClick={() => setViewLoansCustomer(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog
        open={!!paymentLoan}
        onOpenChange={(v) => !v && setPaymentLoan(null)}
      >
        <DialogContent
          data-ocid="customers.payment.dialog"
          className="max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Record Payment — {paymentLoan?.loanId}</DialogTitle>
          </DialogHeader>
          {paymentLoan &&
            (() => {
              const remaining = getRemainingOutstanding();
              const emiNum = Number(paymentLoan.emi) / 100;
              return (
                <div className="space-y-4">
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Loan ID:</span>
                      <span className="font-mono font-bold">
                        {paymentLoan.loanId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly EMI:</span>
                      <span className="font-semibold text-teal-700">
                        {formatRupees(paymentLoan.emi)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Remaining Outstanding:
                      </span>
                      <span className="font-bold text-red-600">
                        {formatRupees(remaining)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label>Amount Paid (₹)</Label>
                    <Input
                      data-ocid="customers.payment.amount.input"
                      type="number"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        const maxRupees = Number(remaining) / 100;
                        if (Number(val) > maxRupees) {
                          setPaymentForm((f) => ({
                            ...f,
                            amount: maxRupees.toFixed(2),
                          }));
                        } else {
                          setPaymentForm((f) => ({ ...f, amount: val }));
                        }
                      }}
                      placeholder={emiNum.toFixed(2)}
                    />
                  </div>
                  <div>
                    <Label>Penalty (₹) — optional</Label>
                    <Input
                      data-ocid="customers.payment.penalty.input"
                      type="number"
                      step="0.01"
                      value={paymentForm.penalty}
                      onChange={(e) =>
                        setPaymentForm((f) => ({
                          ...f,
                          penalty: e.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Notes — optional</Label>
                    <Input
                      data-ocid="customers.payment.notes.input"
                      value={paymentForm.notes}
                      onChange={(e) =>
                        setPaymentForm((f) => ({ ...f, notes: e.target.value }))
                      }
                      placeholder="Any additional notes"
                    />
                  </div>
                  {paymentError && (
                    <div
                      data-ocid="customers.payment.error_state"
                      className="text-red-500 text-sm bg-red-50 border border-red-200 rounded p-2"
                    >
                      {paymentError}
                    </div>
                  )}
                </div>
              );
            })()}
          <DialogFooter>
            <Button
              data-ocid="customers.payment.cancel_button"
              variant="outline"
              onClick={() => setPaymentLoan(null)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="customers.payment.submit_button"
              onClick={submitPayment}
              disabled={paymentSaving || !paymentForm.amount}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {paymentSaving ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog (after payment) */}
      <Dialog
        open={!!receiptPayment}
        onOpenChange={(v) => !v && setReceiptPayment(null)}
      >
        <DialogContent
          data-ocid="customers.receipt.dialog"
          className="max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
          </DialogHeader>
          {receiptPayment && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 font-medium">
                ✅ Payment recorded successfully!
                {receiptPayment.totalOutstanding === 0n && (
                  <div className="mt-1 font-bold text-green-700">
                    🎉 Loan fully paid and closed!
                  </div>
                )}
              </div>
              <ReceiptCard
                payment={receiptPayment}
                customerName={receiptCustomerName}
                loanId={receiptLoanId}
                receiptRef={receiptRef}
              />
              <div className="flex gap-2">
                <Button
                  data-ocid="customers.receipt.whatsapp.primary_button"
                  onClick={() =>
                    shareViaWhatsApp(
                      receiptRef.current,
                      receiptPayment,
                      receiptCustomerName,
                      receiptLoanId,
                      setSharingReceipt,
                    )
                  }
                  disabled={sharingReceipt}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs"
                >
                  {sharingReceipt ? "Preparing..." : "📤 WhatsApp"}
                </Button>
                <Button
                  data-ocid="customers.receipt.sms.secondary_button"
                  onClick={() =>
                    window.open(
                      `sms:?body=${encodeURIComponent(buildPaymentSMSText(receiptPayment, receiptCustomerName, receiptLoanId))}`,
                      "_blank",
                    )
                  }
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs"
                >
                  💬 SMS
                </Button>
                <Button
                  data-ocid="customers.receipt.download.secondary_button"
                  onClick={async () => {
                    if (!receiptRef.current) return;
                    const blob = await captureElementAsBlob(receiptRef.current);
                    if (blob) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `VF_Receipt_${receiptPayment.receiptNo}.png`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  variant="outline"
                  className="flex-1 text-xs"
                >
                  ⬇ Download
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              data-ocid="customers.receipt.close_button"
              variant="outline"
              onClick={() => setReceiptPayment(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Receipts History Dialog — shows transaction list first */}
      <Dialog
        open={!!viewReceiptsLoan}
        onOpenChange={(v) => {
          if (!v) {
            setViewReceiptsLoan(null);
            setSelectedHistoryPayment(null);
          }
        }}
      >
        <DialogContent
          data-ocid="customers.receipts_history.dialog"
          className="max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {selectedHistoryPayment
                ? `Receipt — ${selectedHistoryPayment.receiptNo}`
                : `Receipts — ${viewReceiptsLoan?.loanId}`}
            </DialogTitle>
          </DialogHeader>

          {/* Back button when viewing a specific receipt */}
          {selectedHistoryPayment && (
            <Button
              data-ocid="customers.receipts_history.back_button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedHistoryPayment(null)}
              className="mb-2 text-xs"
            >
              ← Back to Transactions
            </Button>
          )}

          {viewReceiptsLoading ? (
            <div
              data-ocid="customers.receipts.loading_state"
              className="text-center py-8 text-gray-400"
            >
              Loading receipts...
            </div>
          ) : selectedHistoryPayment ? (
            // Show full receipt for selected transaction
            <div className="space-y-4">
              <div ref={historyReceiptRef}>
                <ReceiptCard
                  payment={selectedHistoryPayment}
                  customerName={viewLoansCustomer?.name || ""}
                  loanId={viewReceiptsLoan?.loanId || ""}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  data-ocid="customers.history_receipt.whatsapp.button"
                  size="sm"
                  onClick={() =>
                    shareViaWhatsApp(
                      historyReceiptRef.current,
                      selectedHistoryPayment,
                      viewLoansCustomer?.name || "",
                      viewReceiptsLoan?.loanId || "",
                      setSharingHistoryReceipt,
                    )
                  }
                  disabled={sharingHistoryReceipt}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs"
                >
                  {sharingHistoryReceipt ? "Sharing..." : "📤 WhatsApp"}
                </Button>
                <Button
                  data-ocid="customers.history_receipt.sms.button"
                  size="sm"
                  onClick={() => {
                    const text = buildPaymentSMSText(
                      selectedHistoryPayment,
                      viewLoansCustomer?.name || "",
                      viewReceiptsLoan?.loanId || "",
                    );
                    window.open(
                      `sms:?body=${encodeURIComponent(text)}`,
                      "_blank",
                    );
                  }}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs"
                >
                  💬 SMS
                </Button>
              </div>
            </div>
          ) : viewReceiptsPayments.length === 0 ? (
            <div
              data-ocid="customers.receipts.empty_state"
              className="text-center py-8 text-gray-400"
            >
              No payment receipts yet for this loan.
            </div>
          ) : (
            // Show transaction list
            <div className="space-y-2">
              {viewReceiptsPayments.map((payment, idx) => (
                <button
                  key={payment.id.toString()}
                  type="button"
                  data-ocid={`customers.receipt_history.item.${idx + 1}`}
                  className="w-full text-left border border-gray-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-colors flex items-center justify-between gap-3"
                  onClick={() => setSelectedHistoryPayment(payment)}
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-800">
                      {formatDate(payment.paymentDate)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Receipt #{payment.receiptNo}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-teal-700">
                      {formatRupees(payment.amountPaid)}
                    </div>
                    {payment.penalty > 0n && (
                      <div className="text-xs text-red-500">
                        +{formatRupees(payment.penalty)} penalty
                      </div>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs">View →</div>
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              data-ocid="customers.receipts_history.close_button"
              variant="outline"
              onClick={() => {
                setViewReceiptsLoan(null);
                setSelectedHistoryPayment(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Foreclosure Dialog */}
      {(() => {
        const principalOutstandingBigInt = forecloseLoanTarget
          ? computeOutstandingPrincipal(
              forecloseLoanTarget,
              foreclosurePayments,
            )
          : 0n;
        const principalOutstanding = Number(principalOutstandingBigInt) / 100;
        const foreclosureFee = (principalOutstanding * 3) / 100;
        const foreclosureTotal = principalOutstanding + foreclosureFee;
        return (
          <Dialog
            open={!!forecloseLoanTarget}
            onOpenChange={(open) => {
              if (!open) setForeCloseLoanTarget(null);
            }}
          >
            <DialogContent
              data-ocid="loan.foreclose_dialog"
              className="max-w-md"
            >
              <DialogHeader>
                <DialogTitle>🔒 Fore Close Loan</DialogTitle>
                <DialogDescription>
                  Loan ID: <strong>{forecloseLoanTarget?.loanId}</strong>
                </DialogDescription>
              </DialogHeader>
              {foreclosureLoadingPayments ? (
                <div className="text-center py-6 text-muted-foreground">
                  Loading loan data...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Principal Outstanding
                      </span>
                      <span className="font-medium">
                        ₹
                        {principalOutstanding.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Foreclosure Fee (3%)
                      </span>
                      <span className="font-medium text-orange-600">
                        ₹
                        {foreclosureFee.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-orange-200 pt-2">
                      <span className="font-bold">
                        Total Foreclosure Amount
                      </span>
                      <span className="font-bold text-orange-700 text-base">
                        ₹
                        {foreclosureTotal.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="foreclose-amount"
                      className="text-sm font-medium"
                    >
                      Amount Received (₹)
                    </label>
                    <Input
                      id="foreclose-amount"
                      data-ocid="loan.foreclose_amount_input"
                      type="number"
                      placeholder="Enter amount received"
                      value={foreclosureAmountReceived}
                      onChange={(e) =>
                        setForeclosureAmountReceived(e.target.value)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Loan will be closed only when the amount received equals
                      the total foreclosure amount.
                    </p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  data-ocid="loan.foreclose_cancel_button"
                  variant="outline"
                  onClick={() => setForeCloseLoanTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  data-ocid="loan.foreclose_submit_button"
                  onClick={confirmForecloseLoan}
                  disabled={
                    foreclosingLoan ||
                    !foreclosureAmountReceived ||
                    foreclosureLoadingPayments
                  }
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {foreclosingLoan ? "Processing..." : "Fore Close Loan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent data-ocid="customers.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the customer record for{" "}
              <strong>{deleteTarget?.name}</strong>. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="customers.delete_confirm.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="customers.delete_confirm.confirm_button"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-ocid="customers.dialog"
          className="max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{edit ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                data-ocid="customers.name.input"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                data-ocid="customers.phone.input"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Phone number"
                className={
                  phoneError ? "border-red-500 focus-visible:ring-red-500" : ""
                }
              />
              {phoneError && (
                <p
                  data-ocid="customers.phone.error_state"
                  className="text-red-500 text-xs mt-1"
                >
                  {phoneError}
                </p>
              )}
            </div>
            <div>
              <Label>Address</Label>
              <Input
                data-ocid="customers.address.input"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder="Village address"
              />
            </div>
            <div>
              <Label>Aadhar No (optional)</Label>
              <Input
                data-ocid="customers.aadhar.input"
                value={form.aadharNo}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setForm((f) => ({ ...f, aadharNo: digits }));
                }}
                placeholder="12-digit Aadhar number"
                inputMode="numeric"
              />
            </div>
            <div>
              <Label>Village</Label>
              <Select
                value={form.villageId}
                onValueChange={(v) => setForm((f) => ({ ...f, villageId: v }))}
              >
                <SelectTrigger data-ocid="customers.village.select">
                  <SelectValue placeholder="Select village" />
                </SelectTrigger>
                <SelectContent>
                  {villages.map((v) => (
                    <SelectItem key={v.id.toString()} value={v.id.toString()}>
                      {v.shortCode} - {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Customer Documents</Label>
              <button
                type="button"
                data-ocid="customers.docs.upload_button"
                className="mt-1 w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-6 w-6 text-gray-400 mb-1" />
                <p className="text-sm text-gray-500">
                  Click to upload PDFs or images
                </p>
                <p className="text-xs text-gray-400">PDF, JPG, PNG supported</p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              {docs.length > 0 && (
                <div className="mt-2 space-y-2">
                  {docs.map((doc) => (
                    <div
                      key={doc.name}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-indigo-600 hover:underline truncate"
                        >
                          {doc.name}
                        </a>
                        <span className="text-xs text-gray-400 shrink-0">
                          ({(doc.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDoc(doc.name)}
                        className="text-red-400 hover:text-red-600 shrink-0 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="customers.cancel.cancel_button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="customers.save.save_button"
              onClick={save}
              disabled={saving || !form.name || !form.villageId || !!phoneError}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
