import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import List "mo:core/List";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Types
  public type Village = {
    id : Nat;
    name : Text;
    shortCode : Text;
    createdAt : Time.Time;
  };

  public type Customer = {
    id : Nat;
    name : Text;
    phone : Text;
    address : Text;
    villageId : Nat;
    userId : Principal;
    createdAt : Time.Time;
  };

  public type Loan = {
    id : Nat;
    loanId : Text;
    customerId : Nat;
    villageId : Nat;
    principal : Nat;
    interestRate : Nat;
    tenureMonths : Nat;
    processingFee : Nat;
    emi : Nat;
    totalInterest : Nat;
    totalAmount : Nat;
    disbursedAt : Int;
    status : {
      #active;
      #closed;
    };
  };

  public type Payment = {
    id : Nat;
    loanId : Text;
    customerId : Nat;
    amountPaid : Nat;
    penalty : Nat;
    paymentDate : Int;
    outstandingPrincipal : Nat;
    totalOutstanding : Nat;
    receiptNo : Text;
    notes : Text;
  };

  public type BalanceTransaction = {
    id : Nat;
    type_ : {
      #disbursal;
      #collection;
      #adjustment;
    };
    amount : Nat;
    description : Text;
    date : Int;
    referenceId : Text;
  };

  public type UserProfile = {
    name : Text;
  };

  public type DashboardStats = {
    balanceInHand : Nat;
    principalOutstanding : Nat;
    totalOutstanding : Nat;
  };

  // State
  let villages = Map.empty<Nat, Village>();
  let customers = Map.empty<Nat, Customer>();
  let loans = Map.empty<Nat, Loan>();
  let payments = Map.empty<Nat, Payment>();
  let transactions = Map.empty<Nat, BalanceTransaction>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  // ID Counters
  var villageIdCounter = 1;
  var customerIdCounter = 1;
  var loanIdCounter = 1;
  var paymentIdCounter = 1;
  var transactionIdCounter = 1;
  var balanceInHand : Nat = 0;

  // Authorization
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  module Village {
    public func compare(a : Village, b : Village) : Order.Order {
      Nat.compare(a.id, b.id);
    };
  };

  module Customer {
    public func compare(a : Customer, b : Customer) : Order.Order {
      Nat.compare(a.id, b.id);
    };
  };

  // Helper function to find customer by userId
  private func findCustomerByUserId(userId : Principal) : ?Customer {
    for ((id, customer) in customers.entries()) {
      if (Principal.equal(customer.userId, userId)) {
        return ?customer;
      };
    };
    null;
  };

  // User Profile Functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (not Principal.equal(caller, user) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Village CRUD
  public shared ({ caller }) func createVillage(name : Text, shortCode : Text) : async Village {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can create villages");
    };
    let village : Village = {
      id = villageIdCounter;
      name;
      shortCode;
      createdAt = Time.now();
    };
    villages.add(villageIdCounter, village);
    villageIdCounter += 1;
    village;
  };

  public query ({ caller }) func getVillage(id : Nat) : async Village {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view villages");
    };
    switch (villages.get(id)) {
      case (null) { Runtime.trap("Village not found") };
      case (?village) { village };
    };
  };

  public shared ({ caller }) func updateVillage(id : Nat, name : Text, shortCode : Text) : async Village {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can update villages");
    };
    let existing = switch (villages.get(id)) {
      case (null) { Runtime.trap("Village not found") };
      case (?village) { village };
    };

    let updatedVillage : Village = {
      id = existing.id;
      name;
      shortCode;
      createdAt = existing.createdAt;
    };
    villages.add(id, updatedVillage);
    updatedVillage;
  };

  public shared ({ caller }) func deleteVillage(id : Nat) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can delete villages");
    };
    if (not villages.containsKey(id)) {
      Runtime.trap("Village not found");
    };
    villages.remove(id);
  };

  public query ({ caller }) func getAllVillages() : async [Village] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view villages");
    };
    villages.values().toArray().sort();
  };

  // Customer CRUD
  public shared ({ caller }) func createCustomer(name : Text, phone : Text, address : Text, villageId : Nat, userId : Principal) : async Customer {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can create customers");
    };
    let customer : Customer = {
      id = customerIdCounter;
      name;
      phone;
      address;
      villageId;
      userId;
      createdAt = Time.now();
    };
    customers.add(customerIdCounter, customer);
    customerIdCounter += 1;
    customer;
  };

  public query ({ caller }) func getCustomer(id : Nat) : async Customer {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view customers");
    };
    
    let customer = switch (customers.get(id)) {
      case (null) { Runtime.trap("Customer not found") };
      case (?c) { c };
    };

    // Customers can only view their own data
    if (not AccessControl.isAdmin(accessControlState, caller) and not Principal.equal(caller, customer.userId)) {
      Runtime.trap("Unauthorized: Customers can only view their own profile");
    };

    customer;
  };

  public shared ({ caller }) func updateCustomer(id : Nat, name : Text, phone : Text, address : Text, villageId : Nat) : async Customer {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can update customers");
    };
    let existing = switch (customers.get(id)) {
      case (null) { Runtime.trap("Customer not found") };
      case (?customer) { customer };
    };
    let updatedCustomer : Customer = {
      id = existing.id;
      name;
      phone;
      address;
      villageId;
      userId = existing.userId;
      createdAt = existing.createdAt;
    };
    customers.add(id, updatedCustomer);
    updatedCustomer;
  };

  public shared ({ caller }) func deleteCustomer(id : Nat) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can delete customers");
    };
    if (not customers.containsKey(id)) {
      Runtime.trap("Customer not found");
    };
    customers.remove(id);
  };

  public query ({ caller }) func getAllCustomers() : async [Customer] {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can view all customers");
    };
    customers.values().toArray().sort();
  };

  // Loan Management
  public shared ({ caller }) func disburseLoan(
    customerId : Nat,
    villageId : Nat,
    principal : Nat,
    interestRate : Nat,
    tenureMonths : Nat,
    processingFee : Nat
  ) : async Loan {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can disburse loans");
    };

    let totalInterest = (principal * interestRate) / 100;
    let totalAmount = principal + totalInterest + processingFee;
    let emi = totalAmount / tenureMonths;

    let loan : Loan = {
      id = loanIdCounter;
      loanId = "LOAN" # loanIdCounter.toText();
      customerId;
      villageId;
      principal;
      interestRate;
      tenureMonths;
      processingFee;
      emi;
      totalInterest;
      totalAmount;
      disbursedAt = Time.now();
      status = #active;
    };

    loans.add(loanIdCounter, loan);
    loanIdCounter += 1;

    // Record balance transaction
    let transaction : BalanceTransaction = {
      id = transactionIdCounter;
      type_ = #disbursal;
      amount = principal;
      description = "Loan disbursement: " # loan.loanId;
      date = Time.now();
      referenceId = loan.loanId;
    };
    transactions.add(transactionIdCounter, transaction);
    transactionIdCounter += 1;

    if (balanceInHand >= principal) {
      balanceInHand -= principal;
    };

    loan;
  };

  public query ({ caller }) func getLoansByCustomer(customerId : Nat) : async [Loan] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view loans");
    };

    let customer = switch (customers.get(customerId)) {
      case (null) { Runtime.trap("Customer not found") };
      case (?c) { c };
    };

    // Customers can only view their own loans
    if (not AccessControl.isAdmin(accessControlState, caller) and not Principal.equal(caller, customer.userId)) {
      Runtime.trap("Unauthorized: Customers can only view their own loans");
    };

    let customerLoans = loans.values().toArray().filter(
      func(loan : Loan) : Bool { loan.customerId == customerId }
    );
    customerLoans;
  };

  public shared ({ caller }) func recordPayment(
    loanId : Text,
    customerId : Nat,
    amountPaid : Nat,
    penalty : Nat,
    notes : Text
  ) : async Payment {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can record payments");
    };

    let payment : Payment = {
      id = paymentIdCounter;
      loanId;
      customerId;
      amountPaid;
      penalty;
      paymentDate = Time.now();
      outstandingPrincipal = 0;
      totalOutstanding = 0;
      receiptNo = "RCP" # paymentIdCounter.toText();
      notes;
    };

    payments.add(paymentIdCounter, payment);
    paymentIdCounter += 1;

    // Record balance transaction
    let transaction : BalanceTransaction = {
      id = transactionIdCounter;
      type_ = #collection;
      amount = amountPaid + penalty;
      description = "Payment for loan: " # loanId;
      date = Time.now();
      referenceId = payment.receiptNo;
    };
    transactions.add(transactionIdCounter, transaction);
    transactionIdCounter += 1;

    balanceInHand += (amountPaid + penalty);

    payment;
  };

  public shared ({ caller }) func balanceAdjustment(amount : Nat, description : Text, isAddition : Bool) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can adjust balance");
    };

    let transaction : BalanceTransaction = {
      id = transactionIdCounter;
      type_ = #adjustment;
      amount;
      description;
      date = Time.now();
      referenceId = "ADJ" # transactionIdCounter.toText();
    };
    transactions.add(transactionIdCounter, transaction);
    transactionIdCounter += 1;

    if (isAddition) {
      balanceInHand += amount;
    } else {
      if (balanceInHand >= amount) {
        balanceInHand -= amount;
      };
    };
  };

  public query ({ caller }) func getDashboardStats() : async DashboardStats {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can view dashboard stats");
    };

    var principalOutstanding : Nat = 0;
    var totalOutstanding : Nat = 0;

    for ((id, loan) in loans.entries()) {
      if (loan.status == #active) {
        principalOutstanding += loan.principal;
        totalOutstanding += loan.totalAmount;
      };
    };

    {
      balanceInHand;
      principalOutstanding;
      totalOutstanding;
    };
  };

  public query ({ caller }) func getAllTransactions() : async [BalanceTransaction] {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can view transactions");
    };
    transactions.values().toArray();
  };

  public query ({ caller }) func getPaymentsByLoan(loanId : Text) : async [Payment] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view payments");
    };

    let loanPayments = payments.values().toArray().filter(
      func(payment : Payment) : Bool { payment.loanId == loanId }
    );

    // For customers, verify they own the loan
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      if (loanPayments.size() > 0) {
        let customerId = loanPayments[0].customerId;
        let customer = switch (customers.get(customerId)) {
          case (null) { Runtime.trap("Customer not found") };
          case (?c) { c };
        };
        if (not Principal.equal(caller, customer.userId)) {
          Runtime.trap("Unauthorized: Customers can only view their own payments");
        };
      };
    };

    loanPayments;
  };

  public query ({ caller }) func getAllLoans() : async [Loan] {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can view all loans");
    };
    loans.values().toArray();
  };
};
