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
}
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
    createCustomer(name: string, phone: string, address: string, villageId: bigint, userId: Principal): Promise<Customer>;
    createVillage(name: string, shortCode: string): Promise<Village>;
    deleteCustomer(id: bigint): Promise<void>;
    deleteVillage(id: bigint): Promise<void>;
    disburseLoan(customerId: bigint, villageId: bigint, principal: bigint, interestRate: bigint, tenureMonths: bigint, processingFee: bigint): Promise<Loan>;
    getAllCustomers(): Promise<Array<Customer>>;
    getAllLoans(): Promise<Array<Loan>>;
    getAllTransactions(): Promise<Array<BalanceTransaction>>;
    getAllVillages(): Promise<Array<Village>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCustomer(id: bigint): Promise<Customer>;
    getDashboardStats(): Promise<DashboardStats>;
    getLoansByCustomer(customerId: bigint): Promise<Array<Loan>>;
    getPaymentsByLoan(loanId: string): Promise<Array<Payment>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getVillage(id: bigint): Promise<Village>;
    isCallerAdmin(): Promise<boolean>;
    recordPayment(loanId: string, customerId: bigint, amountPaid: bigint, penalty: bigint, notes: string): Promise<Payment>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateCustomer(id: bigint, name: string, phone: string, address: string, villageId: bigint): Promise<Customer>;
    updateVillage(id: bigint, name: string, shortCode: string): Promise<Village>;
}
