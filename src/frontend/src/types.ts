import type { Customer, Loan, Payment, backendInterface } from "./backend";
export type CustomerFull = Customer;

// Extended backend interface with new agent management + customer self-service methods
export interface ExtendedBackend extends backendInterface {
  addAgent(phone: string): Promise<void>;
  removeAgent(phone: string): Promise<void>;
  getAllAgents(): Promise<string[]>;
  isPhoneAnAgent(phone: string): Promise<boolean>;
  getCustomerByPhone(phone: string): Promise<Customer | null>;
  getLoansByPhone(phone: string): Promise<Loan[]>;
  getPaymentsByPhone(phone: string): Promise<Payment[]>;
  verifyCustomerLoanAccess(phone: string, loanId: string): Promise<boolean>;
}
