import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import Calendar from "./pages/Calendar";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import Ledger from "./pages/Ledger";
import Loans from "./pages/Loans";
import Payments from "./pages/Payments";
import Villages from "./pages/Villages";

export default function App() {
  const { identity, login, clear, isInitializing } = useInternetIdentity();
  const { actor, isFetching } = useActor();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [_isReady, setIsReady] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);

  const setupUser = useCallback(async () => {
    if (!actor) return;
    setIsSettingUp(true);
    try {
      // Try to get role; if not registered, register automatically
      await actor.getCallerUserRole();
    } catch {
      try {
        // Register with empty token (regular user) - UI always shows admin panel
        await (actor as any)._initializeAccessControlWithSecret("");
      } catch {
        // ignore
      }
    }
    setIsReady(true);
    setIsSettingUp(false);
  }, [actor]);

  useEffect(() => {
    if (actor && identity) {
      setupUser();
    } else if (!identity) {
      setIsReady(false);
    }
  }, [actor, identity, setupUser]);

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "villages", label: "Villages" },
    { id: "customers", label: "Customers" },
    { id: "loans", label: "Loans" },
    { id: "payments", label: "Payments" },
    { id: "calendar", label: "Calendar" },
    { id: "ledger", label: "Ledger" },
  ];

  if (isInitializing || (identity && (isFetching || isSettingUp))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="text-4xl mb-4">🏦</div>
          <div className="text-xl font-semibold text-indigo-700">
            Village Finance
          </div>
          <div className="flex items-center justify-center gap-2 text-gray-500 mt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <span className="text-xl font-bold">Village Finance</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              Admin
            </span>
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
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
        {(activeTab === "dashboard" || !activeTab) && (
          <Dashboard onNavigate={setActiveTab} />
        )}
        {activeTab === "villages" && <Villages />}
        {activeTab === "customers" && <Customers />}
        {activeTab === "loans" && <Loans />}
        {activeTab === "payments" && <Payments />}
        {activeTab === "calendar" && <Calendar />}
        {activeTab === "ledger" && <Ledger />}
      </main>
    </div>
  );
}
