import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import type { ExtendedBackend } from "../types";
import { getSecretParameter } from "../utils/urlParams";

export interface CustomerSession {
  phone: string;
  loanId: string;
  customerName: string;
}

export type AuthRole = "admin" | "staff" | "customer" | null;

interface AuthContextValue {
  role: AuthRole;
  customerSession: CustomerSession | null;
  staffPhone: string | null;
  isCheckingRole: boolean;
  loginAsCustomer: (session: CustomerSession) => void;
  loginAsStaff: (phone: string) => void;
  loginAsAdmin: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { identity, clear, isInitializing } = useInternetIdentity();
  const { actor: rawActor, isFetching } = useActor();
  const actor = rawActor as ExtendedBackend | null;
  const [role, setRole] = useState<AuthRole>(null);
  const [customerSession, setCustomerSession] =
    useState<CustomerSession | null>(null);
  const [staffPhone, setStaffPhone] = useState<string | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [customerLoaded, setCustomerLoaded] = useState(false);

  // Load session from localStorage on mount
  useEffect(() => {
    // Check PIN-based admin session first
    const adminSession = localStorage.getItem("vf_admin_session");
    if (adminSession === "pin_authenticated") {
      setRole("admin");
      setIsCheckingRole(false);
      setCustomerLoaded(true);
      return;
    }

    const stored = localStorage.getItem("vf_customer_session");
    if (stored) {
      try {
        const session = JSON.parse(stored) as CustomerSession;
        setCustomerSession(session);
        setRole("customer");
        setIsCheckingRole(false);
      } catch {
        localStorage.removeItem("vf_customer_session");
      }
    }
    setCustomerLoaded(true);
  }, []);

  // Check Internet Identity-based roles
  useEffect(() => {
    if (!customerLoaded) return;
    if (customerSession) return;
    // Skip II check if already logged in via PIN
    if (role === "admin") return;
    if (isInitializing || isFetching) return;

    if (!identity || !actor) {
      setIsCheckingRole(false);
      return;
    }

    (async () => {
      setIsCheckingRole(true);
      try {
        const urlToken = getSecretParameter("caffeineAdminToken") || "";
        if (urlToken) {
          try {
            await actor._initializeAccessControlWithSecret(urlToken);
          } catch {
            // ignore
          }
        }

        let isAdmin = false;
        try {
          isAdmin = await actor.isCallerAdmin();
        } catch {
          try {
            await actor._initializeAccessControlWithSecret(urlToken || "");
            isAdmin = await actor.isCallerAdmin();
          } catch {
            isAdmin = false;
          }
        }

        if (isAdmin) {
          setRole("admin");
        } else {
          const storedPhone = localStorage.getItem("vf_staff_phone");
          if (storedPhone) {
            try {
              const isAgent = await actor.isPhoneAnAgent(storedPhone);
              if (isAgent) {
                setStaffPhone(storedPhone);
                setRole("staff");
              } else {
                localStorage.removeItem("vf_staff_phone");
                setRole(null);
              }
            } catch {
              setRole(null);
            }
          } else {
            setRole(null);
          }
        }
      } catch {
        setRole(null);
      } finally {
        setIsCheckingRole(false);
      }
    })();
  }, [
    identity,
    actor,
    isInitializing,
    isFetching,
    customerSession,
    customerLoaded,
    role,
  ]);

  const loginAsCustomer = useCallback((session: CustomerSession) => {
    localStorage.setItem("vf_customer_session", JSON.stringify(session));
    setCustomerSession(session);
    setRole("customer");
  }, []);

  const loginAsStaff = useCallback((phone: string) => {
    localStorage.setItem("vf_staff_phone", phone);
    setStaffPhone(phone);
    setRole("staff");
  }, []);

  const loginAsAdmin = useCallback(() => {
    localStorage.setItem("vf_admin_session", "pin_authenticated");
    setRole("admin");
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("vf_customer_session");
    localStorage.removeItem("vf_staff_phone");
    localStorage.removeItem("vf_admin_session");
    setCustomerSession(null);
    setStaffPhone(null);
    setRole(null);
    clear();
  }, [clear]);

  return (
    <AuthContext.Provider
      value={{
        role,
        customerSession,
        staffPhone,
        isCheckingRole,
        loginAsCustomer,
        loginAsStaff,
        loginAsAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
