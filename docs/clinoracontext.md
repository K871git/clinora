# CLINORA — PROJECT CONTEXT & DEVELOPMENT INSTRUCTIONS

## 1. PROJECT

You are working on **Clinora**, a small, reliable, offline-first EMR and prescription management system for a local doctor.

The first customer is a small doctor serving nearby villages.

Clinora is **NOT a hospital ERP** and should not become one.

The core workflow is:

```text
Patient
   ↓
Search / Register
   ↓
Patient Dashboard
   ↓
Visit
   ↓
Prescription
   ↓
Print
   ↓
Send to Pharmacy
   ↓
Pharmacy Views
   ↓
Complete
   ↓
Patient History
```

The product must feel:

* Simple
* Fast
* Professional
* Trustworthy
* Practical
* Human-centered
* Easy for a doctor to use every day

Do not add unnecessary features.

---

# 2. PROJECT STRUCTURE

The project is divided into:

```text
clinora/
│
├── backend/       # Laravel + MySQL
├── frontend/      # React + JavaScript
├── automation/    # Windows startup, deployment and operational scripts
├── docs/          # Architecture and documentation
└── README.md
```

The development is also divided into separate conversations:

```text
1. Primary Chat
   → Overall architecture, scope, decisions and integration

2. Backend Chat
   → Laravel + MySQL + APIs + backend logic

3. Frontend Chat
   → React + JavaScript + UI + frontend API integration

4. Automation / Network Chat
   → Windows deployment + startup + LAN/network configuration
```

Respect these boundaries.

Do not implement frontend code while working on backend tasks unless explicitly requested.

Do not implement backend code while working on frontend tasks unless explicitly requested.

---

# 3. TECHNOLOGY STACK

## Frontend

```text
React
JavaScript
Vite
React Router where required
```

## Backend

```text
Laravel
PHP
MySQL
REST API
```

## Automation

```text
Windows scripts
Windows services/startup configuration
LAN configuration
Backup scripts
Deployment scripts
```

Do NOT introduce:

```text
Python
Ollama
AI services
Microservices
Node backend
Vue
Livewire
Inertia
Alpine
```

unless explicitly requested.

---

# 4. OFFLINE-FIRST ARCHITECTURE

Clinora must work without internet access during normal operation.

The doctor PC is the primary/server PC.

The pharmacy PC connects through the same LAN.

Architecture:

```text
                    LOCAL LAN
                       │
        ┌──────────────┴──────────────┐
        │                             │
   Doctor PC                    Pharmacy PC
        │                             │
   React + Laravel                Browser
        │                             │
        └──────────────┬──────────────┘
                       │
                    Laravel
                       │
                     MySQL
```

The pharmacy PC must **never connect directly to MySQL**.

Correct:

```text
Browser → Laravel API → MySQL
```

Incorrect:

```text
Browser → MySQL
```

Internet must not be required for:

* Login
* Patient management
* Visits
* Prescriptions
* Printing
* Pharmacy workflow
* Patient history

---

# 5. CORE FEATURES

## Authentication

* Login
* Logout
* Authentication
* Doctor role
* Pharmacy role
* Protected API routes
* Role-based authorization

## Patients

* Register patient
* Search patients quickly
* Name required
* Mobile/phone required
* Duplicate detection
* Inform user when likely duplicate exists
* Open existing patient
* Patient dashboard
* Patient history

## Visits

* Create visit
* Date/time
* Consultation information
* Notes where required
* Link visit with prescription
* Visit history

## Prescriptions

Prescription is a core feature.

A prescription contains:

* Clinic information
* Doctor information
* Patient information
* Date/time
* Multiple medicines
* Medicine name
* Dosage
* Frequency
* Duration
* Instructions
* Doctor notes

Actions:

* Add medicine
* Edit medicine
* Remove medicine
* Save prescription
* Print prescription
* Send to pharmacy
* View prescription history
* Reopen previous prescription

Prescription statuses:

```text
DRAFT
   ↓
SENT_TO_PHARMACY
   ↓
COMPLETED
```

Optional:

```text
CANCELLED
```

## Pharmacy

The pharmacy uses another PC on the same LAN.

The pharmacy has:

* No separate database
* No separate backend

Workflow:

```text
Login
  ↓
Pharmacy Dashboard
  ↓
Pending Prescriptions
  ↓
Open Prescription
  ↓
View
  ↓
Complete
```

Completed prescriptions remain in patient history.

## Clinic Settings

Clinic information must NOT be hardcoded.

Support:

* Clinic name
* Doctor name
* Qualification/title
* Address
* Contact
* Logo
* Prescription header/footer
* Basic branding/settings

The application should be configurable for different clinics later.

---

# 6. BACKEND ARCHITECTURE

Use a simple structure:

```text
Controller
    ↓
Service
    ↓
Database
```

Controllers should remain thin.

Controllers should primarily:

1. Receive request
2. Validate request
3. Call service
4. Return API response

Business logic belongs in services.

Do not put large business logic inside controllers.

---

# 7. BACKEND STRUCTURE

Use:

```text
backend/
│
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── API/
│   │   ├── Requests/
│   │   │   ├── Auth/
│   │   │   ├── Patient/
│   │   │   ├── Visit/
│   │   │   ├── Prescription/
│   │   │   ├── Pharmacy/
│   │   │   └── Clinic/
│   │   └── Resources/
│   │
│   ├── Services/
│   │   ├── Patient/
│   │   ├── Visit/
│   │   ├── Prescription/
│   │   ├── Pharmacy/
│   │   └── Clinic/
│   │
│   ├── Policies/
│   └── Exceptions/
│
├── database/
│   ├── migrations/
│   ├── seeders/
│   └── factories/
│
├── routes/
│   └── api.php
│
├── tests/
│   ├── Feature/
│   └── Unit/
│
└── ...
```

Only create additional files/folders when they are genuinely needed.

Do not create abstractions just to make the project look enterprise-like.

---

# 8. DATABASE

MySQL is the database.

Maintain proper:

* Foreign keys
* Indexes
* Unique constraints where appropriate
* NOT NULL constraints
* Data types
* Referential integrity

Important domain entities include:

```text
users
clinic_settings
patients
visits
prescriptions
prescription_medicines
```

Additional tables may be introduced when genuinely required.

Do not duplicate data unnecessarily.

---

# 9. PRESCRIPTION INTEGRITY

Prescription operations are important.

When an operation involves multiple related database changes, use database transactions.

For example:

```text
Create Visit
    +
Create Prescription
    +
Create Medicines
```

must succeed together.

If something fails:

```text
ROLLBACK
```

Never leave partially-created clinical data.

Status changes must follow valid business transitions.

Do not allow arbitrary status manipulation from the frontend.

---

# 10. API DESIGN

Use clean REST-style APIs.

Keep endpoint naming predictable.

Example:

```text
/api/auth/login
/api/auth/logout
/api/auth/me

/api/patients
/api/patients/{patient}

/api/patients/{patient}/visits
/api/patients/{patient}/prescriptions

/api/visits/{visit}

/api/prescriptions/{prescription}
/api/prescriptions/{prescription}/send-to-pharmacy
/api/prescriptions/{prescription}/complete

/api/pharmacy/prescriptions/pending

/api/clinic-settings
```

The exact API should be designed consistently before implementation.

API responses should have predictable structures.

---

# 11. VALIDATION

Validate all user input on the backend.

Never trust frontend validation alone.

Use Laravel Form Requests where appropriate.

Validation and business logic are different:

```text
Request
→ Input validation

Service
→ Business rules
```

For example:

```text
"mobile is required"
```

is validation.

```text
"this patient appears to already exist"
```

is business logic.

---

# 12. AUTHORIZATION

Never rely on frontend UI for security.

The backend must verify:

```text
Is the user authenticated?
Is the user authorized?
Is the user allowed to access this resource?
```

Doctor and pharmacy permissions must be enforced server-side.

---

# 13. ERROR HANDLING

Errors must be:

* Predictable
* Useful
* Safe
* Consistent

Do not expose:

* Database credentials
* Stack traces in production
* Internal implementation details
* Sensitive information

Use appropriate HTTP status codes.

---

# 14. SECURITY

Treat clinical data as sensitive.

Follow secure development practices:

* Authentication
* Authorization
* Validation
* Safe database queries
* CSRF/session protection where applicable
* Secure password handling
* Mass-assignment protection
* Proper error handling
* No exposed database
* No exposed secrets
* No hardcoded credentials

Never trust data coming from the frontend.

---

# 15. FRONTEND PRINCIPLES

The frontend must optimize for the doctor.

Prioritize:

```text
Minimum clicks
Minimum typing
Fast search
Fast prescription creation
Clear actions
Readable information
Easy printing
Minimal navigation
Reliable behavior
```

Avoid:

* Flashy animations
* Unnecessary dashboards
* Excessive modals
* Complicated navigation
* Long forms
* Unnecessary UI components

The interface should feel calm and professional.

---

# 16. PRINTING

For MVP, use:

```text
Browser printing
+
Dedicated print CSS
```

Do not introduce PDF-generation infrastructure unless explicitly required.

Printed prescriptions should be:

* Clean
* Readable
* Professional
* Patient-friendly

---

# 17. CODE QUALITY

This is extremely important.

Write code that another developer can understand quickly.

### Code must be:

* Simple
* Readable
* Maintainable
* Debuggable
* Predictable
* Production-ready
* Deployment-friendly

Prefer straightforward code over clever code.

Avoid:

```text
Clever one-liners
Deep nesting
Huge functions
Huge components
Duplicate logic
Unnecessary abstractions
Unnecessary design patterns
Premature optimization
Over-engineering
```

Use meaningful names.

Prefer explicit readable code.

A junior developer should be able to read the code and understand what it does.

---

# 18. DEPLOYMENT

The final product runs on Windows PCs.

The doctor should NOT need to manually execute development commands every morning.

Do not design the production system around:

```text
npm run dev
php artisan serve
```

Those are development tools.

Production should use:

```text
React production build
Laravel production configuration
MySQL Windows service
Windows startup/service automation
```

Target behavior:

```text
PC starts
    ↓
Required services start
    ↓
Clinora becomes available
    ↓
Doctor opens browser
    ↓
Works without internet
```

Deployment decisions must remain practical for a small local clinic.

---

# 19. BACKUP

Data safety is critical.

The system must eventually have a simple local backup strategy.

Backups should be:

* Automated where practical
* Easy to understand
* Stored safely
* Restorable

Never claim the system is production-ready without considering database recovery.

---

# 20. TESTING

Test the actual business workflow, not only individual functions.

Critical workflow:

```text
Register/Search Patient
        ↓
Create Visit
        ↓
Create Prescription
        ↓
Add Multiple Medicines
        ↓
Save
        ↓
Print
        ↓
Send to Pharmacy
        ↓
Pharmacy Views
        ↓
Complete
        ↓
Patient History
```

Before considering MVP complete, this entire workflow must work reliably.

---

# 21. DEVELOPMENT RULES

Before writing code:

1. Understand the requirement.
2. Confirm it belongs to Clinora.
3. Check the existing architecture.
4. Reuse existing code where appropriate.
5. Choose the simplest correct implementation.
6. Consider offline/LAN behavior.
7. Consider data integrity.
8. Consider deployment.
9. Implement only what is required.
10. Test the result.

Do not silently add features.

If a requirement conflicts with the existing architecture, stop and explain the conflict before changing the architecture.

---

# 22. SCOPE BOUNDARY

Do NOT add unless explicitly requested:

```text
Billing
GST
Accounting
Payroll
Advanced inventory
Purchasing
Suppliers
Online payments
SMS
WhatsApp
Cloud sync
Mobile applications
AI diagnosis
AI prescription generation
Hospital ERP functionality
Microservices
Unnecessary WebSockets
Unnecessary third-party services
```

Clinora is intentionally small.

**Do not turn it into a hospital ERP.**

---

# 23. WORKING STYLE

Act as a:

* Principal Software Engineer
* Software Architect
* Code Reviewer
* Debugging Partner
* Technical Mentor

When implementing something:

* Keep the solution simple.
* Explain important architectural decisions briefly.
* Do not over-explain obvious code.
* Do not generate unnecessary files.
* Do not modify unrelated code.
* Preserve existing working functionality.
* Fix the root cause instead of hiding symptoms.
* Prefer maintainability over cleverness.
* Keep deployment in mind from the beginning.

---

# 24. MOST IMPORTANT PRINCIPLE

Always prioritize:

```text
Correctness
    ↓
Simplicity
    ↓
Maintainability
    ↓
Security
    ↓
UX
    ↓
Performance
```

Do not sacrifice correctness or data integrity for speed of development.

Clinora should be a **small, dependable piece of software that a real doctor can trust every day.**
