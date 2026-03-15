import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Customer, Loan, Payment } from "../backend";
import { Variant_closed_active } from "../backend";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useAuth } from "../context/AuthContext";
import { useActor } from "../hooks/useActor";
import type { ExtendedBackend } from "../types";
import { formatDate, formatRupees } from "../utils/format";

export default function CustomerPortal() {
  const { customerSession, logout } = useAuth();
  const { actor: rawActor } = useActor();
  const actor = rawActor as ExtendedBackend | null;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (!actor || !customerSession) return;
    (async () => {
      setLoading(true);
      try {
        const [cust, loanList] = await Promise.all([
          actor.getCustomerByPhone(customerSession.phone),
          actor.getLoansByPhone(customerSession.phone),
        ]);
        setCustomer(cust);
        setLoans(loanList);
      } finally {
        setLoading(false);
      }
    })();
  }, [actor, customerSession]);

  const viewPayments = async (loan: Loan) => {
    setSelectedLoan(loan);
    if (!actor) return;
    setLoadingPayments(true);
    try {
      const pmts = await actor.getPaymentsByLoan(loan.loanId);
      setPayments(
        pmts.sort((a, b) => Number(b.paymentDate) - Number(a.paymentDate)),
      );
    } finally {
      setLoadingPayments(false);
    }
  };

  if (!customerSession) return null;

  const activeLoans = loans.filter(
    (l) => l.status === Variant_closed_active.active,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <div>
              <div className="font-bold">Village Finance</div>
              <div className="text-xs text-amber-200">Customer Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-amber-100 hidden sm:block">
              {customerSession.customerName}
            </span>
            <Button
              data-ocid="nav.logout_button"
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div
            data-ocid="portal.loading_state"
            className="text-center py-20 text-gray-400"
          >
            Loading your account...
          </div>
        ) : (
          <>
            {/* Customer Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-3xl">
                      🧑
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {customer?.name ?? customerSession.customerName}
                      </div>
                      <div className="text-amber-100 text-sm">
                        📱 {customerSession.phone}
                      </div>
                      {customer?.address && (
                        <div className="text-amber-100 text-xs mt-0.5">
                          📍 {customer.address}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <CardContent className="p-4 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-700">
                      {loans.length}
                    </div>
                    <div className="text-xs text-gray-500">Total Loans</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-700">
                      {activeLoans.length}
                    </div>
                    <div className="text-xs text-gray-500">Active Loans</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Loan Cards */}
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              My Loan Accounts
            </h3>
            {loans.length === 0 ? (
              <div
                data-ocid="portal.loans.empty_state"
                className="text-center py-20 text-gray-400"
              >
                No loan accounts found.
              </div>
            ) : (
              <div className="space-y-4">
                {loans.map((loan, i) => (
                  <motion.div
                    key={loan.id.toString()}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <Card
                      data-ocid={`portal.loans.item.${i + 1}`}
                      className="border-0 shadow-md overflow-hidden"
                    >
                      <div
                        className={`p-4 text-white ${
                          loan.status === Variant_closed_active.active
                            ? "bg-gradient-to-r from-teal-600 to-cyan-600"
                            : "bg-gradient-to-r from-gray-500 to-gray-600"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono text-xs opacity-80 mb-0.5">
                              Loan A/C: {loan.loanId}
                            </div>
                            <div className="text-2xl font-bold">
                              {formatRupees(loan.principal)}
                            </div>
                            <div className="text-xs opacity-75">
                              Disbursed: {formatDate(loan.disbursedAt)}
                            </div>
                          </div>
                          <Badge
                            className={
                              loan.status === Variant_closed_active.active
                                ? "bg-green-400 text-green-900 text-xs"
                                : "bg-gray-300 text-gray-700 text-xs"
                            }
                          >
                            {loan.status}
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                          <div className="text-center bg-gray-50 rounded-lg p-2">
                            <div className="text-gray-500 text-xs">EMI</div>
                            <div className="font-bold text-gray-800">
                              {formatRupees(loan.emi)}
                            </div>
                          </div>
                          <div className="text-center bg-gray-50 rounded-lg p-2">
                            <div className="text-gray-500 text-xs">Tenure</div>
                            <div className="font-bold text-gray-800">
                              {loan.tenureMonths.toString()}m
                            </div>
                          </div>
                          <div className="text-center bg-gray-50 rounded-lg p-2">
                            <div className="text-gray-500 text-xs">
                              Total Amt
                            </div>
                            <div className="font-bold text-gray-800">
                              {formatRupees(loan.totalAmount)}
                            </div>
                          </div>
                        </div>
                        <Button
                          data-ocid={`portal.loans.payments.button.${i + 1}`}
                          variant="outline"
                          size="sm"
                          className="w-full border-teal-200 text-teal-700 hover:bg-teal-50"
                          onClick={() =>
                            selectedLoan?.loanId === loan.loanId
                              ? setSelectedLoan(null)
                              : viewPayments(loan)
                          }
                        >
                          {selectedLoan?.loanId === loan.loanId
                            ? "Hide Payment History"
                            : "View Payment History"}
                        </Button>

                        {selectedLoan?.loanId === loan.loanId && (
                          <div
                            className="mt-4"
                            data-ocid="portal.payments.panel"
                          >
                            <div className="text-sm font-semibold text-gray-700 mb-2">
                              Payment History
                            </div>
                            {loadingPayments ? (
                              <div
                                data-ocid="portal.payments.loading_state"
                                className="text-center py-4 text-gray-400 text-sm"
                              >
                                Loading payments...
                              </div>
                            ) : payments.length === 0 ? (
                              <div
                                data-ocid="portal.payments.empty_state"
                                className="text-center py-4 text-gray-400 text-sm"
                              >
                                No payments recorded yet.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {payments.map((p, pi) => (
                                  <div
                                    key={p.id.toString()}
                                    data-ocid={`portal.payments.item.${pi + 1}`}
                                    className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm"
                                  >
                                    <div>
                                      <div className="font-medium text-gray-800">
                                        Receipt: {p.receiptNo}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {formatDate(p.paymentDate)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold text-green-700">
                                        +{formatRupees(p.amountPaid)}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Bal: {formatRupees(p.totalOutstanding)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mt-12 pb-6 text-center text-xs text-amber-600">
        © {new Date().getFullYear()}. Built with ❤️ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-amber-800"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
