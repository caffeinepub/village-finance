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

// EMI formula: totalInterest = principal * rate * tenure / 100 (flat interest)
// totalRepayable = principal + totalInterest
// EMI = totalRepayable / tenure, rounded UP to next ₹10
function calcEMI(principal: number, rate: number, tenure: number): number {
  if (tenure <= 0 || principal <= 0) return 0;
  const totalInterest = (principal * rate * tenure) / 100;
  const totalRepayable = principal + totalInterest;
  const rawEMI = totalRepayable / tenure;
  return Math.ceil(rawEMI / 10) * 10;
}

function calcTotalInterest(
  principal: number,
  rate: number,
  tenure: number,
): number {
  return (principal * rate * tenure) / 100;
}

function generateLoanProposalPDF(
  loan: Loan,
  customerName: string,
  villageName: string,
  _formatRupeesFn: (v: bigint) => string,
  formatDateFn: (v: bigint) => string,
) {
  const principalNum = Number(loan.principal) / 100;
  const rateNum = Number(loan.interestRate) / 100;
  const tenureNum = Number(loan.tenureMonths);
  const totalInterest = (principalNum * rateNum * tenureNum) / 100;
  const totalRepayable = principalNum + totalInterest;
  const rawEMI = totalRepayable / tenureNum;
  const emi = Math.ceil(rawEMI / 10) * 10;
  const principalPerEMI = principalNum / tenureNum;
  const disbursedDate = formatDateFn(loan.disbursedAt);
  const disbursedMs = Number(loan.disbursedAt) / 1_000_000;

  let scheduleRows = "";
  let outstandingPrincipal = principalNum;
  for (let i = 1; i <= tenureNum; i++) {
    const dueDate = new Date(disbursedMs);
    dueDate.setMonth(dueDate.getMonth() + i);
    const dueDateStr = dueDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    outstandingPrincipal = Math.max(0, principalNum - principalPerEMI * i);
    scheduleRows += `<tr><td>${i}</td><td>${dueDateStr}</td><td>₹${emi.toFixed(2)}</td><td>₹${principalPerEMI.toFixed(2)}</td><td>₹${(totalInterest / tenureNum).toFixed(2)}</td><td>₹${outstandingPrincipal.toFixed(2)}</td></tr>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Loan Proposal - ${loan.loanId}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
    h1 { color: #14645a; text-align: center; }
    h2 { color: #14645a; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #14645a; color: #fff; padding: 6px 8px; text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f0faf8; }
    .footer { text-align: center; color: #999; font-size: 11px; margin-top: 32px; }
    @media print { button { display: none; } }
  </style></head><body>
  <h1>Village Finance</h1>
  <p style="text-align:center;color:#666">Loan Proposal Document</p>
  <h2>Loan Details</h2>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Loan ID</td><td>${loan.loanId}</td></tr>
    <tr><td>Customer Name</td><td>${customerName}</td></tr>
    <tr><td>Village</td><td>${villageName}</td></tr>
    <tr><td>Date Disbursed</td><td>${disbursedDate}</td></tr>
    <tr><td>Principal Amount</td><td>₹${principalNum.toFixed(2)}</td></tr>
    <tr><td>Interest Rate</td><td>${rateNum.toFixed(2)}% per month (flat)</td></tr>
    <tr><td>Tenure</td><td>${tenureNum} months</td></tr>
    <tr><td>Processing Fee</td><td>₹${(Number(loan.processingFee) / 100).toFixed(2)}</td></tr>
    <tr><td>Total Interest</td><td>₹${totalInterest.toFixed(2)}</td></tr>
    <tr><td>Total Repayable</td><td>₹${totalRepayable.toFixed(2)}</td></tr>
    <tr><td>Monthly EMI</td><td>₹${emi.toFixed(2)}</td></tr>
  </table>
  <h2>Repayment Schedule</h2>
  <table>
    <tr><th>Month</th><th>Due Date</th><th>EMI</th><th>Principal</th><th>Interest</th><th>Outstanding Principal</th></tr>
    ${scheduleRows}
  </table>
  <div class="footer">Village Finance | Generated on ${new Date().toLocaleDateString("en-IN")} | ${loan.loanId}</div>
  <br/><button onclick="window.print()" style="padding:8px 16px;background:#14645a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;">Print / Save as PDF</button>
  </body></html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }
}

export default function Loans() {
  const { actor } = useActor();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<CustomerFull[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [disbursalLoan, setDisbursalLoan] = useState<Loan | null>(null);
  const [disbursalReceiptOpen, setDisbursalReceiptOpen] = useState(false);
  const [sharingDisbursal, setSharingDisbursal] = useState(false);
  const disbursalReceiptRef = useRef<HTMLDivElement>(null);

  // Document upload state
  const [loanDocs, setLoanDocs] = useState<File[]>([]);

  // Top-up state
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupLoan, setTopupLoan] = useState<Loan | null>(null);
  const [topupPayments, setTopupPayments] = useState<Payment[]>([]);
  const [topupLoadingPayments, setTopupLoadingPayments] = useState(false);
  const [topupForm, setTopupForm] = useState({
    topupAmount: "",
    interestRate: "",
    tenure: "",
    processingFee: "",
  });
  const [topupSaving, setTopupSaving] = useState(false);

  // Delete loan state
  const [deleteLoanTarget, setDeleteLoanTarget] = useState<Loan | null>(null);
  const [deletingLoan, setDeletingLoan] = useState(false);

  const [form, setForm] = useState({
    customerId: "",
    principal: "",
    interestRate: "",
    tenure: "",
    processingFee: "",
  });
  const [editForm, setEditForm] = useState({
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
        setCustomers(c as CustomerFull[]);
        setVillages(v);
      })
      .finally(() => setLoading(false));
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const getCustomer = (id: bigint) => customers.find((c) => c.id === id);
  const getVillage = (id: bigint) => villages.find((v) => v.id === id);

  // Form preview calculations
  const principal = Number.parseFloat(form.principal) || 0;
  const rate = Number.parseFloat(form.interestRate) || 0;
  const tenure = Number.parseInt(form.tenure) || 0;
  const previewTotalInterest = calcTotalInterest(principal, rate, tenure);
  const previewTotalAmount = principal + previewTotalInterest;
  const previewEMI = calcEMI(principal, rate, tenure);

  // Edit form preview
  const ePrincipal = Number.parseFloat(editForm.principal) || 0;
  const eRate = Number.parseFloat(editForm.interestRate) || 0;
  const eTenure = Number.parseInt(editForm.tenure) || 0;
  const editPreviewTotalInterest = calcTotalInterest(
    ePrincipal,
    eRate,
    eTenure,
  );
  const editPreviewTotalAmount = ePrincipal + editPreviewTotalInterest;
  const editPreviewEMI = calcEMI(ePrincipal, eRate, eTenure);

  // Top-up preview calculations
  const topupRawAmount = Number.parseFloat(topupForm.topupAmount) || 0;
  const topupRate = Number.parseFloat(topupForm.interestRate) || 0;
  const topupTenure = Number.parseInt(topupForm.tenure) || 0;

  const computeOutstandingPrincipal = (loan: Loan, pmts: Payment[]): bigint => {
    const totalPaid = pmts.reduce(
      (sum, p) => sum + p.amountPaid + p.penalty,
      0n,
    );
    const outstandingTotal = loan.totalAmount - totalPaid;
    if (loan.totalAmount === 0n) return loan.principal;
    return (loan.principal * outstandingTotal) / loan.totalAmount;
  };

  const topupOutstandingPrincipal = topupLoan
    ? computeOutstandingPrincipal(topupLoan, topupPayments)
    : 0n;
  const topupForeclosureCharges = (topupOutstandingPrincipal * 2n) / 100n;
  const topupAmountPaise = BigInt(Math.round(topupRawAmount * 100));
  const topupNewPrincipal =
    topupOutstandingPrincipal + topupForeclosureCharges + topupAmountPaise;
  const topupNewPrincipalNum = Number(topupNewPrincipal) / 100;
  const topupNewEMI = calcEMI(topupNewPrincipalNum, topupRate, topupTenure);

  const resetDisburseForm = () => {
    setForm({
      customerId: "",
      principal: "",
      interestRate: "",
      tenure: "",
      processingFee: "",
    });
    setLoanDocs([]);
  };

  const disburse = async () => {
    if (!actor || !form.customerId || !form.principal) return;
    setSaving(true);
    try {
      const customer = customers.find(
        (c) => c.id.toString() === form.customerId,
      );
      if (!customer) return;
      const loan = await actor.disburseLoan(
        customer.id,
        customer.villageId,
        rupeeInputToPaise(form.principal),
        BigInt(Math.round(rate * 100)),
        BigInt(tenure),
        rupeeInputToPaise(form.processingFee || "0"),
      );
      setDisburseOpen(false);
      resetDisburseForm();
      load();
      setDisbursalLoan(loan);
      setDisbursalReceiptOpen(true);
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (loan: Loan, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLoan(loan);
    setEditForm({
      principal: (Number(loan.principal) / 100).toString(),
      interestRate: (Number(loan.interestRate) / 100).toString(),
      tenure: loan.tenureMonths.toString(),
      processingFee: (Number(loan.processingFee) / 100).toString(),
    });
    setEditOpen(true);
  };

  const openTopup = async (loan: Loan, e: React.MouseEvent) => {
    e.stopPropagation();
    setTopupLoan(loan);
    setTopupForm({
      topupAmount: "",
      interestRate: (Number(loan.interestRate) / 100).toString(),
      tenure: loan.tenureMonths.toString(),
      processingFee: "",
    });
    setTopupPayments([]);
    setTopupOpen(true);
    if (actor) {
      setTopupLoadingPayments(true);
      try {
        const pmts = await actor.getPaymentsByLoan(loan.loanId);
        setTopupPayments(pmts);
      } finally {
        setTopupLoadingPayments(false);
      }
    }
  };

  const saveEdit = async () => {
    if (!actor || !editLoan) return;
    setSaving(true);
    try {
      alert(
        "To update a loan, please close the existing loan and disburse a new one with the corrected values.",
      );
      setEditOpen(false);
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const submitTopup = async () => {
    if (!actor || !topupLoan) return;
    setTopupSaving(true);
    try {
      const newLoan = await actor.topupLoan(
        topupLoan.loanId,
        topupAmountPaise,
        BigInt(Math.round(topupRate * 100)),
        BigInt(topupTenure),
        rupeeInputToPaise(topupForm.processingFee || "0"),
      );
      setTopupOpen(false);
      setTopupLoan(null);
      load();
      setDisbursalLoan(newLoan);
      setDisbursalReceiptOpen(true);
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTopupSaving(false);
    }
  };

  const viewDetail = async (loan: Loan) => {
    setDetailLoan(loan);
    if (actor) {
      const p = await actor.getPaymentsByLoan(loan.loanId);
      setPayments(p);
    }
  };

  // Share disbursal receipt via WhatsApp (image)
  const shareDisbursalWhatsApp = async () => {
    if (!disbursalLoan || !disbursalReceiptRef.current) return;
    setSharingDisbursal(true);
    try {
      const blob = await captureElementAsBlob(disbursalReceiptRef.current);
      const customer = getCustomer(disbursalLoan.customerId);
      const customerName = customer?.name || "Customer";
      if (
        blob &&
        navigator.canShare &&
        navigator.canShare({
          files: [new File([blob], "receipt.png", { type: "image/png" })],
        })
      ) {
        const file = new File(
          [blob],
          `VF_Disbursal_${disbursalLoan.loanId}.png`,
          { type: "image/png" },
        );
        await navigator.share({
          title: "Village Finance Disbursal Receipt",
          text: `Loan disbursal receipt for ${customerName} - ${disbursalLoan.loanId}`,
          files: [file],
        });
      } else if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VF_Disbursal_${disbursalLoan.loanId}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setTimeout(() => {
          const text = buildDisbursalSMSText(disbursalLoan, customerName);
          window.open(
            `https://wa.me/?text=${encodeURIComponent(text)}`,
            "_blank",
          );
        }, 500);
      } else {
        const text = buildDisbursalSMSText(disbursalLoan, customerName);
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          "_blank",
        );
      }
    } catch (e) {
      console.error("Share failed:", e);
    } finally {
      setSharingDisbursal(false);
    }
  };

  const shareDisbursalSMS = () => {
    if (!disbursalLoan) return;
    const customer = getCustomer(disbursalLoan.customerId);
    const text = buildDisbursalSMSText(
      disbursalLoan,
      customer?.name || "Customer",
    );
    window.open(`sms:?body=${encodeURIComponent(text)}`, "_blank");
  };

  function buildDisbursalSMSText(loan: Loan, customerName: string): string {
    const totalInterest = Number(loan.totalAmount - loan.principal) / 100;
    return [
      "Village Finance Loan Disbursal",
      `Loan ID: ${loan.loanId}`,
      `Customer: ${customerName}`,
      `Principal: ${formatRupees(loan.principal)}`,
      `EMI: ${formatRupees(loan.emi)}/month`,
      `Tenure: ${loan.tenureMonths.toString()} months`,
      `Total Interest: ₹${totalInterest.toFixed(2)}`,
      `Total Repayable: ${formatRupees(loan.totalAmount)}`,
      `Date: ${formatDate(loan.disbursedAt)}`,
    ].join("\n");
  }

  if (loading)
    return (
      <div
        data-ocid="loans.loading_state"
        className="text-center py-20 text-muted-foreground"
      >
        Loading...
      </div>
    );

  const confirmDeleteLoan = async () => {
    if (!actor || !deleteLoanTarget) return;
    setDeletingLoan(true);
    try {
      await actor.deleteLoan(deleteLoanTarget.loanId);
      setDeleteLoanTarget(null);
      const [updatedLoans] = await Promise.all([actor.getAllLoans()]);
      setLoans(updatedLoans as Loan[]);
      alert(
        "Loan account deleted. Principal has been added back to Balance in Hand.",
      );
    } catch (err) {
      console.error("Delete loan error:", err);
      alert(`Failed to delete loan: ${String(err)}`);
    } finally {
      setDeletingLoan(false);
    }
  };

  return (
    <div data-ocid="loans.section">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Loans</h2>
        <Button
          data-ocid="loans.disburse.primary_button"
          onClick={() => setDisburseOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          + Disburse Loan
        </Button>
      </div>

      {loans.length === 0 ? (
        <div
          data-ocid="loans.empty_state"
          className="text-center py-20 text-muted-foreground"
        >
          No loans yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loans.map((loan, i) => {
            const customer = getCustomer(loan.customerId);
            const village = getVillage(loan.villageId);
            const isActive = loan.status === Variant_closed_active.active;
            return (
              <Card
                key={loan.id.toString()}
                data-ocid={`loans.item.${i + 1}`}
                className="border shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => viewDetail(loan)}
              >
                <div
                  className={`p-4 text-white ${
                    isActive
                      ? "bg-gradient-to-r from-teal-600 to-cyan-600"
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
                    <div className="flex flex-col gap-2 items-end">
                      <Badge
                        className={
                          isActive
                            ? "bg-green-400 text-green-900"
                            : "bg-gray-300 text-gray-700"
                        }
                      >
                        {loan.status}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          data-ocid={`loans.edit_button.${i + 1}`}
                          size="sm"
                          variant="secondary"
                          className="text-xs h-7 bg-white/20 hover:bg-white/30 text-white border-white/30"
                          onClick={(e) => openEdit(loan, e)}
                        >
                          Edit
                        </Button>
                        {isActive && (
                          <Button
                            data-ocid={`loans.topup_button.${i + 1}`}
                            size="sm"
                            variant="secondary"
                            className="text-xs h-7 bg-amber-400/80 hover:bg-amber-400 text-amber-900 border-amber-300/50 font-semibold"
                            onClick={(e) => openTopup(loan, e)}
                          >
                            Top-up
                          </Button>
                        )}
                        {isActive && (
                          <Button
                            data-ocid={`loans.delete_button.${i + 1}`}
                            size="sm"
                            variant="secondary"
                            className="text-xs h-7 bg-red-100 hover:bg-red-200 text-red-700 border-red-300/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteLoanTarget(loan);
                            }}
                          >
                            🗑️ Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Principal</div>
                    <div className="font-bold">
                      {formatRupees(loan.principal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">EMI</div>
                    <div className="font-bold text-teal-700">
                      {formatRupees(loan.emi)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Tenure</div>
                    <div className="font-bold">
                      {loan.tenureMonths.toString()} months
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Processing Fee</div>
                    <div className="font-bold">
                      {formatRupees(loan.processingFee)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Amount</div>
                    <div className="font-bold text-teal-700">
                      {formatRupees(loan.totalAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Disbursed</div>
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
      <Dialog
        open={disburseOpen}
        onOpenChange={(v) => {
          setDisburseOpen(v);
          if (!v) resetDisburseForm();
        }}
      >
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
                  placeholder="10000"
                />
              </div>
              <div>
                <Label>Interest Rate (% per month)</Label>
                <Input
                  data-ocid="loans.rate.input"
                  type="number"
                  step="0.1"
                  value={form.interestRate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, interestRate: e.target.value }))
                  }
                  placeholder="2"
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
                  placeholder="12"
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
                  placeholder="0"
                />
              </div>
            </div>
            {principal > 0 && rate > 0 && tenure > 0 && (
              <div
                data-ocid="loan.emi.card"
                className="bg-teal-50 border border-teal-200 p-4 rounded-lg space-y-2 text-sm"
              >
                <div className="font-semibold text-teal-800 mb-2">
                  EMI Preview
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Interest:</span>
                  <span className="font-medium">
                    ₹{((principal * rate) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Interest:</span>
                  <span className="font-medium">
                    ₹{previewTotalInterest.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Repayable:</span>
                  <span className="font-medium">
                    ₹{previewTotalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-teal-700 border-t border-teal-200 pt-2 mt-1">
                  <span className="font-bold">Monthly EMI:</span>
                  <span className="font-bold text-lg">₹{previewEMI}</span>
                </div>
              </div>
            )}

            {/* Loan Documents Upload */}
            <div className="space-y-2">
              <Label>Loan Documents (Optional)</Label>
              <label
                data-ocid="loans.docs.upload_button"
                className="border-2 border-dashed border-teal-200 rounded-lg p-4 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors block"
              >
                <div className="text-3xl mb-1">📎</div>
                <div className="text-sm text-gray-600">
                  Click to upload documents
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Any file type accepted (ID proof, income docs, etc.)
                </div>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setLoanDocs((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </label>
              {loanDocs.length > 0 && (
                <div className="space-y-1">
                  {loanDocs.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded px-3 py-1.5 text-sm"
                    >
                      <span className="text-teal-800 truncate max-w-[200px]">
                        📄 {file.name}
                      </span>
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-600 ml-2 text-xs font-semibold"
                        onClick={() =>
                          setLoanDocs((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="loans.cancel.cancel_button"
              variant="outline"
              onClick={() => {
                setDisburseOpen(false);
                resetDisburseForm();
              }}
            >
              Cancel
            </Button>
            <Button
              data-ocid="loans.disburse.confirm_button"
              onClick={disburse}
              disabled={
                saving ||
                !form.customerId ||
                !form.principal ||
                !form.interestRate ||
                !form.tenure
              }
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? "Processing..." : "Disburse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursal Receipt Dialog */}
      <Dialog
        open={disbursalReceiptOpen}
        onOpenChange={(v) => {
          if (!v) {
            setDisbursalReceiptOpen(false);
            setDisbursalLoan(null);
          }
        }}
      >
        <DialogContent
          data-ocid="loans.disbursal_receipt.dialog"
          className="max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Loan Disbursal Receipt</DialogTitle>
          </DialogHeader>
          {disbursalLoan &&
            (() => {
              const customer = getCustomer(disbursalLoan.customerId);
              const village = getVillage(disbursalLoan.villageId);
              const totalInterest =
                Number(disbursalLoan.totalAmount - disbursalLoan.principal) /
                100;
              return (
                <div className="space-y-4">
                  <div
                    ref={disbursalReceiptRef}
                    className="bg-white border-2 border-teal-200 rounded-xl p-5"
                  >
                    <div className="text-center border-b border-gray-200 pb-3 mb-4">
                      <div className="text-2xl">🏦</div>
                      <div className="font-bold text-teal-700 text-lg">
                        Village Finance
                      </div>
                      <div className="text-xs text-gray-500">
                        Loan Disbursal Receipt
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <DRow label="Loan ID" value={disbursalLoan.loanId} />
                      <DRow label="Customer" value={customer?.name || "--"} />
                      <DRow
                        label="Village"
                        value={
                          village
                            ? `${village.shortCode} - ${village.name}`
                            : "--"
                        }
                      />
                      <DRow
                        label="Date Disbursed"
                        value={formatDate(disbursalLoan.disbursedAt)}
                      />
                      <div className="border-t pt-2 mt-2 space-y-2">
                        <DRow
                          label="Principal Amount"
                          value={formatRupees(disbursalLoan.principal)}
                          bold
                        />
                        <DRow
                          label="Interest Rate"
                          value={`${(Number(disbursalLoan.interestRate) / 100).toFixed(2)}% per month`}
                        />
                        <DRow
                          label="Tenure"
                          value={`${disbursalLoan.tenureMonths.toString()} months`}
                        />
                        <DRow
                          label="Total Interest"
                          value={`₹${totalInterest.toFixed(2)}`}
                        />
                        <DRow
                          label="Total Repayable"
                          value={formatRupees(disbursalLoan.totalAmount)}
                          bold
                        />
                        <DRow
                          label="Monthly EMI"
                          value={formatRupees(disbursalLoan.emi)}
                          bold
                        />
                        {disbursalLoan.processingFee > 0n && (
                          <DRow
                            label="Processing Fee"
                            value={formatRupees(disbursalLoan.processingFee)}
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-center mt-4 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-400">
                        Loan disbursed successfully
                      </div>
                    </div>
                  </div>

                  {/* Share Buttons */}
                  <div className="flex gap-2">
                    <Button
                      data-ocid="loans.disbursal_receipt.whatsapp.primary_button"
                      onClick={shareDisbursalWhatsApp}
                      disabled={sharingDisbursal}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs"
                    >
                      {sharingDisbursal ? "Preparing..." : "📤 WhatsApp"}
                    </Button>
                    <Button
                      data-ocid="loans.disbursal_receipt.sms.secondary_button"
                      onClick={shareDisbursalSMS}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs"
                    >
                      💬 SMS
                    </Button>
                    <Button
                      data-ocid="loans.disbursal_receipt.pdf.secondary_button"
                      onClick={() => {
                        const cust = getCustomer(disbursalLoan.customerId);
                        const vill = getVillage(disbursalLoan.villageId);
                        generateLoanProposalPDF(
                          disbursalLoan,
                          cust?.name || "Customer",
                          vill ? `${vill.shortCode} - ${vill.name}` : "--",
                          formatRupees,
                          formatDate,
                        );
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs"
                    >
                      📄 PDF
                    </Button>
                  </div>
                </div>
              );
            })()}
          <DialogFooter>
            <Button
              data-ocid="loans.disbursal_receipt.close_button"
              variant="outline"
              onClick={() => {
                setDisbursalReceiptOpen(false);
                setDisbursalLoan(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Loan Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-ocid="loans.edit.dialog" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Loan Details — {editLoan?.loanId}</DialogTitle>
          </DialogHeader>
          {editLoan && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Principal (₹)</Label>
                  <Input
                    data-ocid="loans.edit.principal.input"
                    type="number"
                    value={editForm.principal}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, principal: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input
                    data-ocid="loans.edit.rate.input"
                    type="number"
                    step="0.1"
                    value={editForm.interestRate}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        interestRate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Tenure (months)</Label>
                  <Input
                    data-ocid="loans.edit.tenure.input"
                    type="number"
                    value={editForm.tenure}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, tenure: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Processing Fee (₹)</Label>
                  <Input
                    data-ocid="loans.edit.fee.input"
                    type="number"
                    value={editForm.processingFee}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        processingFee: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              {ePrincipal > 0 && eRate > 0 && eTenure > 0 && (
                <div
                  data-ocid="loans.edit.emi.card"
                  className="bg-teal-50 border border-teal-200 p-4 rounded-lg space-y-2 text-sm"
                >
                  <div className="font-semibold text-teal-800 mb-2">
                    Recalculated EMI
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Interest:</span>
                    <span className="font-medium">
                      ₹{editPreviewTotalInterest.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Repayable:</span>
                    <span className="font-medium">
                      ₹{editPreviewTotalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-teal-700 border-t border-teal-200 pt-2">
                    <span className="font-bold">Monthly EMI:</span>
                    <span className="font-bold text-lg">₹{editPreviewEMI}</span>
                  </div>
                </div>
              )}
              <div className="text-sm text-gray-500">
                Current stored EMI:{" "}
                <strong>{formatRupees(editLoan.emi)}</strong>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              data-ocid="loans.edit.cancel_button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Close
            </Button>
            <Button
              data-ocid="loans.edit.save_button"
              onClick={saveEdit}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top-up Dialog */}
      <Dialog
        open={topupOpen}
        onOpenChange={(v) => {
          if (!v) {
            setTopupOpen(false);
            setTopupLoan(null);
          }
        }}
      >
        <DialogContent data-ocid="loans.topup.dialog" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Loan Top-up — {topupLoan?.loanId}</DialogTitle>
          </DialogHeader>
          {topupLoan && (
            <div className="space-y-4">
              {/* Info box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>How it works:</strong> The existing loan will be closed.
                A new loan will be created with the outstanding principal + 2%
                foreclosure charge + your top-up amount as the new principal.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Top-up Amount (₹)</Label>
                  <Input
                    data-ocid="loans.topup.amount.input"
                    type="number"
                    value={topupForm.topupAmount}
                    onChange={(e) =>
                      setTopupForm((f) => ({
                        ...f,
                        topupAmount: e.target.value,
                      }))
                    }
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label>Interest Rate (% per month)</Label>
                  <Input
                    data-ocid="loans.topup.rate.input"
                    type="number"
                    step="0.1"
                    value={topupForm.interestRate}
                    onChange={(e) =>
                      setTopupForm((f) => ({
                        ...f,
                        interestRate: e.target.value,
                      }))
                    }
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label>Tenure (months)</Label>
                  <Input
                    data-ocid="loans.topup.tenure.input"
                    type="number"
                    value={topupForm.tenure}
                    onChange={(e) =>
                      setTopupForm((f) => ({
                        ...f,
                        tenure: e.target.value,
                      }))
                    }
                    placeholder="12"
                  />
                </div>
                <div>
                  <Label>Processing Fee (₹)</Label>
                  <Input
                    data-ocid="loans.topup.fee.input"
                    type="number"
                    value={topupForm.processingFee}
                    onChange={(e) =>
                      setTopupForm((f) => ({
                        ...f,
                        processingFee: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Breakdown preview */}
              <div
                data-ocid="loans.topup.breakdown.card"
                className="bg-amber-50 border border-amber-200 p-4 rounded-lg space-y-2 text-sm"
              >
                <div className="font-semibold text-amber-800 mb-2">
                  {topupLoadingPayments
                    ? "Loading breakdown..."
                    : "New Loan Breakdown"}
                </div>
                {!topupLoadingPayments && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Outstanding Principal:
                      </span>
                      <span className="font-medium">
                        {formatRupees(topupOutstandingPrincipal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Foreclosure Charges (2%):
                      </span>
                      <span className="font-medium text-red-600">
                        + {formatRupees(topupForeclosureCharges)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Top-up Amount:</span>
                      <span className="font-medium text-teal-700">
                        +{" "}
                        {topupRawAmount > 0
                          ? `₹${topupRawAmount.toFixed(2)}`
                          : "₹0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-amber-200 pt-2 mt-1">
                      <span className="font-bold text-amber-900">
                        New Principal:
                      </span>
                      <span className="font-bold">
                        {formatRupees(topupNewPrincipal)}
                      </span>
                    </div>
                    {topupRate > 0 &&
                      topupTenure > 0 &&
                      topupNewPrincipalNum > 0 && (
                        <div className="flex justify-between text-teal-700 border-t border-amber-200 pt-2">
                          <span className="font-bold">New Monthly EMI:</span>
                          <span className="font-bold text-lg">
                            ₹{topupNewEMI}
                          </span>
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              data-ocid="loans.topup.cancel_button"
              variant="outline"
              onClick={() => {
                setTopupOpen(false);
                setTopupLoan(null);
              }}
            >
              Cancel
            </Button>
            <Button
              data-ocid="loans.topup.confirm_button"
              onClick={submitTopup}
              disabled={
                topupSaving ||
                topupLoadingPayments ||
                !topupForm.topupAmount ||
                !topupForm.interestRate ||
                !topupForm.tenure
              }
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {topupSaving ? "Processing..." : "Confirm Top-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        open={!!detailLoan}
        onOpenChange={(v) => !v && setDetailLoan(null)}
      >
        <DialogContent
          data-ocid="loans.detail.dialog"
          className="max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>Loan Details — {detailLoan?.loanId}</DialogTitle>
          </DialogHeader>
          {detailLoan && (
            <div className="space-y-4">
              {/* Customer Profile at the TOP */}
              {(() => {
                const detailCust = getCustomer(detailLoan.customerId);
                const detailVill = getVillage(detailLoan.villageId);
                return (
                  <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center font-bold text-2xl">
                        {detailCust?.name?.[0] || "?"}
                      </div>
                      <div>
                        <div className="font-bold text-lg">
                          {detailCust?.name || "--"}
                        </div>
                        {detailCust?.phone && (
                          <div className="text-sm opacity-85">
                            📞 {detailCust.phone}
                          </div>
                        )}
                        {detailVill && (
                          <div className="text-xs opacity-75">
                            🏘 {detailVill.shortCode} - {detailVill.name}
                          </div>
                        )}
                      </div>
                      <div className="ml-auto">
                        <Badge
                          className={
                            detailLoan.status === Variant_closed_active.active
                              ? "bg-green-300 text-green-900"
                              : "bg-gray-200 text-gray-700"
                          }
                        >
                          {detailLoan.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Loan Details */}
              <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 rounded-lg p-3">
                <div>
                  <span className="text-muted-foreground">Loan ID:</span>{" "}
                  <span className="font-mono font-medium text-xs">
                    {detailLoan.loanId}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Disbursed:</span>{" "}
                  <span className="font-medium">
                    {formatDate(detailLoan.disbursedAt)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Principal:</span>{" "}
                  <span className="font-medium">
                    {formatRupees(detailLoan.principal)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">EMI:</span>{" "}
                  <span className="font-medium text-teal-700">
                    {formatRupees(detailLoan.emi)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Amount:</span>{" "}
                  <span className="font-medium">
                    {formatRupees(detailLoan.totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tenure:</span>{" "}
                  <span className="font-medium">
                    {detailLoan.tenureMonths.toString()} months
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">
                    Total Outstanding:
                  </span>{" "}
                  <span className="font-bold text-red-600">
                    {payments.length > 0
                      ? formatRupees(
                          payments[payments.length - 1].totalOutstanding,
                        )
                      : formatRupees(detailLoan.totalAmount)}
                  </span>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-2">Payment History</div>
                {payments.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    No payments yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {payments.map((p, i) => (
                      <div
                        key={p.id.toString()}
                        data-ocid={`loan_payments.item.${i + 1}`}
                        className="flex justify-between text-sm bg-muted p-2 rounded"
                      >
                        <span>{formatDate(p.paymentDate)}</span>
                        <span className="font-medium text-green-700">
                          {formatRupees(p.amountPaid)}
                        </span>
                        <span className="text-muted-foreground">
                          Bal: {formatRupees(p.totalOutstanding)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {detailLoan && (
              <Button
                data-ocid="loans.detail.pdf.secondary_button"
                onClick={() => {
                  const cust = getCustomer(detailLoan.customerId);
                  const vill = getVillage(detailLoan.villageId);
                  generateLoanProposalPDF(
                    detailLoan,
                    cust?.name || "Customer",
                    vill ? `${vill.shortCode} - ${vill.name}` : "--",
                    formatRupees,
                    formatDate,
                  );
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                📄 Download Loan Proposal
              </Button>
            )}
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

      {/* Delete Loan Confirmation Dialog */}
      <AlertDialog
        open={!!deleteLoanTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteLoanTarget(null);
        }}
      >
        <AlertDialogContent data-ocid="loans.delete_dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loan Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete loan{" "}
              <strong>{deleteLoanTarget?.loanId}</strong>? The principal amount
              (
              <strong>
                ₹
                {deleteLoanTarget
                  ? (Number(deleteLoanTarget.principal) / 100).toLocaleString(
                      "en-IN",
                    )
                  : 0}
              </strong>
              ) will be added back to Balance in Hand. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-ocid="loans.delete_cancel_button"
              disabled={deletingLoan}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="loans.delete_confirm_button"
              onClick={confirmDeleteLoan}
              disabled={deletingLoan}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingLoan ? "Deleting..." : "Delete Loan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DRow({
  label,
  value,
  bold,
}: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}:</span>
      <span className={bold ? "font-bold text-teal-700" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}
