import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  public type Village = {
    id : Nat;
    name : Text;
    shortCode : Text;
    createdAt : Time.Time;
  };

  // Stable storage type -- kept unchanged for upgrade compatibility
  public type Customer = {
    id : Nat;
    name : Text;
    phone : Text;
    address : Text;
    villageId : Nat;
    userId : Principal;
    createdAt : Time.Time;
  };

  // Extended type returned by all customer APIs -- includes aadharNo
  public type CustomerFull = {
    id : Nat;
    name : Text;
    phone : Text;
    address : Text;
    aadharNo : Text;
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
    status : { #active; #closed };
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
    type_ : { #disbursal; #collection; #adjustment };
    amount : Nat;
    description : Text;
    date : Int;
    referenceId : Text;
  };

  public type UserProfile = { name : Text };

  public type DashboardStats = {
    balanceInHand : Nat;
    principalOutstanding : Nat;
    totalOutstanding : Nat;
  };

  let villages = Map.empty<Nat, Village>();
  let customers = Map.empty<Nat, Customer>();
  // Separate map for Aadhar numbers -- avoids breaking the stable Customer type
  let customerAadharMap = Map.empty<Nat, Text>();
  let loans = Map.empty<Nat, Loan>();
  let payments = Map.empty<Nat, Payment>();
  let transactions = Map.empty<Nat, BalanceTransaction>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  var villageIdCounter = 1;
  var customerIdCounter = 1;
  var loanIdCounter = 1;
  var paymentIdCounter = 1;
  var transactionIdCounter = 1;
  var balanceInHand : Nat = 0;

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  func pad2(n : Nat) : Text {
    if (n < 10) { "0" # n.toText() } else { n.toText() };
  };

  func safeSub(a : Nat, b : Nat) : Nat {
    if (a >= b) a - b else 0;
  };

  // Round up to next multiple of 1000 paise (next Rs.10)
  func roundUpToTen(paise : Nat) : Nat {
    ((paise + 999) / 1000) * 1000;
  };

  func toFull(c : Customer) : CustomerFull {
    let aadharNo = switch (customerAadharMap.get(c.id)) {
      case (?a) { a };
      case (null) { "" };
    };
    { id = c.id; name = c.name; phone = c.phone; address = c.address; aadharNo; villageId = c.villageId; userId = c.userId; createdAt = c.createdAt };
  };

  // Returns true if the phone is already used by another customer (excludes excludeId)
  func phoneExists(phone : Text, excludeId : ?Nat) : Bool {
    var found = false;
    for ((_, c) in customers.entries()) {
      if (c.phone == phone) {
        let skip = switch (excludeId) {
          case (?eid) { c.id == eid };
          case (null) { false };
        };
        if (not skip) { found := true };
      };
    };
    found;
  };

  func makeLoanId(shortCode : Text, counter : Nat) : Text {
    let nowNs = Time.now();
    let nowSec = Int.abs(nowNs) / 1_000_000_000;
    let daysSinceEpoch = nowSec / 86400;
    let y400 = 146097;
    let y100 = 36524;
    let y4   = 1461;
    let y1   = 365;
    var n = daysSinceEpoch;
    var year = 0;
    let q400 = n / y400; year += q400 * 400; n := safeSub(n, q400 * y400);
    let q100 = Nat.min(n / y100, 3); year += q100 * 100; n := safeSub(n, q100 * y100);
    let q4 = n / y4; year += q4 * 4; n := safeSub(n, q4 * y4);
    let q1 = Nat.min(n / y1, 3); year += q1; n := safeSub(n, q1 * y1);
    let leapYear = (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0));
    let monthDays : [Nat] = if (leapYear)
      [31,29,31,30,31,30,31,31,30,31,30,31]
    else
      [31,28,31,30,31,30,31,31,30,31,30,31];
    var month = 1;
    var rem = n;
    for (md in monthDays.vals()) {
      if (rem >= md) { rem := safeSub(rem, md); month += 1 } else {};
    };
    let day = rem + 1;
    let yy = pad2(year % 100);
    let mm = pad2(month);
    let dd = pad2(day);
    let seq = pad2(counter % 100);
    shortCode # yy # mm # dd # seq;
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func createVillage(name : Text, shortCode : Text) : async Village {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    let village : Village = { id = villageIdCounter; name; shortCode; createdAt = Time.now() };
    villages.add(villageIdCounter, village);
    villageIdCounter += 1;
    village;
  };

  public query ({ caller }) func getAllVillages() : async [Village] {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    villages.values().toArray().sort(func(a, b) = Nat.compare(a.id, b.id));
  };

  public query ({ caller }) func getVillage(id : Nat) : async Village {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    switch (villages.get(id)) {
      case (null) { Runtime.trap("Village not found") };
      case (?v) { v };
    };
  };

  public shared ({ caller }) func updateVillage(id : Nat, name : Text, shortCode : Text) : async Village {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    let existing = switch (villages.get(id)) { case (null) { Runtime.trap("Village not found") }; case (?v) { v } };
    let updated : Village = { id = existing.id; name; shortCode; createdAt = existing.createdAt };
    villages.add(id, updated);
    updated;
  };

  public shared ({ caller }) func deleteVillage(id : Nat) : async () {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    if (not villages.containsKey(id)) { Runtime.trap("Village not found") };
    villages.remove(id);
  };

  public shared ({ caller }) func createCustomer(name : Text, phone : Text, address : Text, aadharNo : Text, villageId : Nat, userId : Principal) : async CustomerFull {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    if (phone != "" and phoneExists(phone, null)) {
      Runtime.trap("A customer with this mobile number already exists");
    };
    let id = customerIdCounter;
    let customer : Customer = { id; name; phone; address; villageId; userId; createdAt = Time.now() };
    customers.add(id, customer);
    if (aadharNo != "") { customerAadharMap.add(id, aadharNo) };
    customerIdCounter += 1;
    toFull(customer);
  };

  public query ({ caller }) func getAllCustomers() : async [CustomerFull] {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    customers.values().toArray().sort(func(a, b) = Nat.compare(a.id, b.id)).map(toFull);
  };

  public query ({ caller }) func getCustomer(id : Nat) : async CustomerFull {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    switch (customers.get(id)) {
      case (null) { Runtime.trap("Customer not found") };
      case (?c) { toFull(c) };
    };
  };

  public shared ({ caller }) func updateCustomer(id : Nat, name : Text, phone : Text, address : Text, aadharNo : Text, villageId : Nat) : async CustomerFull {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    let existing = switch (customers.get(id)) { case (null) { Runtime.trap("Customer not found") }; case (?c) { c } };
    if (phone != "" and phoneExists(phone, ?id)) {
      Runtime.trap("A customer with this mobile number already exists");
    };
    let updated : Customer = { id = existing.id; name; phone; address; villageId; userId = existing.userId; createdAt = existing.createdAt };
    customers.add(id, updated);
    customerAadharMap.add(id, aadharNo);
    toFull(updated);
  };

  public shared ({ caller }) func deleteCustomer(id : Nat) : async () {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    if (not customers.containsKey(id)) { Runtime.trap("Customer not found") };
    customers.remove(id);
    customerAadharMap.remove(id);
  };

  public shared ({ caller }) func disburseLoan(customerId : Nat, villageId : Nat, principal : Nat, interestRate : Nat, tenureMonths : Nat, processingFee : Nat) : async Loan {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    let totalInterest = (principal * interestRate * tenureMonths) / 10000;
    let emiBase = principal + totalInterest;
    let totalAmount = emiBase + processingFee;
    let emiRaw = if (tenureMonths > 0) emiBase / tenureMonths else emiBase;
    let emi = roundUpToTen(emiRaw);
    let shortCode = switch (villages.get(villageId)) {
      case (null) { "VIL" };
      case (?v) { v.shortCode };
    };
    let loanId = makeLoanId(shortCode, loanIdCounter);
    let loan : Loan = { id = loanIdCounter; loanId; customerId; villageId; principal; interestRate; tenureMonths; processingFee; emi; totalInterest; totalAmount; disbursedAt = Time.now(); status = #active };
    loans.add(loanIdCounter, loan);
    loanIdCounter += 1;
    let txn : BalanceTransaction = { id = transactionIdCounter; type_ = #disbursal; amount = principal; description = "Loan disbursement: " # loanId; date = Time.now(); referenceId = loanId };
    transactions.add(transactionIdCounter, txn);
    transactionIdCounter += 1;
    if (balanceInHand < principal) { Runtime.trap("Insufficient balance in hand to disburse this loan") };
    balanceInHand := safeSub(balanceInHand, principal);
    loan;
  };

  // Top-up: close existing loan, create new loan with outstanding principal + foreclosure (2%) + topup amount
  public shared ({ caller }) func topupLoan(existingLoanId : Text, topupAmount : Nat, newInterestRate : Nat, newTenure : Nat, newProcessingFee : Nat) : async Loan {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    // Find existing loan
    var foundLoan : ?Loan = null;
    for ((_, l) in loans.entries()) {
      if (l.loanId == existingLoanId) { foundLoan := ?l };
    };
    let oldLoan = switch (foundLoan) { case (null) { Runtime.trap("Loan not found") }; case (?l) { l } };
    if (oldLoan.status == #closed) { Runtime.trap("Loan is already closed") };
    // Calculate total paid so far
    var totalPaid : Nat = 0;
    for ((_, p) in payments.entries()) {
      if (p.loanId == existingLoanId) { totalPaid += p.amountPaid + p.penalty };
    };
    // Outstanding calculations
    let outstandingTotal = safeSub(oldLoan.totalAmount, totalPaid);
    let outstandingPrincipal = if (oldLoan.totalAmount > 0) (oldLoan.principal * outstandingTotal) / oldLoan.totalAmount else 0;
    // Foreclosure charges = 2% of outstanding principal
    let foreclosureCharges = (outstandingPrincipal * 200) / 10000;
    // New principal
    let newPrincipal = outstandingPrincipal + foreclosureCharges + topupAmount;
    // Close old loan
    let closedLoan : Loan = {
      id = oldLoan.id; loanId = oldLoan.loanId; customerId = oldLoan.customerId;
      villageId = oldLoan.villageId; principal = oldLoan.principal;
      interestRate = oldLoan.interestRate; tenureMonths = oldLoan.tenureMonths;
      processingFee = oldLoan.processingFee; emi = oldLoan.emi;
      totalInterest = oldLoan.totalInterest; totalAmount = oldLoan.totalAmount;
      disbursedAt = oldLoan.disbursedAt; status = #closed;
    };
    loans.add(oldLoan.id, closedLoan);
    // Create new loan
    let totalInterest = (newPrincipal * newInterestRate * newTenure) / 10000;
    let emiBase = newPrincipal + totalInterest;
    let emiRaw = if (newTenure > 0) emiBase / newTenure else emiBase;
    let emi = roundUpToTen(emiRaw);
    let shortCode = switch (villages.get(oldLoan.villageId)) {
      case (null) { "VIL" };
      case (?v) { v.shortCode };
    };
    let newLoanId = makeLoanId(shortCode, loanIdCounter);
    let newLoan : Loan = {
      id = loanIdCounter; loanId = newLoanId; customerId = oldLoan.customerId;
      villageId = oldLoan.villageId; principal = newPrincipal;
      interestRate = newInterestRate; tenureMonths = newTenure;
      processingFee = newProcessingFee; emi; totalInterest;
      totalAmount = emiBase + newProcessingFee; disbursedAt = Time.now(); status = #active;
    };
    loans.add(loanIdCounter, newLoan);
    loanIdCounter += 1;
    // Record transaction for topup disbursal
    let txn : BalanceTransaction = { id = transactionIdCounter; type_ = #disbursal; amount = topupAmount; description = "Top-up loan: " # newLoanId # " (closed: " # existingLoanId # ")"; date = Time.now(); referenceId = newLoanId };
    transactions.add(transactionIdCounter, txn);
    transactionIdCounter += 1;
    if (balanceInHand < topupAmount) { Runtime.trap("Insufficient balance in hand to disburse top-up amount") };
    balanceInHand := safeSub(balanceInHand, topupAmount);
    newLoan;
  };

  public query ({ caller }) func getAllLoans() : async [Loan] {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    loans.values().toArray();
  };

  public query ({ caller }) func getLoansByCustomer(customerId : Nat) : async [Loan] {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    loans.values().toArray().filter(func(l : Loan) : Bool { l.customerId == customerId });
  };

  public shared ({ caller }) func recordPayment(loanId : Text, customerId : Nat, amountPaid : Nat, penalty : Nat, notes : Text) : async Payment {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    var foundLoan : ?Loan = null;
    for ((_, l) in loans.entries()) {
      if (l.loanId == loanId) { foundLoan := ?l };
    };
    let loan = switch (foundLoan) { case (null) { Runtime.trap("Loan not found") }; case (?l) { l } };
    var totalPaidSoFar : Nat = 0;
    for ((_, p) in payments.entries()) {
      if (p.loanId == loanId) { totalPaidSoFar += p.amountPaid + p.penalty };
    };
    let totalPaidAfter = totalPaidSoFar + amountPaid + penalty;
    let outstandingTotal = safeSub(loan.totalAmount, totalPaidAfter);
    let outstandingPrincipal = if (loan.totalAmount > 0) (loan.principal * outstandingTotal) / loan.totalAmount else 0;
    let payment : Payment = {
      id = paymentIdCounter;
      loanId;
      customerId;
      amountPaid;
      penalty;
      paymentDate = Time.now();
      outstandingPrincipal;
      totalOutstanding = outstandingTotal;
      receiptNo = "RCP" # paymentIdCounter.toText();
      notes;
    };
    payments.add(paymentIdCounter, payment);
    paymentIdCounter += 1;
    let txn : BalanceTransaction = { id = transactionIdCounter; type_ = #collection; amount = amountPaid + penalty; description = "Payment for loan: " # loanId; date = Time.now(); referenceId = payment.receiptNo };
    transactions.add(transactionIdCounter, txn);
    transactionIdCounter += 1;
    balanceInHand += (amountPaid + penalty);
    payment;
  };

  public query ({ caller }) func getPaymentsByLoan(loanId : Text) : async [Payment] {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    payments.values().toArray().filter(func(p : Payment) : Bool { p.loanId == loanId });
  };

  public query ({ caller }) func getAllPayments() : async [Payment] {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    payments.values().toArray();
  };

  public shared ({ caller }) func balanceAdjustment(amount : Nat, description : Text, isAddition : Bool) : async () {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    let txn : BalanceTransaction = { id = transactionIdCounter; type_ = #adjustment; amount; description; date = Time.now(); referenceId = "ADJ" # transactionIdCounter.toText() };
    transactions.add(transactionIdCounter, txn);
    transactionIdCounter += 1;
    if (isAddition) { balanceInHand += amount } else { balanceInHand := safeSub(balanceInHand, amount) };
  };

  public query ({ caller }) func getDashboardStats() : async DashboardStats {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    var principalOutstanding : Nat = 0;
    var totalOutstanding : Nat = 0;
    for ((id, loan) in loans.entries()) {
      if (loan.status == #active) { principalOutstanding += loan.principal; totalOutstanding += loan.totalAmount };
    };
    { balanceInHand; principalOutstanding; totalOutstanding };
  };

  public query ({ caller }) func getAllTransactions() : async [BalanceTransaction] {
    if (caller.isAnonymous()) { Runtime.trap("Authentication required") };
    transactions.values().toArray();
  };
};
