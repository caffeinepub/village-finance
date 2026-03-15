# Village Finance

## Current State
- Admin-only app with tabs: Dashboard, Villages, Customers, Loans, Ledger
- Authorization mixin already present; `UserRole` enum exists (admin/user/guest)
- No login/register UI -- admin panel opens directly
- No staff or customer panels
- Backend has full loan, payment, customer, village, balance management

## Requested Changes (Diff)

### Add
- **Login page**: shown every time app is opened; user must log in before seeing anything
- **Register page**: first screen for new users; choose role (Admin / Staff / Customer)
- **Staff (Agent) role**: can access dashboard (cash in hand + collection calendar), add village, add customer, add loan disbursal
- **Customer role**: registers with mobile number + loan account number; if they match existing data, they see their loan details + repayment history
- **Agent management**: admin has a menu to add/remove agent phone numbers; agents enter their number to get staff-level access
- **Admin credentials**: unchanged (same login flow, full access)

### Modify
- Backend: add `registerAgent(phone)`, `getAgents()`, `removeAgent(phone)`, `verifyCustomerAccess(phone, loanId)` functions
- Backend: add `getCustomerByPhone(phone)` and `getLoansByPhone(phone)` for customer self-service portal
- Frontend: wrap entire app in auth gate; role-based routing after login

### Remove
- Nothing removed from admin panel

## Implementation Plan
1. Add backend functions for agent management and customer self-verification
2. Update backend.d.ts with new function signatures
3. Build frontend: Login + Register screens (shown on app open)
4. Role-based routing: Admin → full panel, Staff → limited panel, Customer → loan self-service view
5. Admin panel: add "Agents" menu to manage agent phone numbers
6. Staff panel: Dashboard (cash in hand + calendar), Add Village, Add Customer, Add Loan Disbursal
7. Customer panel: loan account details + repayment history (read-only)
