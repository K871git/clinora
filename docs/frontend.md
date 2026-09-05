# Clinora — Frontend Architecture

> Stack: **React 19 · React Router v7 · Vite 8 · Bootstrap 5 · Axios · Sonner · Tailwind CSS**

---

## Directory Structure

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── main.jsx                          — React entry point
│   ├── App.jsx                           — Root component (BrowserRouter + AuthProvider + AppRoutes)
│   ├── index.css                         — Global design system (500+ lines)
│   ├── routes/
│   │   ├── index.jsx                     — Central route registry (AppRoutes)
│   │   └── ProtectedRoute.jsx            — Auth/role guard component
│   ├── contexts/
│   │   └── AuthContext.jsx               — Global auth state (user, token, login, logout)
│   ├── hooks/
│   │   └── useAuth.js                    — useContext(AuthContext) shorthand hook
│   ├── layouts/
│   │   └── AppLayout.jsx                 — Sidebar + top header + <Outlet />
│   ├── services/
│   │   ├── api.js                        — Axios instance (base URL, token interceptor, 401 handler)
│   │   ├── authService.js                — (if present; login/logout abstraction)
│   │   ├── patientService.js             — Patient API calls
│   │   ├── visitService.js               — Visit API calls
│   │   ├── prescriptionService.js        — Prescription + template API calls
│   │   ├── pharmacyService.js            — Pharmacy queue API calls
│   │   ├── dashboardService.js           — Dashboard stats/revenue API calls
│   │   └── settingsService.js            — Clinic settings API calls
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.jsx             — Login form with decorative animations
│   │   ├── dashboard/
│   │   │   ├── DashboardPage.jsx         — Main doctor dashboard
│   │   │   ├── PatientSearchBox.jsx      — Debounced live patient search widget
│   │   │   └── RevenueModal.jsx          — Revenue breakdown popup
│   │   ├── patients/
│   │   │   ├── PatientsPage.jsx          — DataTable with search/filter/export
│   │   │   ├── PatientDetailPage.jsx     — Patient profile + history
│   │   │   └── PatientFormModal.jsx      — Create/edit patient modal
│   │   ├── visits/
│   │   │   ├── NewVisitPage.jsx          — Create visit form
│   │   │   └── VisitDetailPage.jsx       — Visit detail with inline edit
│   │   ├── prescriptions/
│   │   │   ├── PrescriptionsPage.jsx     — Prescription table + templates tab
│   │   │   ├── NewPrescriptionPage.jsx   — Create prescription form
│   │   │   ├── PrescriptionDetailPage.jsx— View/edit/send/delete prescription
│   │   │   ├── PrintPrescriptionPage.jsx — Print-ready standalone page
│   │   │   ├── MedicineEditor.jsx        — Controlled medicine list editor
│   │   │   └── medicineUtils.js          — newMedicineItem() factory
│   │   ├── pharmacy/
│   │   │   ├── PharmacyPage.jsx          — Live queue (pending + dispensing)
│   │   │   ├── PharmacyPrescriptionPage.jsx — Detail with dispensing checkboxes
│   │   │   └── PharmacyHistoryPage.jsx   — Completed prescriptions history
│   │   ├── settings/
│   │   │   └── SettingsPage.jsx          — Clinic info + prescription settings form
│   │   └── profile/
│   │       └── ProfilePage.jsx           — User profile + avatar + password change
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Spinner.jsx               — SVG loading spinner
│   │   │   ├── Modal.jsx                 — Portal-based modal (Escape/backdrop close)
│   │   │   └── BackgroundShapes.jsx      — Animated parallax decorative shapes (login)
│   │   └── ErrorBoundary.jsx             — React error boundary with retry button
│   ├── styles/
│   │   └── app-layout.css               — Sidebar, header, responsive layout CSS
│   └── data/
│       └── quotes.js                    — 42 medical/motivational quotes (EN/HI/MR)
├── index.html                           — Vite HTML entry
├── vite.config.js                       — Vite + React + Tailwind plugins
└── package.json
```

---

## Application Bootstrap

### `src/main.jsx`
```jsx
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')).render(<App />)
```
Bootstrap CSS is imported before custom CSS so custom rules can override Bootstrap defaults.

### `src/App.jsx`
```jsx
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
```
Three layers: routing context → auth state → route definitions.

---

## Authentication System

### `AuthContext` (`src/contexts/AuthContext.jsx`)

The single source of truth for authentication state across the entire app.

**State:**
- `user` — full user object from `/auth/me` (includes clinic)
- `token` — Sanctum token stored in localStorage
- `loading` — true only during initial session restore (avoids flash redirect to login)

**Session restore on mount:**
```
Module load: initialToken = localStorage.getItem('auth_token')
             loading = !!initialToken  (skip loading spinner if no token)

useEffect (once):
  if no initialToken → skip
  GET /auth/me
    → success: setUser(res.data.user)
    → 401:    remove localStorage token, setToken(null)
    → finally: setLoading(false)
```

**`login(email, password)`:**
```
POST /auth/login → {token}
localStorage.setItem('auth_token', token)
setToken(token)
GET /auth/me → {user}
setUser(user)
return user   ← caller reads user.role to decide redirect
```

**`logout()`:**
```
try: POST /auth/logout (revoke server token)
catch: swallowed (clear state regardless)
finally:
  localStorage.removeItem('auth_token')
  setToken(null)
  setUser(null)
```

**`updateUser(updatedUser)`:** Updates in-memory user state after profile edits.

Context value: `{ user, token, loading, login, logout, updateUser }`

### `useAuth` (`src/hooks/useAuth.js`)
```js
export function useAuth() {
  return useContext(AuthContext)
}
```
Used in every component that needs `user`, `login`, or `logout`.

---

## Routing

### `ProtectedRoute` (`src/routes/ProtectedRoute.jsx`)

Guards routes based on authentication state and optional role.

```
props: { role?: 'doctor' | 'pharmacy' }

if (loading) → <Spinner />            (session restoring, don't redirect yet)
if (!user)   → <Navigate to="/login"> (not authenticated)
if (role && user.role !== role)        (wrong role)
           → <Navigate to="/" />      (doctors go to /, pharmacy to /pharmacy)
else       → <Outlet />              (render children)
```

### Route Tree (`src/routes/index.jsx`)

```
/login                   LoginPage               (public)

ProtectedRoute            (auth check)
  AppLayout               (sidebar + header)

    /profile              ProfilePage             (any authenticated user)

    ProtectedRoute role="doctor"
      /                   DashboardPage
      /patients           PatientsPage
      /patients/:id       KeyedPatientDetail      (key=id forces remount on id change)
      /patients/:id/visits/new     NewVisitPage
      /visits/:visitId             VisitDetailPage
      /visits/:visitId/prescriptions/new  NewPrescriptionPage
      /prescriptions               PrescriptionsPage
      /prescriptions/:prescriptionId    PrescriptionDetailPage
      /settings           SettingsPage

    ProtectedRoute role="pharmacy"
      /pharmacy           PharmacyPage
      /pharmacy/history   PharmacyHistoryPage
      /pharmacy/prescriptions/:prescriptionId  PharmacyPrescriptionPage

ProtectedRoute role="doctor"   (outside AppLayout — no sidebar/header)
  /prescriptions/:prescriptionId/print  PrintPrescriptionPage

* → Navigate to /         (unknown paths fall through to root)
```

**`KeyedPatientDetail`** wraps `PatientDetailPage` with `key={id}` from `useParams()`. This forces React to fully unmount and remount the component when navigating between different patient IDs, resetting all internal state (fetched data, scroll position, etc.).

---

## Layout System

### `AppLayout` (`src/layouts/AppLayout.jsx`)

The shell rendered around all authenticated pages. Uses React Router's `<Outlet />` to render the active page.

**Structure:**
```
<div class="app-root">
  <aside class="sidebar" [collapsed]>
    Brand logo + clinic name
    Navigation links (role-dependent)
    Theme toggle (bottom)
  </aside>
  <div class="main-area">
    <header class="top-bar">
      Hamburger (mobile) / collapse toggle (desktop)
      Page title (derived from current route)
      User chip → profile menu dropdown
        User name + role badge
        Profile link
        Logout button
    </header>
    <main class="page-content">
      <Outlet />    ← active page renders here
    </main>
  </div>
</div>
```

**Sidebar navigation — Doctor:**
```
Dashboard    → /
Patients     → /patients
Prescriptions→ /prescriptions
Settings     → /settings
```

**Sidebar navigation — Pharmacy:**
```
Queue        → /pharmacy
History      → /pharmacy/history
```

**Theme toggle:** Stores `theme` in localStorage. Adds/removes `data-theme="dark"` on `<html>`. All colors use CSS variables that respond to this attribute.

**Sidebar collapse:**
- Desktop: `sidebarOpen` state collapses sidebar to icon-only width (CSS `sidebar--collapsed` class).
- Mobile (<768px): full overlay sidebar controlled by hamburger button.

**Page titles** — derived from `useLocation().pathname`:
```js
'/'           → 'Dashboard'
'/patients'   → 'Patients'
'/prescriptions' → 'Prescriptions'
'/pharmacy'   → 'Queue'
'/pharmacy/history' → 'Completed Prescriptions'
'/settings'   → 'Settings'
'/profile'    → 'Profile'
```
Dynamic segments (patient/:id, visit/:visitId, etc.) map to their respective section title.

---

## API Service Layer

### `api.js` — Axios Instance

```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
})

// Request interceptor: inject auth token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor: handle 401 globally
api.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401
        && !url.includes('/auth/login')
        && !url.includes('/auth/me')) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

The 401 handler skips `/auth/login` and `/auth/me` because those endpoints handle 401 themselves. All other 401s (expired or revoked token) trigger a hard redirect to login.

### `patientService.js`
```js
searchPatients(q)                           GET /patients?q=&per_page=8
getRecentPatients()                         GET /patients?per_page=10
listPatients(params)                        GET /patients?{q,gender,is_new,sort,direction,per_page,page}
getPatient(id)                              GET /patients/{id}
createPatient(data)                         POST /patients
updatePatient(id, data)                     PUT /patients/{id}
getPatientVisits(id, params)                GET /patients/{id}/visits
getPatientPrescriptions(id, params)         GET /patients/{id}/prescriptions
```

### `visitService.js`
```js
createVisit(patientId, data)                POST /patients/{patientId}/visits
getVisit(visitId)                           GET /visits/{visitId}
updateVisit(visitId, data)                  PUT /visits/{visitId}
```

### `prescriptionService.js`
```js
getClinicPrescriptions(params)              GET /prescriptions?{status,q,per_page}
createPrescription(visitId, data)           POST /visits/{visitId}/prescriptions
getPrescription(id)                         GET /prescriptions/{id}
updatePrescription(id, data)                PUT /prescriptions/{id}
sendPrescription(id)                        POST /prescriptions/{id}/send
deletePrescription(id)                      DELETE /prescriptions/{id}
getPrescriptionPdf(id)                      GET /prescriptions/{id}/pdf (blob response)
listTemplates()                             GET /prescription-templates
uploadTemplate(formData)                    POST /prescription-templates (multipart)
deleteTemplate(filename)                    DELETE /prescription-templates/{filename}
```

`getPrescriptionPdf` sets `responseType: 'blob'` and returns the raw blob for in-tab display or download.

### `pharmacyService.js`
```js
getPharmacyPrescriptions()                  GET /pharmacy/prescriptions
getPharmacyPrescription(id)                 GET /pharmacy/prescriptions/{id}
startDispensingPharmacyPrescription(id)     POST /pharmacy/prescriptions/{id}/start-dispensing
completePharmacyPrescription(id)            POST /pharmacy/prescriptions/{id}/complete
getPharmacyHistory()                        GET /pharmacy/prescriptions/history
```

### `dashboardService.js`
```js
getDashboardStats()                         GET /dashboard/stats
getTodayPatients()                          GET /dashboard/today-patients
getDashboardPendingRx()                     GET /dashboard/pending-rx
getRevenueDetails()                         GET /dashboard/revenue
```

### `settingsService.js`
```js
getSettings()                               GET /settings
updateClinic(data)                          PUT /settings/clinic
updatePrescriptionSettings(data)            PUT /settings/prescriptions
```

---

## Pages

### `LoginPage` (`src/pages/auth/LoginPage.jsx`)

**Features:**
- Role switcher toggle: Doctor / Pharmacy — sets a cosmetic mode that changes the background animation theme.
- `BackgroundShapes` component renders animated parallax shapes (sun, clouds, birds, moon/stars). Pharmacy mode adds extra shapes.
- Random medical/motivational quote from `data/quotes.js` (42 quotes in EN/HI/MR).
- Theme toggle button (dark/light) persisted to localStorage.
- Form: email + password fields.
- Error handling: 401 → "Invalid credentials", 403 → "Account is inactive", 422 → field-level validation errors.

**Login flow:**
```
Submit form
→ AuthContext.login(email, password)
  → POST /auth/login → stores token
  → GET /auth/me → returns user object with user.role
→ if user.role === 'doctor'   → navigate('/')
→ if user.role === 'pharmacy' → navigate('/pharmacy')
```

---

### `DashboardPage` (`src/pages/dashboard/DashboardPage.jsx`)

The main doctor landing page, loaded by default on `/`.

**Sections (top to bottom):**

1. **Greeting header** — "Good morning/afternoon/evening, Dr. [name]" + clinic name.

2. **Hero status strip** — Context-aware message:
   - No clinic data → onboarding prompt (link to Settings)
   - Today's visit count = 0 → "No patients yet today"
   - visit count > 0 → "You've seen X patients today"

3. **Quick action tiles** — 4 cards (New Patient, Patients List, Prescriptions, Settings).

4. **Stat cards** (4 cards):
   - Today's Visits (with yesterday comparison)
   - Total Visits
   - Total Patients
   - Pending at Pharmacy (sent_to_pharmacy count)

5. **Draft prescription alert** — Yellow banner if `draft_rx > 0`. Links to `/prescriptions?status=draft`.

6. **Weekly activity strip** — 7 columns (Mon–Sun), bar heights proportional to visit count. Today's column highlighted.

7. **Revenue overview card** — Blurred ₹ amount. Click to open `RevenueModal`.

8. **Patient search** — `PatientSearchBox` component (debounced search).

9. **Seen Today** card — Lists last 8 patients seen today (name, mobile, time).

10. **Pending at Pharmacy** card — Lists last 8 prescriptions at pharmacy (patient name, medicines, sent time).

**Data fetching:** Parallel calls on mount:
```js
Promise.all([
  getDashboardStats(),
  getTodayPatients(),
  getDashboardPendingRx(),
])
```

### `PatientSearchBox` (`src/pages/dashboard/PatientSearchBox.jsx`)
- 300ms debounce on input.
- Focuses input on `/` keypress (global shortcut).
- Dropdown shows matching patients with name + mobile.
- "Register new patient" option always shown at bottom.
- Clicking a result navigates to `/patients/{id}`.

### `RevenueModal` (`src/pages/dashboard/RevenueModal.jsx`)
- Opens `getRevenueDetails()` on first open (lazy load).
- Four period tabs: Today, This Week, This Month, All Time.
- Each tab shows: Total Revenue, Paid Visits, Free Visits, Collection Rate (%), Avg Fee (all-time only).
- Calculation breakdown section explains how numbers are derived.

---

### `PatientsPage` (`src/pages/patients/PatientsPage.jsx`)

**DataTable** with columns:
- Patient (avatar initials + name, clickable → detail page)
- Contact (mobile number)
- Age
- Gender
- Last Visit (relative date)

**Controls:**
- Search input (debounced)
- Gender filter pill buttons (All, Male, Female, Other)
- New Patient button → opens `PatientFormModal`
- Export buttons (Copy, CSV, Excel, Print) via DataTables.net

**State management:** Fetches all patients on mount, re-fetches after add/edit.

### `PatientDetailPage` (`src/pages/patients/PatientDetailPage.jsx`)

`key={id}` prop set by `KeyedPatientDetail` wrapper — fully remounts when navigating between patients.

**Layout:**

1. **Hero card** — circular avatar with initials, patient name, mobile (clickable tel link), age/gender/DOB tags. Edit and New Visit action buttons.

2. **Stats row** — Total Visits, Total Prescriptions, Last Visit date.

3. **Demographics section** — DOB, computed age, gender, mobile, address.

4. **Visit history list** — Recent visits, clickable rows → `/visits/:visitId`.

5. **Prescription history** — Paginated (10 per page) with Load More. Shows medicine count, status badge, date, PDF link.

### `PatientFormModal` (`src/pages/patients/PatientFormModal.jsx`)
- Dual-mode: create (blank) or edit (pre-filled from patient object).
- Fields: name*, mobile*, date_of_birth, age, gender, address.
- Client validation: age must be 0–150.
- Error handling: 409 (duplicate mobile) → inline error; 422 → per-field server errors.

---

### `NewVisitPage` (`src/pages/visits/NewVisitPage.jsx`)
- Route: `/patients/:id/visits/new`
- Fields: `visited_at` (datetime-local, defaults to now), `consultation_notes` (textarea), `consultation_fee` (number).
- On submit: `visitService.createVisit(patientId, data)` → navigate to `/visits/{visitId}`.

### `VisitDetailPage` (`src/pages/visits/VisitDetailPage.jsx`)
- Shows: patient name (link), date/time, doctor name, consultation notes, fee.
- **Inline edit mode** — toggle with Edit button. Shows form with current values.
- Confirm-before-discard: if changes made, shows confirmation dialog before discarding.
- **New Prescription** button → `/visits/{visitId}/prescriptions/new`.

---

### `NewPrescriptionPage` (`src/pages/prescriptions/NewPrescriptionPage.jsx`)
- Route: `/visits/:visitId/prescriptions/new`
- Fields: `prescribed_at` (datetime-local, defaults to now), medicines via `MedicineEditor`, `doctor_notes`.
- Client validation: at least one medicine with `medicine_name` filled.
- Server validation: maps `items.0.medicine_name` style errors → per-item error display.
- On submit: `prescriptionService.createPrescription(visitId, data)` → navigate to `/prescriptions/{id}`.

### `MedicineEditor` (`src/pages/prescriptions/MedicineEditor.jsx`)
Controlled list component managing an array of medicine items.

Each item has:
- `medicine_name` (required, text)
- `dosage` (optional, text)
- `frequency` (optional, text)
- `duration` (optional, text)
- `instructions` (optional, textarea)

Controls per item:
- Remove button (trash icon)
- Up / Down reorder buttons (move item in array)

Add new item button at bottom. Uses `newMedicineItem()` from `medicineUtils.js` which assigns a unique `_key` for React list keys.

### `PrescriptionDetailPage` (`src/pages/prescriptions/PrescriptionDetailPage.jsx`)
**Mode-aware UI** — actions available depend on prescription status:

| Section | draft | sent_to_pharmacy | dispensing | completed |
|---|---|---|---|---|
| Edit button | ✓ | ✗ | ✗ | ✗ |
| Send to pharmacy | ✓ (inline confirm) | ✗ | ✗ | ✗ |
| Delete | ✓ (inline confirm) | ✗ | ✗ | ✗ |
| PDF buttons | ✓ | ✓ | ✓ | ✓ |
| Timeline | — | sent_at | dispensed_at | completed_at |

**PDF view flow:**
- "View PDF" button → calls `getPrescriptionPdf(id)` → blob URL → opens in new tab.
- Inline spinner while generating.
- Shows error if backend returns 404 (no template configured).

**Send to pharmacy:** Inline confirmation strip appears (confirm/cancel). On confirm: `sendPrescription(id)` → re-fetches prescription → status updates.

**Edit mode:** Switches to `MedicineEditor` + notes textarea in-place. Cancel restores original. Save calls `updatePrescription`.

### `PrintPrescriptionPage` (`src/pages/prescriptions/PrintPrescriptionPage.jsx`)
Standalone route (no AppLayout sidebar). Designed for `window.print()`.

**Two rendering modes based on active template:**

1. **No template** — Full standalone print layout:
   - Clinic header (name, doctor, qualification, contact)
   - Patient name, date
   - Rx symbol
   - Numbered medicine list
   - Doctor notes section
   - Signature line

2. **With template (image type)** — CSS `background-image` on the page, prescription content overlaid at absolute positions.

3. **With template (PDF type)** — Links to the backend PDF endpoint (the actual FPDI-generated PDF).

Auto-triggers `window.print()` after 500ms delay when loaded.

### `PrescriptionsPage` (`src/pages/prescriptions/PrescriptionsPage.jsx`)
**Two tab sections:**

**Prescriptions tab:**
- Status filter pills: All, Draft, Sent to Pharmacy, Dispensing, Completed.
- Date range dropdown: Today, This Week, Last 30 Days, This Month.
- DataTable: Patient, Date, Medicines (count or list), Status badge, Actions.
- Row actions: View PDF (draft/sent/dispensing/completed), Edit (draft only), Delete (draft only).
- Medicine overflow: If a prescription has >3 medicines, clicking opens a modal listing all.

**Templates tab (TemplatesPanel):**
- Lists all uploaded templates (image thumbnail or PDF icon).
- Upload button (accepts PDF, PNG, JPG, WebP, max 10MB).
- Set as active button (marks template in clinic settings).
- Delete button with confirmation.
- Active template shown with a badge.

---

### `PharmacyPage` (`src/pages/pharmacy/PharmacyPage.jsx`)
Live prescription queue for the pharmacist.

**Stat cards:**
- Total Active (sent + dispensing)
- Pending (sent_to_pharmacy count)
- Dispensing (dispensing count)
- Completed Today

**Queue sections:**
- **Currently Dispensing** — prescriptions with status=dispensing (shown first, highlighted)
- **Waiting** — prescriptions with status=sent_to_pharmacy

Each `RxCard` shows:
- Patient name, doctor name
- Medicines list (first 3 + "more" if overflow)
- Status badge
- Time since sent (relative)
- Urgent flag if pending > 30 minutes

**Auto-polling:**
- Queue refreshes every **30 seconds**
- Stats refresh every **2 minutes**

### `PharmacyPrescriptionPage` (`src/pages/pharmacy/PharmacyPrescriptionPage.jsx`)
Detail view for a specific prescription in the pharmacy workflow.

**Sections:**
- Header: patient name, status badge, doctor name, prescribed_at.
- Timeline: sent_to_pharmacy_at, dispensed_at, completed_at (progressive reveal).
- **Start Dispensing** button (if status = sent_to_pharmacy) → calls `startDispensing`.
- **Medicine checklist** (if status = dispensing):
  - Each medicine has a checkbox.
  - Progress bar: X of Y medicines checked.
- **Mark as Completed** button (if dispensing, or fallback from pending):
  - Shows confirmation strip before completing.
  - Calls `completePharmacyPrescription`.
- Doctor notes section.

### `PharmacyHistoryPage` (`src/pages/pharmacy/PharmacyHistoryPage.jsx`)
Completed prescriptions grouped by date:
- **Today**
- **Yesterday**
- **Earlier** (grouped by date label)

Each entry shows patient name, doctor, medicines, completion time. Polls every 2 minutes.

---

### `SettingsPage` (`src/pages/settings/SettingsPage.jsx`)
Two-section settings form.

**Clinic Info:**
- Clinic name (required)
- Doctor name (required)
- Qualification (optional)
- Contact (optional)
- Address (optional)

**Prescription Settings** (separate save):
- Prescription header text
- Prescription footer text
- Show doctor contact on prescription (toggle)
- Show clinic contact on prescription (toggle)

Both sections save independently and show success/error feedback inline.

### `ProfilePage` (`src/pages/profile/ProfilePage.jsx`)
User profile management (doctor or pharmacy user).

**Sections:**
- Avatar upload/remove (image preview, stored via `POST /profile/avatar`)
- Display name edit
- Email display (read-only)
- Role badge (read-only)
- Change password form (current password + new password + confirm)

---

## Shared Components

### `Spinner` (`src/components/ui/Spinner.jsx`)
SVG circle with CSS `animation: spin 0.75s linear infinite`. Used on page loading states and inside buttons during async operations.

### `Modal` (`src/components/ui/Modal.jsx`)
Portal-based modal rendered into `document.body` via `ReactDOM.createPortal`.

- Closes on `Escape` keypress.
- Closes on backdrop (overlay) click.
- Has: header slot, body slot, optional footer slot.
- Prevents body scroll while open.

### `BackgroundShapes` (`src/components/ui/BackgroundShapes.jsx`)
Login page animated background.

- Listens to `mousemove` events.
- Multiple SVG shape groups (slow/mid/fast layers) move at different rates — parallax effect.
- Day mode: sun, clouds, birds.
- Night mode (dark theme): moon, stars.
- Pharmacy mode: additional abstract shapes.

### `ErrorBoundary` (`src/components/ErrorBoundary.jsx`)
React class component. Catches JS errors anywhere in the component tree below it.

- Shows fallback UI with error message.
- "Try Again" button resets `hasError` state to attempt re-render.
- Used at the top level in `main.jsx` to prevent full app crashes.

---

## Design System (`src/index.css`)

500+ lines of CSS defining the entire visual language of the app.

### CSS Custom Properties (variables)
```css
--clr-bg          — page background
--clr-surface     — card/panel background
--clr-border      — border color
--clr-text        — primary text
--clr-text-muted  — secondary/muted text
--clr-primary     — brand blue (buttons, links, active states)
--clr-success     — green
--clr-warning     — amber
--clr-danger      — red
--radius-md / --radius-lg — border radius tokens
--shadow-sm / --shadow-md — box shadow tokens
```

### Light / Dark Theme
Dark theme activated by `data-theme="dark"` on `<html>`. All variables change values:
```css
:root { --clr-bg: #ffffff; --clr-surface: #f8f9fa; }
[data-theme="dark"] { --clr-bg: #0f1117; --clr-surface: #1a1d27; }
```

### Key CSS Classes
```
.page-card          — standard page container card
.card               — surface card with border and shadow
.btn-primary        — branded action button
.btn-secondary      — outlined secondary button
.btn-danger         — destructive action button
.field              — labeled form field wrapper
.form-stack         — vertical form layout
.badge-status-{name}— status badge (draft/sent/dispensing/completed)
.stat-card          — dashboard metric card
.detail-hero        — patient/prescription hero card layout
.detail-section     — labeled content block
.timeline           — prescription status timeline
.medicine-list      — numbered medicine display list
.rx-card            — pharmacy queue prescription card
```

### Status Badges
```
draft             — gray
sent_to_pharmacy  — blue
dispensing        — amber/orange
completed         — green
```

---

## Layout CSS (`src/styles/app-layout.css`)

```
.app-root           — flex row, 100vw × 100vh
.sidebar            — fixed width, flex column, transition on collapse
.sidebar--collapsed — reduced width, icons only
.main-area          — flex column, grows to fill remaining space
.top-bar            — sticky header, 60px height, flex row
.page-content       — scrollable main area with padding
```

**Mobile breakpoint (<768px):**
- Sidebar becomes full-screen overlay (z-index: 200).
- Hamburger button toggles `sidebar--open` class.
- Dark overlay backdrop closes sidebar on tap.

---

## Data Flow — Complete Request Lifecycle

### Doctor creates a prescription:

```
1. Doctor on /visits/{visitId} → clicks "New Prescription"
2. React Router navigates to /visits/{visitId}/prescriptions/new
3. NewPrescriptionPage mounts
4. Doctor fills prescribed_at, adds medicines via MedicineEditor, writes notes
5. Submits form
6. prescriptionService.createPrescription(visitId, {prescribed_at, items, doctor_notes})
   → POST /visits/{visitId}/prescriptions
   → Laravel: VisitPolicy@view checks clinic_id match
   → PrescriptionService.createPrescription() wraps in DB transaction
   → Creates Prescription (status=draft) + N PrescriptionItems
   → Returns PrescriptionResource (201)
7. React navigates to /prescriptions/{id}
8. PrescriptionDetailPage mounts, fetches GET /prescriptions/{id}
9. Shows prescription with Edit/Send/Delete/PDF buttons
```

### Prescription PDF generation:

```
1. Doctor clicks "View PDF" on PrescriptionDetailPage
2. prescriptionService.getPrescriptionPdf(id)
   → GET /prescriptions/{id}/pdf (responseType: 'blob')
3. Laravel: PrescriptionPdfController@generate
   → Authorize (clinic_id match)
   → Load prescription + patient + items
   → Fetch ClinicSetting for active template
   → resolveTemplatePath() validates PDF file exists
   → TemplateLayoutScanner.scan(templateFile) → layout coordinates
   → buildPdf(): FPDI overlays text on template
   → Output('S') → bytes → response with Content-Type: application/pdf
4. Frontend: URL.createObjectURL(blob) → window.open(url, '_blank')
5. PDF opens in new browser tab
```

### Pharmacy workflow:

```
1. Pharmacist on /pharmacy sees queue (auto-polls every 30s)
2. Clicks a prescription card → /pharmacy/prescriptions/{id}
3. PharmacyPrescriptionPage shows: patient, medicines, "Start Dispensing" button
4. Clicks "Start Dispensing"
   → POST /pharmacy/prescriptions/{id}/start-dispensing
   → PrescriptionService.startDispensing(): status = dispensing, dispensed_at = now()
5. Page refreshes: status = dispensing, checkboxes appear
6. Pharmacist checks medicines as dispensed
7. Clicks "Mark as Completed" → confirmation strip
8. Confirms
   → POST /pharmacy/prescriptions/{id}/complete
   → PrescriptionService.completePrescription(): status = completed, completed_at, completed_by
9. Page shows "Completed" badge and full timeline
```

---

## State Management Patterns

There is **no global state library** (no Redux/Zustand). State is managed via:

1. **React Context** — auth state only (`AuthContext`)
2. **Component-local `useState`** — all page-level data (fetched lists, form values, loading flags)
3. **Props** — passed down to child components like `MedicineEditor`, `PatientFormModal`
4. **URL state** — React Router params (`useParams`) and query strings for page/filter state
5. **localStorage** — token (`auth_token`) and theme preference (`theme`)

Each page fetches its own data independently. No shared cache layer — data is always fresh from the API.

---

## Error Handling Strategy

| Layer | What it handles |
|---|---|
| `api.js` interceptor | 401 → force logout + redirect to login |
| Page-level `try/catch` | Sets `error` state → shows inline error message |
| Form validation | 422 responses → maps field errors to input fields |
| 409 responses | Duplicate detection (e.g., patient mobile) → inline error |
| `ErrorBoundary` | Unhandled React render errors → fallback UI |
| Axios network error | Console warning "is the Laravel backend running?" |

---

## Key Dependencies (`package.json`)

| Package | Version | Purpose |
|---|---|---|
| react | ^19.2.8 | UI library |
| react-dom | ^19.2.8 | DOM rendering + portals |
| react-router-dom | ^7.18.3 | Client-side routing |
| axios | ^1.20.0 | HTTP client |
| bootstrap | ^5.3.8 | CSS component framework |
| tailwindcss | ^4.3.3 | Utility CSS classes |
| sonner | ^2.0.8 | Toast notifications |
| datatables.net-react | ^1.0.2 | Feature-rich data tables |
| jszip | latest | Export to Excel/ZIP in DataTables |
| vite | ^8.2.2 | Build tool + dev server |
| @vitejs/plugin-react | latest | React fast refresh |

---

## Build and Environment

### `vite.config.js`
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### Environment Variables
```
VITE_API_URL=http://localhost:8000/api
```
Set in `.env.local` for development. This is the only environment variable the frontend needs. All API calls use `import.meta.env.VITE_API_URL` as the base URL via `api.js`.

### Dev workflow
```bash
cd frontend
npm install
npm run dev     # Vite dev server at localhost:5173
```

```bash
cd backend
php artisan serve  # Laravel at localhost:8000
```
