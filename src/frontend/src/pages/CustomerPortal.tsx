import { useEffect, useState } from "react";
import type { Loan, Payment, UserProfile } from "../backend";
import { Variant_closed_active } from "../backend";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { formatDate, formatRupees } from "../utils/format";

interface Props {
  activeTab: string;
}

export default function CustomerPortal({ activeTab }: Props) {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor || !identity) return;
    (async () => {
      setLoading(true);
      try {
        const [allCustomers, prof] = await Promise.all([
          actor.getAllCustomers(),
          actor.getCallerUserProfile(),
        ]);
        setProfile(prof);
        setProfileName(prof?.name ?? "");
        const principal = identity.getPrincipal().toString();
        const me = allCustomers.find((c) => c.userId.toString() === principal);
        if (me) {
          const myLoans = await actor.getLoansByCustomer(me.id);
          setLoans(myLoans);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [actor, identity]);

  const viewLoan = async (loan: Loan) => {
    setSelectedLoan(loan);
    if (actor) {
      const p = await actor.getPaymentsByLoan(loan.loanId);
      setPayments(p);
    }
  };

  const saveProfile = async () => {
    if (!actor) return;
    setSaving(true);
    try {
      await actor.saveCallerUserProfile({ name: profileName });
      setProfile({ name: profileName });
    } finally {
      setSaving(false);
    }
  };

  // suppress unused warning - profile is used for future display
  void profile;

  if (loading)
    return (
      <div
        data-ocid="portal.loading_state"
        className="text-center py-20 text-gray-400"
      >
        Loading...
      </div>
    );

  if (activeTab === "profile") {
    return (
      <div data-ocid="portal.profile.section">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h2>
        <Card className="max-w-md border-0 shadow-md">
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label>Display Name</Label>
              <Input
                data-ocid="portal.profile.name.input"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <Button
              data-ocid="portal.profile.save_button"
              onClick={saveProfile}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-ocid="portal.loans.section">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">My Loans</h2>
      {loans.length === 0 ? (
        <div
          data-ocid="portal.loans.empty_state"
          className="text-center py-20 text-gray-400"
        >
          No loans found for your account.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loans.map((loan, i) => (
            <Card
              key={loan.id.toString()}
              data-ocid={`portal.loans.item.${i + 1}`}
              className="border-0 shadow-md overflow-hidden cursor-pointer hover:shadow-lg"
              onClick={() => viewLoan(loan)}
            >
              <div
                className={`p-4 text-white ${
                  loan.status === Variant_closed_active.active
                    ? "bg-gradient-to-r from-teal-600 to-cyan-600"
                    : "bg-gradient-to-r from-gray-500 to-gray-600"
                }`}
              >
                <div className="font-mono text-sm opacity-80">
                  {loan.loanId}
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="font-bold text-lg">
                    {formatRupees(loan.principal)}
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
              <CardContent className="p-4 grid grid-cols-2 gap-2 text-sm">
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
                  <div className="text-gray-500">Total Amount</div>
                  <div className="font-bold">
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
          ))}
        </div>
      )}

      {selectedLoan && (
        <div className="mt-6">
          <h3 className="text-xl font-bold mb-3">
            Payment History - {selectedLoan.loanId}
          </h3>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No payments recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p, i) => (
                <Card
                  key={p.id.toString()}
                  data-ocid={`portal.payments.item.${i + 1}`}
                  className="border-0 shadow-sm"
                >
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-medium">Receipt: {p.receiptNo}</div>
                      <div className="text-sm text-gray-500">
                        {formatDate(p.paymentDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-700">
                        {formatRupees(p.amountPaid)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Bal: {formatRupees(p.totalOutstanding)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
