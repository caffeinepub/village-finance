import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAuth } from "../context/AuthContext";
import Customers from "./Customers";
import Dashboard from "./Dashboard";
import Loans from "./Loans";
import Villages from "./Villages";

const DEFAULT_AGENT_PIN = "533286";

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
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-20" data-ocid="tab.error_state">
          <div className="text-red-500 text-lg font-semibold mb-2">
            Something went wrong.
          </div>
          <div className="text-gray-500 text-sm mb-4">{this.state.error}</div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: "" })}
            className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ChangePinSettings() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  const handleChangePin = () => {
    setError("");
    const storedPin = localStorage.getItem("agent_pin") || DEFAULT_AGENT_PIN;

    if (currentPin !== storedPin) {
      setError("Current PIN is incorrect.");
      return;
    }
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setError("New PIN must be exactly 6 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PIN and Confirm PIN do not match.");
      return;
    }

    localStorage.setItem("agent_pin", newPin);
    toast.success("PIN changed successfully");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-teal-700">🔒 Change Login PIN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-pin" className="text-sm text-gray-700">
              Current PIN
            </Label>
            <Input
              id="current-pin"
              data-ocid="settings.current_pin.input"
              type="password"
              maxLength={6}
              value={currentPin}
              onChange={(e) => {
                setCurrentPin(e.target.value);
                setError("");
              }}
              placeholder="Enter current 6-digit PIN"
            />
          </div>
          <div>
            <Label htmlFor="new-pin" className="text-sm text-gray-700">
              New PIN
            </Label>
            <Input
              id="new-pin"
              data-ocid="settings.new_pin.input"
              type="password"
              maxLength={6}
              value={newPin}
              onChange={(e) => {
                setNewPin(e.target.value);
                setError("");
              }}
              placeholder="Enter new 6-digit PIN"
            />
          </div>
          <div>
            <Label htmlFor="confirm-pin" className="text-sm text-gray-700">
              Confirm New PIN
            </Label>
            <Input
              id="confirm-pin"
              data-ocid="settings.confirm_pin.input"
              type="password"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value);
                setError("");
              }}
              placeholder="Re-enter new 6-digit PIN"
            />
          </div>
          {error && (
            <p
              data-ocid="settings.pin.error_state"
              className="text-red-500 text-sm"
            >
              {error}
            </p>
          )}
          <Button
            data-ocid="settings.change_pin.primary_button"
            onClick={handleChangePin}
            disabled={!currentPin || !newPin || !confirmPin}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white"
          >
            Change PIN
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function StaffPanel() {
  const { staffPhone, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "villages", label: "Villages" },
    { id: "customers", label: "Customers" },
    { id: "loans", label: "Loan Disbursal" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {" "}
            <span className="text-xl font-bold">Village Finance</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
              Staff
            </span>
          </div>
          <div className="flex items-center gap-3">
            {staffPhone && (
              <span className="text-xs text-teal-100 hidden sm:block">
                📱 {staffPhone}
              </span>
            )}
            <Button
              data-ocid="nav.logout_button"
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
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
                  className="data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:border-b-2 data-[state=active]:border-teal-600"
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
        {activeTab === "settings" && (
          <TabErrorBoundary key="settings" tabId="settings">
            <ChangePinSettings />
          </TabErrorBoundary>
        )}
      </main>
    </div>
  );
}
