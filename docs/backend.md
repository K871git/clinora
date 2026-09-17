# Clinora — Backend Architecture

> Stack: **PHP 8.3 · Laravel 13 · SQLite · Laravel Sanctum · FPDF/FPDI · Smalot PDF Parser**

---

## Directory Structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── API/
│   │   │       ├── AuthController.php            — login / logout / me
│   │   │       ├── ProfileController.php         — user profile CRUD + avatar
│   │   │       ├── PatientController.php         — patient CRUD + search
│   │   │       ├── VisitController.php           — visit create / detail / update
│   │   │       ├── PrescriptionController.php    — prescription lifecycle
│   │   │       ├── PrescriptionPdfController.php — PDF generation engine
│   │   │       ├── PharmacyController.php        — pharmacy workflow
│   │   │       ├── DashboardController.php       — stats / revenue / activity
│   │   │       └── ClinicSettingsController.php  — settings + template management
│   │   ├── Middleware/
│   │   │   ├── EnsureRole.php                   — role-based gate (doctor / pharmacy)
│   │   │   └── EnsureActive.php                 — blocks inactive users
│   │   ├── Requests/
│   │   │   ├── Auth/LoginRequest.php
│   │   │   ├── Patient/StorePatientRequest.php
│   │   │   ├── Patient/UpdatePatientRequest.php
│   │   │   ├── Visit/StoreVisitRequest.php
│   │   │   ├── Visit/UpdateVisitRequest.php
│   │   │   ├── Prescription/StorePrescriptionRequest.php
│   │   │   ├── Prescription/UpdatePrescriptionRequest.php
│   │   │   └── Settings/UpdateClinicRequest.php
│   │   │       UpdatePrescriptionSettingsRequest.php
│   │   └── Resources/
│   │       ├── PatientResource.php
│   │       ├── VisitResource.php
│   │       ├── PrescriptionResource.php
│   │       ├── PrescriptionItemResource.php
│   │       └── ClinicSettingsResource.php
│   ├── Models/
│   │   ├── Clinic.php
│   │   ├── User.php
│   │   ├── Patient.php
│   │   ├── Visit.php
│   │   ├── Prescription.php
│   │   ├── PrescriptionItem.php
│   │   └── ClinicSetting.php
│   ├── Policies/
│   │   ├── PatientPolicy.php
│   │   ├── VisitPolicy.php
│   │   └── PrescriptionPolicy.php
│   ├── Providers/
│   │   └── AppServiceProvider.php
│   └── Services/
│       ├── Auth/
│       │   └── AuthService.php
│       ├── Patient/
│       │   └── PatientService.php
│       ├── Visit/
│       │   └── VisitService.php
│       ├── Prescription/
│       │   ├── PrescriptionService.php
│       │   └── TemplateLayoutScanner.php
│       └── Settings/
│           └── ClinicSettingsService.php
├── database/
│   ├── migrations/                              — 13 migration files (chronological)
│   ├── seeders/
│   └── database.sqlite                         — SQLite dev database
├── routes/
│   └── api.php                                 — all API route definitions
├── storage/
│   └── app/public/
│       └── prescription_templates/{clinicId}/  — uploaded PDF/image templates
├── public/
│   └── prescriptiondoc/                        — legacy template directory
├── tests/
│   ├── Feature/                                — 168 feature tests
│   └── Unit/
├── composer.json
└── .env.example
```

---

## Database Schema

### Tables and Columns

#### `clinics`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | auto-increment |
| name | varchar(150) | required |
| doctor_name | varchar(150) | required |
| qualification | varchar(150) | nullable |
| address | text | nullable |
| contact | varchar(30) | nullable |
| logo_path | varchar(255) | nullable |
| created_at / updated_at | timestamps | |

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| clinic_id | FK → clinics | restrict on delete |
| name | varchar(150) | |
| email | varchar(150) | unique |
| password | varchar(255) | bcrypt hashed |
| role | enum | `doctor` or `pharmacy` |
| is_active | tinyint | default 1 |
| avatar | varchar | nullable (added 2026-09-04) |
| remember_token | varchar | |

#### `patients`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| clinic_id | FK → clinics | |
| name | varchar(150) | indexed |
| mobile | varchar(20) | indexed, unique per clinic |
| date_of_birth | date | nullable |
| age | integer | nullable |
| gender | varchar(10) | nullable |
| address | text | nullable |

#### `visits`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| clinic_id | FK → clinics | |
| patient_id | FK → patients | |
| doctor_id | FK → users | |
| visited_at | datetime | indexed |
| consultation_notes | text | nullable |
| consultation_fee | decimal(8,2) | nullable (added 2026-09-03) |

#### `prescriptions`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| clinic_id | FK → clinics | |
| patient_id | FK → patients | |
| visit_id | FK → visits | |
| doctor_id | FK → users | |
| prescribed_at | datetime | |
| doctor_notes | text | nullable |
| status | varchar(50) | indexed; see lifecycle below |
| sent_to_pharmacy_at | datetime | nullable |
| dispensed_at | datetime | nullable (added 2026-09-04) |
| completed_at | datetime | nullable |
| completed_by | FK → users | nullable; nullOnDelete |

#### `prescription_items`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| prescription_id | FK → prescriptions | cascade delete |
| medicine_name | varchar | required |
| dosage | varchar | nullable |
| frequency | varchar | nullable |
| duration | varchar | nullable |
| instructions | text | nullable |
| sort_order | integer | for ordered list display |

#### `clinic_settings`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| clinic_id | FK → clinics | |
| prescription_header | text | nullable |
| prescription_footer | text | nullable |
| show_doctor_contact | boolean | default true |
| show_clinic_contact | boolean | default true |
| prescription_template | varchar | filename of active template |

#### `personal_access_tokens` (Sanctum)
Standard Sanctum table — stores hashed token, abilities, last_used_at, expires_at.

---

## Prescription Status Lifecycle

```
draft
  │  (doctor sends to pharmacy)
  ▼
sent_to_pharmacy
  │  (pharmacist starts dispensing)
  ▼
dispensing
  │  (pharmacist marks complete)
  ▼
completed
```

- Only `draft` prescriptions can be **edited**, **deleted**, or **sent**.
- Pharmacy can only **view** `sent_to_pharmacy` and `dispensing` prescriptions.
- All status transitions use `DB::table()->where('status', ...)` conditional updates — prevents race conditions without explicit locking.

---

## Eloquent Models

### `User` (`app/Models/User.php`)
- Uses `HasFactory`, `Notifiable`, `HasApiTokens` (Sanctum).
- Casts: `password` → hashed, `is_active` → boolean.
- `isDoctor()` / `isPharmacy()` — convenience role checks.
- Relation: `belongsTo(Clinic::class)`.

### `Clinic` (`app/Models/Clinic.php`)
- Holds clinic profile (name, doctor_name, qualification, address, contact).
- Relation: `hasMany(User::class)`, `hasOne(ClinicSetting::class, 'settings')`.

### `Patient` (`app/Models/Patient.php`)
- Casts: `date_of_birth` → `date:Y-m-d`, `age` → integer.
- Belongs to one clinic (data isolation enforced at policy level).
- Relation: `hasMany(Visit::class)`.

### `Visit` (`app/Models/Visit.php`)
- Casts: `visited_at` → datetime, `consultation_fee` → `decimal:2`.
- Belongs to clinic, patient, doctor.
- Relation: `hasMany(Prescription::class)`.

### `Prescription` (`app/Models/Prescription.php`)
- Casts: all timestamp fields → datetime.
- Four timestamp fields track status transitions: `sent_to_pharmacy_at`, `dispensed_at`, `completed_at`.
- `completed_by` FK → users (nullOnDelete, tracks which pharmacist completed it).
- Relation: `hasMany(PrescriptionItem::class)` ordered by `sort_order`.

### `PrescriptionItem` (`app/Models/PrescriptionItem.php`)
- Belongs to one prescription.
- Fields: `medicine_name`, `dosage`, `frequency`, `duration`, `instructions`, `sort_order`.

### `ClinicSetting` (`app/Models/ClinicSetting.php`)
- One-to-one with clinic.
- Stores prescription layout preferences and active template filename.

---

## Service Layer

The service layer separates business logic from controllers. Controllers validate input, delegate to services, and return responses.

### `AuthService` (`app/Services/Auth/AuthService.php`)
```
attemptLogin(email, password) → ?string (plaintext token)
  1. Find user by email
  2. Hash::check password
  3. If user.is_active is false → return null
  4. Delete all existing tokens (single-session enforcement)
  5. Create new Sanctum token → return plainTextToken

logout(User) → void
  Deletes all tokens for the user (single-session: always just one)
```

### `PrescriptionService` (`app/Services/Prescription/PrescriptionService.php`)
```
createPrescription(clinicId, doctorId, Visit, data) → Prescription
  DB transaction:
    1. Create Prescription record (status = 'draft')
    2. syncItems() — delete + recreate all medicine items

updatePrescription(Prescription, data) → Prescription
  DB transaction:
    1. Update prescribed_at and doctor_notes
    2. syncItems() if 'items' key present in data

getClinicPrescriptions(clinicId, filters) → Paginator
  Filters: status, q (search by patient name/mobile), per_page (max 1000)

sendToPharmacy(Prescription) → bool
  Conditional update: status=draft → sent_to_pharmacy
  Sets sent_to_pharmacy_at = now()
  Returns false if already changed (race-condition safe)

startDispensing(Prescription) → bool
  Conditional update: status=sent_to_pharmacy → dispensing
  Sets dispensed_at = now()

completePrescription(Prescription, userId) → bool
  Conditional update: status IN [sent_to_pharmacy, dispensing] → completed
  Sets completed_at, completed_by

deletePrescription(Prescription) → void
  DB transaction: delete items → delete prescription

syncItems(Prescription, items[]) → void (private)
  Delete existing items then insert all new ones (full replace, no merge)
```

### `ClinicSettingsService` (`app/Services/Settings/ClinicSettingsService.php`)
```
getClinicWithSettings(clinicId) → Clinic (with settings)
updateClinicInfo(Clinic, data) → Clinic
updatePrescriptionSettings(Clinic, data) → Clinic
  Creates or updates ClinicSetting via firstOrCreate + update
```

### `PatientService` (`app/Services/Patient/PatientService.php`)
```
listPatients(clinicId, filters) → Paginator
  Filters: q (name/mobile search), gender, is_new (first visit today)
  Ordering: newest registered first
createPatient(clinicId, data) → Patient
  Mobile uniqueness enforced per clinic (throws 409 on duplicate)
updatePatient(Patient, data) → Patient
getPatient(id) → Patient
```

### `TemplateLayoutScanner` (`app/Services/Prescription/TemplateLayoutScanner.php`)

Reads a PDF template using Smalot PDF Parser and detects text element positions to know where to overlay patient name, date, and medicines.

```
scan(pdfPath) → array layout
  1. Parse PDF with Smalot Parser
  2. Get page[0].getDataTm() — array of [transform_matrix, text]
  3. Convert PDF points to mm: x_mm = tm[4] * (25.4/72)
                               y_mm = (841.89 - tm[5]) * (25.4/72)
  4. Find first element containing "name" → nameLabelX, nameBaseY
  5. Find first element containing "date" → dateLabelX, dateBaseY
  6. Find first element matching "rx/Rx/ℝ" → rxBaseY (meds start below this)
  7. Find topmost element with y > 220mm → footerY (notes anchor above it)
  8. Compute layout coordinates with offsets for FPDF Cell placement
  9. Returns defaults() if parsing fails

layout keys returned:
  name_x, name_y, name_w           — patient name field position
  date_day_x, date_mon_x,          — three date slot X positions
  date_year_x, date_y              — date row Y position
  meds_x, meds_start_y, meds_w    — medicines block start
  notes_anchor_y, notes_max_y     — notes bottom anchor
```

---

## Controllers

### `AuthController`
| Method | Endpoint | Description |
|---|---|---|
| `login` | POST `/auth/login` | Validates credentials via `AuthService`, returns `{token}` |
| `logout` | POST `/auth/logout` | Revokes all tokens for the authenticated user |
| `me` | GET `/auth/me` | Returns `{user}` with clinic relation loaded |

The login route has `throttle:20,1` — max 20 attempts per minute per IP.

### `PatientController`
| Method | Endpoint | Description |
|---|---|---|
| `index` | GET `/patients` | Paginated list; filters: `q`, `gender`, `is_new`, `per_page`, `sort`, `direction` |
| `store` | POST `/patients` | Create patient; returns 409 on duplicate mobile within clinic |
| `show` | GET `/patients/{id}` | Single patient detail (policy: same clinic) |
| `update` | PUT `/patients/{id}` | Update patient fields |

### `VisitController`
| Method | Endpoint | Description |
|---|---|---|
| `store` | POST `/patients/{patient}/visits` | Create visit for patient (auto-assigns clinic_id, doctor_id) |
| `patientHistory` | GET `/patients/{patient}/visits` | Paginated visit history for a patient |
| `show` | GET `/visits/{visit}` | Visit detail (policy: same clinic) |
| `update` | PUT `/visits/{visit}` | Update visited_at, notes, fee |

### `PrescriptionController`
| Method | Endpoint | Description |
|---|---|---|
| `index` | GET `/prescriptions` | Clinic-wide prescription list; filters: `status`, `q`, `per_page` |
| `store` | POST `/visits/{visit}/prescriptions` | Create draft prescription with items |
| `show` | GET `/prescriptions/{id}` | Prescription detail with items, patient, doctor, visit |
| `update` | PUT `/prescriptions/{id}` | Edit draft only (422 if not draft) |
| `send` | POST `/prescriptions/{id}/send` | Draft → sent_to_pharmacy |
| `destroy` | DELETE `/prescriptions/{id}` | Delete draft only |
| `patientHistory` | GET `/patients/{patient}/prescriptions` | Paginated Rx history for patient |

### `PrescriptionPdfController`
| Method | Endpoint | Description |
|---|---|---|
| `generate` | GET `/prescriptions/{id}/pdf` | Generates and streams PDF inline |

**PDF Generation Flow:**
```
1. Authorize: user must be from same clinic
2. Load prescription with patient + items
3. Fetch ClinicSetting for active template filename
4. resolveTemplatePath() — validates file exists and is .pdf
5. TemplateLayoutScanner.scan(templateFile) → layout coordinates
6. buildPdf():
   a. Create FPDI instance (A4, portrait, mm)
   b. AddPage() → setSourceFile() → importPage(1) → useTemplate()
   c. writePatientInfo() — name + day/month/year in three slots
   d. writeMedicines() — numbered list with bold name, dosage meta, italic instructions
   e. Estimate notes height: ceil(len/65) lines + newline count
   f. Try to anchor notes above footer (notes_anchor_y - height)
   g. If overflow → AddPage() → useTemplate(page2 if exists) → writeNotesPage2()
7. Output('S') → stream as application/pdf inline
```

Text encoding: UTF-8 → windows-1252 via `iconv` (FPDF default encoding).

### `DashboardController`
| Method | Endpoint | Description |
|---|---|---|
| `stats` | GET `/dashboard/stats` | today_visits, yesterday_visits, total_visits, total_patients, pending_rx, draft_rx, completed_today, today_revenue, monthly_revenue, week_activity[7] |
| `revenue` | GET `/dashboard/revenue` | today/this_week/this_month/all_time breakdowns (revenue, paid_visits, total_visits, avg_fee) |
| `todayPatients` | GET `/dashboard/today-patients` | Last 8 visits today with patient name + mobile |
| `pendingRx` | GET `/dashboard/pending-rx` | Last 8 prescriptions with status=sent_to_pharmacy |

`week_activity` returns 7 items (Mon–Sun relative to today), each with `label`, `count`, `is_today`.

### `ClinicSettingsController`
| Method | Endpoint | Description |
|---|---|---|
| `show` | GET `/settings` | Returns clinic + settings (shared route: doctor + pharmacy) |
| `updateClinic` | PUT `/settings/clinic` | Update clinic name, doctor name, qualification, contact, address |
| `updatePrescriptionSettings` | PUT `/settings/prescriptions` | Update header, footer, show_doctor_contact, show_clinic_contact |
| `listTemplates` | GET `/prescription-templates` | Scans storage and legacy public/prescriptiondoc, returns file list with is_active flag |
| `uploadTemplate` | POST `/prescription-templates` | Validates PDF/image ≤10MB, sanitizes filename, stores to `prescription_templates/{clinicId}/` |
| `deleteTemplate` | DELETE `/prescription-templates/{filename}` | Path-traversal check, deletes file, clears active if deleted template was active |

### `PharmacyController`
| Method | Endpoint | Description |
|---|---|---|
| `index` | GET `/pharmacy/prescriptions` | Active queue: statuses `sent_to_pharmacy` + `dispensing` |
| `history` | GET `/pharmacy/prescriptions/history` | Completed prescriptions (status=completed), ordered by completed_at desc |
| `show` | GET `/pharmacy/prescriptions/{id}` | Single prescription detail |
| `startDispensing` | POST `/pharmacy/prescriptions/{id}/start-dispensing` | sent_to_pharmacy → dispensing |
| `complete` | POST `/pharmacy/prescriptions/{id}/complete` | sent_to_pharmacy or dispensing → completed |

---

## Middleware

### `EnsureRole` (`app/Http/Middleware/EnsureRole.php`)
```php
handle(Request, Closure, string $role): Response
  if user->role !== $role → return 403 JSON
```
Registered as `role` alias in `AppServiceProvider`. Used as `middleware('role:doctor')` and `middleware('role:pharmacy')`.

### `EnsureActive` (`app/Http/Middleware/EnsureActive.php`)
Checks `user->is_active`. Returns 403 if false. Registered as `active` alias. Applied to all authenticated routes.

---

## Authorization Policies

All policies enforce **clinic-level data isolation** — users can only access data belonging to their own clinic.

### `PatientPolicy`
```
view(User, Patient)   → user.clinic_id === patient.clinic_id
update(User, Patient) → user.clinic_id === patient.clinic_id
```

### `VisitPolicy`
```
view(User, Visit)   → user.clinic_id === visit.clinic_id
update(User, Visit) → user.clinic_id === visit.clinic_id
```

### `PrescriptionPolicy`
```
view(User, Prescription)     → user.clinic_id === prescription.clinic_id
update(User, Prescription)   → user.clinic_id === prescription.clinic_id
send(User, Prescription)     → user.clinic_id === prescription.clinic_id
complete(User, Prescription) → user.clinic_id === prescription.clinic_id
delete(User, Prescription)   → user.clinic_id === prescription.clinic_id
```

All policies use integer cast for comparison: `(int) $user->clinic_id === (int) $prescription->clinic_id`.

---

## API Routes (`routes/api.php`)

```
── AUTH (no middleware) ─────────────────────────────────────────────────────
POST   /auth/login          throttle:20,1
POST   /auth/logout         auth:sanctum
GET    /auth/me             auth:sanctum

── SHARED (auth:sanctum + active) ───────────────────────────────────────────
GET    /settings            ClinicSettingsController@show
GET    /profile             ProfileController@show
PUT    /profile             ProfileController@update
PUT    /profile/password    ProfileController@updatePassword
POST   /profile/avatar      ProfileController@uploadAvatar
DELETE /profile/avatar      ProfileController@removeAvatar

── DOCTOR (auth:sanctum + active + role:doctor) ─────────────────────────────
GET    /dashboard/stats
GET    /dashboard/today-patients
GET    /dashboard/pending-rx
GET    /dashboard/revenue

GET    /patients
POST   /patients
GET    /patients/{patient}
PUT    /patients/{patient}
GET    /patients/{patient}/visits
POST   /patients/{patient}/visits
GET    /patients/{patient}/prescriptions

GET    /visits/{visit}
PUT    /visits/{visit}
POST   /visits/{visit}/prescriptions

GET    /prescriptions
GET    /prescriptions/{prescription}
PUT    /prescriptions/{prescription}
DELETE /prescriptions/{prescription}
POST   /prescriptions/{prescription}/send
GET    /prescriptions/{prescription}/pdf

PUT    /settings/clinic
PUT    /settings/prescriptions
GET    /prescription-templates
POST   /prescription-templates
DELETE /prescription-templates/{filename}

── PHARMACY (auth:sanctum + active + role:pharmacy) ─────────────────────────
GET    /pharmacy/prescriptions
GET    /pharmacy/prescriptions/history
GET    /pharmacy/prescriptions/{prescription}
POST   /pharmacy/prescriptions/{prescription}/start-dispensing
POST   /pharmacy/prescriptions/{prescription}/complete
```

---

## API Resources (Response Transformers)

### `PrescriptionResource`
```json
{
  "id": 1,
  "prescribed_at": "2026-09-04T10:00:00.000000Z",
  "doctor_notes": "Take after meals",
  "status": "draft",
  "sent_to_pharmacy_at": null,
  "dispensed_at": null,
  "completed_at": null,
  "completed_by": null,
  "patient": { "id", "name", "mobile", "age", "gender", "date_of_birth" },
  "visit":   { "id", "visited_at" },
  "doctor":  { "id", "name" },
  "items": [
    { "id", "medicine_name", "dosage", "frequency", "duration", "instructions", "sort_order" }
  ],
  "created_at": "2026-09-04T10:00:00.000000Z"
}
```

Nested relations use `whenLoaded()` — only present when explicitly eager-loaded.

### `PatientResource`
Returns: id, name, mobile, date_of_birth, age, gender, address, clinic_id, created_at.

### `VisitResource`
Returns: id, patient_id, doctor_id, visited_at, consultation_notes, consultation_fee, created_at; nested patient (id, name).

### `ClinicSettingsResource`
Returns: clinic fields (id, name, doctor_name, qualification, address, contact) + settings fields (prescription_header, prescription_footer, show_doctor_contact, show_clinic_contact, prescription_template).

---

## Authentication Flow (End-to-End)

```
Client → POST /auth/login {email, password}
  ↓ LoginRequest validates (email required, password required)
  ↓ AuthService.attemptLogin()
    → User::where('email')->first()
    → Hash::check(password, user.password)
    → if is_active=false → return null → 401
    → user.tokens()->delete()  (revoke previous session)
    → user.createToken('clinora-auth')->plainTextToken
  ← {token: "1|abc..."}

Client stores token in localStorage.
All subsequent requests include: Authorization: Bearer {token}

Sanctum verifies token → resolves User → $request->user()
EnsureActive middleware checks user.is_active
EnsureRole middleware checks user.role === expected role

Client → POST /auth/logout
  → AuthService.logout(user) → user.tokens()->delete()
  ← {message: "Logged out successfully"}
```

---

## Request Validation (Form Requests)

### `LoginRequest`
```
email:    required|string|email
password: required|string
```

### `StorePatientRequest`
```
name:          required|string|max:150
mobile:        required|string|max:20
date_of_birth: nullable|date
age:           nullable|integer|min:0|max:150
gender:        nullable|in:male,female,other
address:       nullable|string
```

### `StorePrescriptionRequest`
```
prescribed_at:       required|date
doctor_notes:        nullable|string
items:               required|array|min:1
items.*.medicine_name: required|string|max:255
items.*.dosage:      nullable|string
items.*.frequency:   nullable|string
items.*.duration:    nullable|string
items.*.instructions:nullable|string
items.*.sort_order:  nullable|integer
```

---

## Key Architectural Decisions

1. **Single-session tokens** — `attemptLogin()` deletes all existing tokens before issuing a new one. One user = one active session at a time.

2. **Clinic-level isolation** — Every model has `clinic_id`. Policies enforce ownership checks on every resource access. No cross-clinic data leakage is possible.

3. **Race-condition-safe status transitions** — All `status` updates use `DB::table()->where('id', X)->where('status', currentStatus)->update(...)` and check the affected row count. Returns false if status already changed (concurrent update scenario).

4. **Service layer** — Controllers are thin: validate → delegate to service → return resource. Business logic lives only in services.

5. **PDF overlay approach** — The prescription PDF is generated by placing text on top of a clinic-uploaded template (not generating layout from scratch). `TemplateLayoutScanner` auto-detects the template's text field positions via PDF parsing, eliminating the need for manual coordinate configuration.

6. **Template storage** — New templates stored in `storage/app/public/prescription_templates/{clinicId}/`. Legacy templates in `public/prescriptiondoc/` are also served for backwards compatibility. Path-traversal attack is prevented in `deleteTemplate`.

7. **Atomic prescription creation** — `createPrescription()` and `deletePrescription()` are wrapped in `DB::transaction()` to keep prescription header and items consistent.

---

## Dependencies (`composer.json`)

| Package | Version | Purpose |
|---|---|---|
| laravel/framework | ^13.17 | Core framework |
| laravel/sanctum | ^4.3 | API token authentication |
| setasign/fpdf | ^1.9 | PDF generation from scratch |
| setasign/fpdi | ^2.6 | Overlay text on existing PDF templates |
| smalot/pdfparser | ^2.12 | Parse PDF to detect text element positions |
| phpunit/phpunit | ^12.5 | Testing (dev) |

---

## Test Coverage

Tests live in `tests/Feature/` — 168 feature tests covering:
- Auth (login, logout, me, inactive user, wrong credentials)
- Patient CRUD, duplicate detection, search/filter
- Visit creation, history, update
- Prescription lifecycle (create, edit, send, delete, PDF)
- Pharmacy workflow (pending, start-dispensing, complete)
- Dashboard stats and revenue
- Settings and template management
- Policy enforcement (cross-clinic access attempts)


