import { Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import AgentsTab from "./pages/AgentsTab";
import CustomerPortal from "./pages/CustomerPortal";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import Ledger from "./pages/Ledger";
import Loans from "./pages/Loans";
import LoginPage from "./pages/LoginPage";
import StaffPanel from "./pages/StaffPanel";
import Villages from "./pages/Villages";

class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; tabId: string },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode; tabId: string }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error) {
    console.error("Tab error:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-20" data-ocid="tab.error_state">
          <div className="text-red-500 text-lg font-semibold mb-2">
            Something went wrong loading this tab.
          </div>
          <div className="text-gray-500 text-sm mb-4">{this.state.error}</div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: "" })}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdminPanel() {
  const { logout } = useAuth();
  const { actor, isFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isReady, setIsReady] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);

  const setupUser = useCallback(async () => {
    if (!actor) return;
    setIsSettingUp(true);
    try {
      await actor.getCallerUserRole();
    } catch {
      try {
        await actor._initializeAccessControlWithSecret("init");
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
    { id: "ledger", label: "Ledger" },
    { id: "agents", label: "Agents" },
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

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="text-4xl mb-4">🏦</div>
          <div className="text-xl font-semibold text-indigo-700">
            Village Finance
          </div>
          <div className="flex items-center justify-center gap-2 text-gray-500 mt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Setting up your account...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            onClick={logout}
          >
            Logout
          </Button>
        </div>
      </header>

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

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "dashboard" && (
          <TabErrorBoundary key="dashboard" tabId="dashboard">
            <Dashboard onNavigate={setActiveTab} />
          </TabErrorBoundary>
        )}
        {activeTab === "villages" && (
          <TabErrorBoundary key="villages" tabId="villages">
            <Villages />
          </TabErrorBoundary>
        )}
        {activeTab === "customers" && (
          <TabErrorBoundary key="customers" tabId="customers">
            <Customers />
          </TabErrorBoundary>
        )}
        {activeTab === "loans" && (
          <TabErrorBoundary key="loans" tabId="loans">
            <Loans />
          </TabErrorBoundary>
        )}
        {activeTab === "ledger" && (
          <TabErrorBoundary key="ledger" tabId="ledger">
            <Ledger />
          </TabErrorBoundary>
        )}
        {activeTab === "agents" && (
          <TabErrorBoundary key="agents" tabId="agents">
            <AgentsTab />
          </TabErrorBoundary>
        )}
      </main>
    </div>
  );
}

function AppContent() {
  const { role, isCheckingRole } = useAuth();
  const { isInitializing } = useInternetIdentity();

  if (isInitializing || isCheckingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
        <div className="text-center">
          <div className="text-5xl mb-4">🏦</div>
          <div className="text-xl font-semibold text-white mb-2">
            Village Finance
          </div>
          <div className="flex items-center justify-center gap-2 text-indigo-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (role === "admin") return <AdminPanel />;
  if (role === "staff") return <StaffPanel />;
  if (role === "customer") return <CustomerPortal />;
  return <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
