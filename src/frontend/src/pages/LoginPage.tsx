import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { type CustomerSession, useAuth } from "../context/AuthContext";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import type { ExtendedBackend } from "../types";

type SelectedRole = "admin" | "staff" | "customer" | null;
type Step = "select" | "form";

export default function LoginPage() {
  const { login, identity, isLoggingIn } = useInternetIdentity();
  const { actor: rawActor } = useActor();
  const actor = rawActor as ExtendedBackend | null;
  const { loginAsCustomer, loginAsStaff } = useAuth();

  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null);
  const [step, setStep] = useState<Step>("select");

  // Staff form state
  const [staffPhone, setStaffPhone] = useState("");
  const [staffVerified, setStaffVerified] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [staffChecking, setStaffChecking] = useState(false);

  // Customer form state
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custLoanId, setCustLoanId] = useState("");
  const [custError, setCustError] = useState("");
  const [custChecking, setCustChecking] = useState(false);

  // After II login succeeds for staff, complete staff login
  useEffect(() => {
    if (identity && selectedRole === "staff" && staffVerified) {
      loginAsStaff(staffPhone);
    }
  }, [identity, selectedRole, staffVerified, staffPhone, loginAsStaff]);

  const verifyStaffPhone = async () => {
    if (!actor || !staffPhone.trim()) return;
    setStaffChecking(true);
    setStaffError("");
    try {
      const isAgent = await actor.isPhoneAnAgent(staffPhone.trim());
      if (isAgent) {
        setStaffVerified(true);
      } else {
        setStaffError(
          "This phone number is not registered as an agent. Contact your admin.",
        );
      }
    } catch {
      setStaffError("Verification failed. Please try again.");
    } finally {
      setStaffChecking(false);
    }
  };

  const handleCustomerLogin = async () => {
    if (!actor || !custPhone.trim() || !custLoanId.trim()) return;
    setCustChecking(true);
    setCustError("");
    try {
      const isValid = await actor.verifyCustomerLoanAccess(
        custPhone.trim(),
        custLoanId.trim().toUpperCase(),
      );
      if (isValid) {
        const session: CustomerSession = {
          phone: custPhone.trim(),
          loanId: custLoanId.trim().toUpperCase(),
          customerName: custName.trim() || "Customer",
        };
        loginAsCustomer(session);
      } else {
        setCustError(
          "Mobile number and loan account number do not match. Please check and try again.",
        );
      }
    } catch {
      setCustError("Verification failed. Please try again.");
    } finally {
      setCustChecking(false);
    }
  };

  const roles = [
    {
      id: "admin" as const,
      icon: "👑",
      title: "Admin",
      desc: "Full access to all features",
      color: "from-indigo-500 to-purple-600",
      border: "border-indigo-200 hover:border-indigo-400",
    },
    {
      id: "staff" as const,
      icon: "🧑‍💼",
      title: "Staff / Agent",
      desc: "Add customers, villages & disburse loans",
      color: "from-teal-500 to-emerald-600",
      border: "border-teal-200 hover:border-teal-400",
    },
    {
      id: "customer" as const,
      icon: "🏠",
      title: "Customer",
      desc: "View your loan account & repayment history",
      color: "from-amber-500 to-orange-600",
      border: "border-amber-200 hover:border-amber-400",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <div className="text-6xl mb-3">🏦</div>
        <h1 className="text-4xl font-bold text-white mb-1">Village Finance</h1>
        <p className="text-indigo-300 text-sm">
          Lending management for your village business
        </p>
      </motion.div>

      {step === "select" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full max-w-lg"
        >
          <p className="text-indigo-200 text-center mb-6 font-medium">
            Select your role to continue
          </p>
          <div className="space-y-3">
            {roles.map((r, i) => (
              <motion.button
                key={r.id}
                data-ocid={`login.${r.id}.card`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                type="button"
                onClick={() => {
                  setSelectedRole(r.id);
                  setStep("form");
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 bg-white/5 backdrop-blur-sm text-left transition-all duration-200 ${r.border} hover:bg-white/10`}
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${r.color} flex items-center justify-center text-2xl flex-shrink-0`}
                >
                  {r.icon}
                </div>
                <div>
                  <div className="font-bold text-white text-base">
                    {r.title}
                  </div>
                  <div className="text-indigo-300 text-sm">{r.desc}</div>
                </div>
                <div className="ml-auto text-indigo-400">›</div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {step === "form" && selectedRole === "admin" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-indigo-400/30 text-center">
            <div className="text-5xl mb-4">👑</div>
            <h2 className="text-2xl font-bold text-white mb-2">Admin Login</h2>
            <p className="text-indigo-300 text-sm mb-6">
              Sign in with Internet Identity to access the full admin panel.
            </p>
            <Button
              data-ocid="login.admin.primary_button"
              onClick={login}
              disabled={isLoggingIn}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3"
            >
              {isLoggingIn ? "Connecting..." : "Login with Internet Identity"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("select")}
              className="mt-4 text-indigo-400 text-sm hover:text-indigo-200"
            >
              ← Back
            </button>
          </div>
        </motion.div>
      )}

      {step === "form" && selectedRole === "staff" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-teal-400/30">
            <div className="text-5xl mb-4 text-center">🧑‍💼</div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              Staff / Agent Login
            </h2>

            {!staffVerified ? (
              <>
                <p className="text-teal-300 text-sm mb-6 text-center">
                  Enter your registered agent phone number to verify access.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label className="text-teal-200 text-sm mb-1 block">
                      Agent Phone Number
                    </Label>
                    <Input
                      data-ocid="login.staff.phone.input"
                      value={staffPhone}
                      onChange={(e) => {
                        setStaffPhone(e.target.value);
                        setStaffError("");
                      }}
                      placeholder="Enter phone number"
                      className="bg-white/10 border-teal-400/40 text-white placeholder:text-white/40"
                    />
                    {staffError && (
                      <p
                        data-ocid="login.staff.error_state"
                        className="text-red-400 text-xs mt-1"
                      >
                        {staffError}
                      </p>
                    )}
                  </div>
                  <Button
                    data-ocid="login.staff.verify.primary_button"
                    onClick={verifyStaffPhone}
                    disabled={staffChecking || !staffPhone.trim()}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    {staffChecking ? "Verifying..." : "Verify Phone"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-teal-300 text-sm mb-6 text-center">
                  ✅ Phone verified! Now sign in with Internet Identity to
                  complete login.
                </p>
                <Button
                  data-ocid="login.staff.ii.primary_button"
                  onClick={login}
                  disabled={isLoggingIn}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {isLoggingIn
                    ? "Connecting..."
                    : "Login with Internet Identity"}
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setStep("select");
                setStaffVerified(false);
                setStaffPhone("");
                setStaffError("");
              }}
              className="mt-4 text-teal-400 text-sm hover:text-teal-200 w-full text-center block"
            >
              ← Back
            </button>
          </div>
        </motion.div>
      )}

      {step === "form" && selectedRole === "customer" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-amber-400/30">
            <div className="text-5xl mb-4 text-center">🏠</div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              Customer Login
            </h2>
            <p className="text-amber-300 text-sm mb-6 text-center">
              Enter your mobile number and loan account number to access your
              account.
            </p>

            <div className="space-y-4">
              <div>
                <Label className="text-amber-200 text-sm mb-1 block">
                  Your Name
                </Label>
                <Input
                  data-ocid="login.customer.name.input"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Enter your name"
                  className="bg-white/10 border-amber-400/40 text-white placeholder:text-white/40"
                />
              </div>
              <div>
                <Label className="text-amber-200 text-sm mb-1 block">
                  Mobile Number
                </Label>
                <Input
                  data-ocid="login.customer.phone.input"
                  value={custPhone}
                  onChange={(e) => {
                    setCustPhone(e.target.value);
                    setCustError("");
                  }}
                  placeholder="Enter mobile number"
                  className="bg-white/10 border-amber-400/40 text-white placeholder:text-white/40"
                />
              </div>
              <div>
                <Label className="text-amber-200 text-sm mb-1 block">
                  Loan Account Number
                </Label>
                <Input
                  data-ocid="login.customer.loanid.input"
                  value={custLoanId}
                  onChange={(e) => {
                    setCustLoanId(e.target.value);
                    setCustError("");
                  }}
                  placeholder="e.g. GKV260301"
                  className="bg-white/10 border-amber-400/40 text-white placeholder:text-white/40 uppercase"
                />
                {custError && (
                  <p
                    data-ocid="login.customer.error_state"
                    className="text-red-400 text-xs mt-1"
                  >
                    {custError}
                  </p>
                )}
              </div>
              <Button
                data-ocid="login.customer.submit.primary_button"
                onClick={handleCustomerLogin}
                disabled={
                  custChecking || !custPhone.trim() || !custLoanId.trim()
                }
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                {custChecking ? "Verifying..." : "Access My Account"}
              </Button>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep("select");
                setCustError("");
              }}
              className="mt-4 text-amber-400 text-sm hover:text-amber-200 w-full text-center block"
            >
              ← Back
            </button>
          </div>
        </motion.div>
      )}

      <p className="mt-10 text-indigo-500 text-xs">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-indigo-300"
        >
          caffeine.ai
        </a>
      </p>
    </div>
  );
}
