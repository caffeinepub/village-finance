/* eslint-disable */
// @ts-nocheck
import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface BalanceTransaction {
  'id' : bigint,
  'date' : bigint,
  'type' : { 'adjustment' : null } | { 'collection' : null } | { 'disbursal' : null },
  'referenceId' : string,
  'description' : string,
  'amount' : bigint,
}
export interface Customer {
  'id' : bigint,
  'userId' : Principal,
  'name' : string,
  'createdAt' : Time,
  'villageId' : bigint,
  'address' : string,
  'phone' : string,
  'aadharNo' : string,
}
export interface DashboardStats {
  'totalOutstanding' : bigint,
  'principalOutstanding' : bigint,
  'balanceInHand' : bigint,
}
export interface Loan {
  'id' : bigint,
  'emi' : bigint,
  'status' : { 'closed' : null } | { 'active' : null },
  'principal' : bigint,
  'processingFee' : bigint,
  'loanId' : string,
  'totalInterest' : bigint,
  'tenureMonths' : bigint,
  'villageId' : bigint,
  'interestRate' : bigint,
  'totalAmount' : bigint,
  'customerId' : bigint,
  'disbursedAt' : bigint,
}
export interface Payment {
  'id' : bigint,
  'penalty' : bigint,
  'loanId' : string,
  'totalOutstanding' : bigint,
  'amountPaid' : bigint,
  'notes' : string,
  'paymentDate' : bigint,
  'customerId' : bigint,
  'receiptNo' : string,
  'outstandingPrincipal' : bigint,
}
export type Time = bigint;
export interface UserProfile { 'name' : string }
export type UserRole = { 'admin' : null } | { 'user' : null } | { 'guest' : null };
export interface Village {
  'id' : bigint,
  'name' : string,
  'createdAt' : Time,
  'shortCode' : string,
}
export interface _SERVICE {
  '_initializeAccessControlWithSecret' : ActorMethod<[string], undefined>,
  'addAgent' : ActorMethod<[string], undefined>,
  'assignCallerUserRole' : ActorMethod<[Principal, UserRole], undefined>,
  'balanceAdjustment' : ActorMethod<[bigint, string, boolean], undefined>,
  'createCustomer' : ActorMethod<[string, string, string, string, bigint, Principal], Customer>,
  'createVillage' : ActorMethod<[string, string], Village>,
  'deleteCustomer' : ActorMethod<[bigint], undefined>,
  'deleteVillage' : ActorMethod<[bigint], undefined>,
  'disburseLoan' : ActorMethod<[bigint, bigint, bigint, bigint, bigint, bigint], Loan>,
  'getAllAgents' : ActorMethod<[], Array<string>>,
  'getAllCustomers' : ActorMethod<[], Array<Customer>>,
  'getAllLoans' : ActorMethod<[], Array<Loan>>,
  'deleteLoan' : ActorMethod<[string], undefined>;
  'forecloseLoan' : ActorMethod<[string, bigint], undefined>;
  'getAllPayments' : ActorMethod<[], Array<Payment>>,
  'getAllTransactions' : ActorMethod<[], Array<BalanceTransaction>>,
  'getAllVillages' : ActorMethod<[], Array<Village>>,
  'getCallerUserProfile' : ActorMethod<[], [] | [UserProfile]>,
  'getCallerUserRole' : ActorMethod<[], UserRole>,
  'getCustomer' : ActorMethod<[bigint], Customer>,
  'getDashboardStats' : ActorMethod<[], DashboardStats>,
  'getLoansByCustomer' : ActorMethod<[bigint], Array<Loan>>,
  'getPaymentsByLoan' : ActorMethod<[string], Array<Payment>>,
  'getUserProfile' : ActorMethod<[Principal], [] | [UserProfile]>,
  'getVillage' : ActorMethod<[bigint], Village>,
  'isCallerAdmin' : ActorMethod<[], boolean>,
  'isPhoneAnAgent' : ActorMethod<[string], boolean>,
  'topupLoan' : ActorMethod<[string, bigint, bigint, bigint, bigint], Loan>,
  'recordPayment' : ActorMethod<[string, bigint, bigint, bigint, string], Payment>,
  'removeAgent' : ActorMethod<[string], undefined>,
  'saveCallerUserProfile' : ActorMethod<[UserProfile], undefined>,
  'updateCustomer' : ActorMethod<[bigint, string, string, string, string, bigint], Customer>,
  'updateVillage' : ActorMethod<[bigint, string, string], Village>,
}
export declare const idlService: IDL.ServiceClass;
