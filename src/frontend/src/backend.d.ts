import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Time = bigint;
export interface Village {
    id: bigint;
    name: string;
    createdAt: Time;
    shortCode: string;
}
export interface Loan {
    id: bigint;
    emi: bigint;
    status: Variant_closed_active;
    principal: bigint;
    processingFee: bigint;
    loanId: string;
    totalInterest: bigint;
    tenureMonths: bigint;
    villageId: bigint;
    interestRate: bigint;
    totalAmount: bigint;
    customerId: bigint;
    disbursedAt: bigint;
}
export interface BalanceTransaction {
    id: bigint;
    date: bigint;
    type: Variant_adjustment_collection_disbursal;
    referenceId: string;
    description: string;
    amount: bigint;
}
export interface Payment {
    id: bigint;
    penalty: bigint;
    loanId: string;
    totalOutstanding: bigint;
    amountPaid: bigint;
    notes: string;
    paymentDate: bigint;
    customerId: bigint;
    receiptNo: string;
    outstandingPrincipal: bigint;
}
export interface DashboardStats {
    totalOutstanding: bigint;
    principalOutstanding: bigint;
    balanceInHand: bigint;
}
export interface UserProfile {
    name: string;
}
export interface Customer {
    id: bigint;
    userId: Principal;
    name: string;
    createdAt: Time;
    villageId: bigint;
    address: string;
    phone: string;
    aadharNo: string;
}
export type CustomerFull = Customer;
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_adjustment_collection_disbursal {
    adjustment = "adjustment",
    collection = "collection",
    disbursal = "disbursal"
}
export enum Variant_closed_active {
    closed = "closed",
    active = "active"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    balanceAdjustment(amount: bigint, description: string, isAddition: boolean): Promise<void>;
    createCustomer(name: string, phone: string, address: string, aadharNo: string, villageId: bigint, userId: Principal): Promise<CustomerFull>;
    createVillage(name: string, shortCode: string): Promise<Village>;
    deleteCustomer(id: bigint): Promise<void>;
    deleteVillage(id: bigint): Promise<void>;
    disburseLoan(customerId: bigint, villageId: bigint, principal: bigint, interestRate: bigint, tenureMonths: bigint, processingFee: bigint): Promise<Loan>;
    topupLoan(existingLoanId: string, topupAmount: bigint, newInterestRate: bigint, newTenure: bigint, newProcessingFee: bigint): Promise<Loan>;
    getAllCustomers(): Promise<Array<CustomerFull>>;
    getAllLoans(): Promise<Array<Loan>>;
    getAllPayments(): Promise<Array<Payment>>;
    getAllTransactions(): Promise<Array<BalanceTransaction>>;
    getAllVillages(): Promise<Array<Village>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCustomer(id: bigint): Promise<CustomerFull>;
    getDashboardStats(): Promise<DashboardStats>;
    getLoansByCustomer(customerId: bigint): Promise<Array<Loan>>;
    getPaymentsByLoan(loanId: string): Promise<Array<Payment>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getVillage(id: bigint): Promise<Village>;
    isCallerAdmin(): Promise<boolean>;
    recordPayment(loanId: string, customerId: bigint, amountPaid: bigint, penalty: bigint, notes: string): Promise<Payment>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateCustomer(id: bigint, name: string, phone: string, address: string, aadharNo: string, villageId: bigint): Promise<CustomerFull>;
    updateVillage(id: bigint, name: string, shortCode: string): Promise<Village>;
    _initializeAccessControlWithSecret(secret: string): Promise<void>;
    // Agent management
    addAgent(phone: string): Promise<void>;
    removeAgent(phone: string): Promise<void>;
    getAllAgents(): Promise<Array<string>>;
    isPhoneAnAgent(phone: string): Promise<boolean>;
    // Customer self-service
    getCustomerByPhone(phone: string): Promise<CustomerFull | null>;
    getLoansByPhone(phone: string): Promise<Array<Loan>>;
    getPaymentsByPhone(phone: string): Promise<Array<Payment>>;
    verifyCustomerLoanAccess(phone: string, loanId: string): Promise<boolean>;
}
