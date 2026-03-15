import { Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserRole } from "./backend";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import Calendar from "./pages/Calendar";
import CustomerPortal from "./pages/CustomerPortal";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import Ledger from "./pages/Ledger";
import Loans from "./pages/Loans";
import Payments from "./pages/Payments";
import Villages from "./pages/Villages";

export default function App() {
  const { identity, login, clear, isInitializing } = useInternetIdentity();
  const { actor, isFetching } = useActor();
  const [role, setRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const fetchRole = useCallback(async () => {
    if (!actor) return;
    try {
      const r = await actor.getCallerUserRole();
      setRole(r);
      setIsRegistered(true);
    } catch {
      setIsRegistered(false);
      setRole(null);
    }
  }, [actor]);

  useEffect(() => {
    if (actor && identity) {
      fetchRole();
    } else if (!identity) {
      setRole(null);
      setIsRegistered(null);
    }
  }, [actor, identity, fetchRole]);

  const handleRegister = async () => {
    if (!actor) return;
    setIsRegistering(true);
    try {
      await (actor as any)._initializeAccessControlWithSecret(adminToken);
      await fetchRole();
      toast.success("Registration successful!");
    } catch (err: any) {
      toast.error(err?.message ?? "Registration failed. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };

  if (isInitializing || (identity && isFetching)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="text-4xl mb-4">🏦</div>
          <div className="text-xl font-semibold text-indigo-700">
            Village Finance
          </div>
          <div className="text-gray-500 mt-2">Loading...</div>
        </div>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full mx-4 text-center">
          <div className="text-6xl mb-4">🏦</div>
          <h1 className="text-3xl font-bold text-indigo-700 mb-2">
            Village Finance
          </h1>
          <p className="text-gray-500 mb-6">
            Lending management for your village business. Track loans, payments,
            and customers all in one place.
          </p>
          <Button
            data-ocid="login.primary_button"
            onClick={login}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-lg"
          >
            Login with Internet Identity
          </Button>
        </div>
      </div>
    );
  }

  // Registration screen for unregistered users
  if (isRegistered === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏦</div>
            <h1 className="text-3xl font-bold text-indigo-700 mb-2">
              Village Finance
            </h1>
            <p className="text-gray-500">
              Complete your registration to get started.
            </p>
          </div>

          <div className="space-y-5">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3">
              <ShieldCheck
                className="text-indigo-500 mt-0.5 shrink-0"
                size={20}
              />
              <p className="text-sm text-indigo-700">
                If you are the <strong>admin</strong>, enter your admin secret
                token below. Otherwise, leave it blank to register as a
                staff/customer user.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="admin-token"
                className="text-gray-700 font-medium"
              >
                Admin Secret Token{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="admin-token"
                data-ocid="register.input"
                type="password"
                placeholder="Enter admin token (leave blank for staff/user)"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                disabled={isRegistering}
                className="border-gray-300 focus:border-indigo-400"
              />
            </div>

            <Button
              data-ocid="register.submit_button"
              onClick={handleRegister}
              disabled={isRegistering}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-base"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : adminToken ? (
                "Register as Admin"
              ) : (
                "Register"
              )}
            </Button>

            <Button
              data-ocid="register.cancel_button"
              variant="ghost"
              onClick={clear}
              disabled={isRegistering}
              className="w-full text-gray-500 hover:text-gray-700"
            >
              Cancel & Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = role === UserRole.admin;

  const adminTabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "villages", label: "Villages" },
    { id: "customers", label: "Customers" },
    { id: "loans", label: "Loans" },
    { id: "payments", label: "Payments" },
    { id: "calendar", label: "Calendar" },
    { id: "ledger", label: "Ledger" },
  ];

  const customerTabs = [
    { id: "my-loans", label: "My Loans" },
    { id: "profile", label: "Profile" },
  ];

  const tabs = isAdmin ? adminTabs : customerTabs;
  const defaultTab = isAdmin ? "dashboard" : "my-loans";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <span className="text-xl font-bold">Village Finance</span>
            {role && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {role === UserRole.admin ? "Admin" : "Customer"}
              </span>
            )}
          </div>
          <Button
            data-ocid="nav.logout_button"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={clear}
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs value={activeTab || defaultTab} onValueChange={setActiveTab}>
            <TabsList className="h-12 bg-transparent gap-1">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  data-ocid={`nav.${tab.id}.tab`}
                  className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isAdmin ? (
          <>
            {(activeTab === "dashboard" || !activeTab) && (
              <Dashboard onNavigate={setActiveTab} />
            )}
            {activeTab === "villages" && <Villages />}
            {activeTab === "customers" && <Customers />}
            {activeTab === "loans" && <Loans />}
            {activeTab === "payments" && <Payments />}
            {activeTab === "calendar" && <Calendar />}
            {activeTab === "ledger" && <Ledger />}
          </>
        ) : (
          <CustomerPortal activeTab={activeTab} />
        )}
      </main>
    </div>
  );
}
