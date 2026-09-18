Clinora EXE — Full Feature Build Plan
Stack Reminder
Frontend: React + Tauri WebView2
Backend: Rust Tauri commands
DB: MySQL (local)
Pattern: Each feature = DB schema + Rust command(s) + React page/component + CSS
Phase 1 — Safety & Legal (Do First)
These are medico-legal requirements. A clinic cannot safely operate without them.

1.1 Allergy List per Patient
What: Tag allergies (drug, food, environmental) to a patient. When a prescription is written, scan the medicine list against known allergies and show a warning banner.

DB: patient_allergies table — patient_id, allergen, type (drug/food/env), severity (mild/moderate/severe), notes, created_at
Rust: list_allergies, add_allergy, delete_allergy
Frontend: Allergy section in patient record sidebar. Red alert banner in prescription editor if conflict found.
Complexity: Medium
1.2 Prescription Legal Header
What: Every printed prescription must show doctor's name, qualification, registration number, clinic address, and date. Currently missing.

DB: users table — add qualification, registration_number columns; clinic_settings — add address, phone
Rust: extend profile update command
Frontend: Profile page fields + updated prescription PDF/print template
Complexity: Small
1.3 Medication History per Patient
What: A single view showing all past prescriptions for a patient, sorted by date, across all visits.

DB: Already have the data — just needs a query joining prescriptions + visits by patient_id
Rust: get_patient_medication_history(patient_id) — returns grouped-by-visit list
Frontend: Tab in patient record — "Medications" — shows timeline of all past prescriptions
Complexity: Small (data exists, UI work only)
Phase 2 — Billing & Revenue (Clinic Survival)
Most clinics track money from day 1. Without this, the software isn't usable as a primary system.

2.1 OPD Billing / Invoice
What: For each visit, generate a bill: consultation fee + procedure charges + medicine charges. Print/save as PDF receipt.

DB: invoices — patient_id, visit_id, clinic_id, invoice_no, subtotal, discount, tax, total, payment_status (paid/partial/pending), created_at; invoice_items — invoice_id, description, quantity, unit_price, amount
Rust: create_invoice, get_invoice, update_invoice_status, list_invoices, get_daily_revenue
Frontend: Invoice form in visit flow → print receipt button. Invoice list page with filters (date, status, patient).
Complexity: High
2.2 Payment Tracking
What: Record how payment was received — Cash, UPI, Card, Insurance. Multiple payment methods per invoice.

DB: payments — invoice_id, amount, method (cash/upi/card/insurance), reference_no, paid_at
Rust: add_payment, list_payments_for_invoice
Frontend: Payment modal on invoice — add payment entries until fully paid. Shows balance due.
Complexity: Medium
2.3 Fee Templates
What: Pre-configure standard fees (Consultation: ₹500, Follow-up: ₹300, ECG: ₹200) so billing is fast.

DB: fee_templates — clinic_id, name, amount, category
Rust: list_fee_templates, save_fee_template, delete_fee_template
Frontend: Settings → Fee Templates page. Auto-populate invoice items from templates.
Complexity: Small
2.4 Daily Revenue Dashboard Widget
What: Today's collection — total billed, collected, pending. Breakdown by payment method.

Rust: Extend get_dashboard_stats to include revenue summary
Frontend: Revenue card on dashboard, small chart (bar or donut)
Complexity: Small (once billing exists)
Phase 3 — Pharmacy Compliance
Statutory requirement for a licensed pharmacy in India. Non-negotiable.

3.1 Supplier / Vendor Management
What: Track medicine suppliers — name, contact, GST number, address.

DB: suppliers — clinic_id, name, contact_person, phone, email, gst_no, address, notes
Rust: list_suppliers, save_supplier, delete_supplier
Frontend: Pharmacy → Suppliers page (simple CRUD table)
Complexity: Small
3.2 Batch + Expiry Tracking per Stock
What: Each stock item can have multiple batches with different expiry dates and purchase prices. Alert when a batch is near expiry.

DB: stock_batches — stock_item_id, supplier_id, batch_no, expiry_date, qty_received, qty_remaining, purchase_price, mrp, received_at
Rust: add_batch, list_batches_for_item, get_expiring_soon(days), consume_batch(item_id, qty) (FIFO)
Frontend: Stock item detail → Batches tab. Expiry alert banner in pharmacy dashboard. FIFO consumption on dispensing.
Complexity: High
3.3 Purchase Orders
What: Create a PO to a supplier, track received items, update stock automatically on receipt.

DB: purchase_orders — clinic_id, supplier_id, po_no, status (draft/sent/received), total, notes, created_at; purchase_order_items — po_id, stock_item_id, qty_ordered, qty_received, unit_price
Rust: create_po, list_pos, receive_po(po_id, items) — auto-increments stock + creates batch
Frontend: Pharmacy → Purchase Orders page. PO form with supplier picker + line items.
Complexity: High
3.4 Dispensing Record (Prescription → Pharmacy)
What: When pharmacy dispenses medicines against a prescription, record what was given, from which batch, at what price.

DB: dispensing_records — prescription_id, patient_id, stock_item_id, batch_id, qty, unit_price, dispensed_at, dispensed_by
Rust: dispense_prescription(prescription_id, items[]), get_dispensing_history(patient_id)
Frontend: Pharmacy → Dispense queue (list of pending prescriptions). Dispense modal per Rx.
Complexity: High
3.5 Low Stock Alerts
What: When any stock item's total remaining quantity drops below its threshold, show an alert.

DB: stock_items — add reorder_level column
Rust: get_low_stock_items — items where sum(batch qty) < reorder_level
Frontend: Pharmacy dashboard alert strip. Badge on nav icon.
Complexity: Small (once batches exist)
Phase 4 — Enhanced Clinical
Makes the clinical record complete and defensible.

4.1 Problem / Diagnosis List
What: A persistent list of a patient's active conditions — diabetes, hypertension, etc. — with ICD-10 code, onset date, status (active/resolved).

DB: patient_problems — patient_id, clinic_id, icd10_code, description, status, onset_date, resolved_date, notes
Rust: list_problems, add_problem, update_problem_status, delete_problem
Frontend: "Conditions" section in patient record. ICD-10 search/autocomplete (local lookup table of common codes).
Complexity: Medium + ICD-10 data import
4.2 SOAP Note Structure
What: Replace free-text notes with structured Subjective / Objective / Assessment / Plan fields for visit-level notes.

DB: visits — add soap_subjective, soap_objective, soap_assessment, soap_plan TEXT columns
Rust: extend update_visit command
Frontend: Visit detail → 4 text areas with S/O/A/P labels. Can collapse to single view.
Complexity: Small (DB migration + UI change)
4.3 Referral Slips
What: Refer patient to a specialist — generate a printable referral letter with reason, urgency, and referring doctor details.

DB: referrals — patient_id, visit_id, referred_to_name, referred_to_specialty, reason, urgency (routine/urgent/emergency), notes, created_at
Rust: create_referral, list_referrals(patient_id)
Frontend: Button in visit toolbar → referral form modal → print referral letter (same iframe print approach)
Complexity: Medium
4.4 Vaccination Records
What: Track vaccines given — date, vaccine name, batch, next due date.

DB: vaccinations — patient_id, clinic_id, vaccine_name, given_date, batch_no, next_due_date, notes
Rust: list_vaccinations, add_vaccination, delete_vaccination
Frontend: "Vaccines" tab in patient record. Due dates shown on patient timeline.
Complexity: Small
Phase 5 — Administrative Workflow
Reception and flow management.

5.1 OPD Queue / Token System
What: Walk-in patients get a token number. Receptionist marks them as Waiting → Called → With Doctor → Done.

DB: opd_queue — clinic_id, patient_id, token_no, status, called_at, seen_at, date
Rust: add_to_queue, get_today_queue, update_queue_status, get_next_token
Frontend: Queue board page (reception view). Doctor's dashboard shows "Next patient" button.
Complexity: Medium
5.2 Patient Photo
What: Capture or upload a photo for patient identity verification at reception.

DB: patients — add photo_path column
Rust: save_patient_photo(patient_id, bytes), serve photo via asset://
Frontend: Patient card → avatar with upload button
Complexity: Small
5.3 Emergency Contact
What: Store name + relationship + phone for each patient.

DB: patients — add emergency_contact_name, emergency_contact_phone, emergency_contact_relation
Rust: extend patient update command
Frontend: Patient demographics form — Emergency section
Complexity: Very Small
Phase 6 — Reports & Analytics
Business intelligence for clinic management.

6.1 Revenue Report
What: Monthly/date-range breakdown — total billed, collected, outstanding. By doctor, by service type.

Rust: get_revenue_report(from, to, group_by)
Frontend: Reports → Revenue tab. Table + bar chart.
Complexity: Medium
6.2 Patient Statistics
What: New patients per month, repeat visits, top diagnosis, age/gender distribution.

Rust: get_patient_stats(from, to)
Frontend: Reports → Patients tab. Charts.
Complexity: Medium
6.3 Prescription Analytics
What: Most prescribed medicines, prescription volume per day/week.

Rust: get_prescription_stats(from, to)
Frontend: Reports → Prescriptions tab.
Complexity: Small
6.4 Pharmacy Sales Report
What: Daily/monthly medicine sales — revenue, top-selling items, expiry waste.

Rust: get_pharmacy_sales_report(from, to)
Frontend: Reports → Pharmacy tab.
Complexity: Medium
6.5 Export (PDF / Excel)
What: Any report table → export to Excel (.xlsx) or PDF.

Rust: Use xlsxwriter crate for Excel; print-to-PDF via iframe for PDF
Frontend: Export button on every report page
Complexity: Medium
Phase 7 — Compliance & Security
Legal protection and future-proofing.

7.1 Audit Trail
What: Log every create/update/delete — who, what, when. Non-editable.

DB: audit_log — user_id, action, table_name, record_id, old_value (JSON), new_value (JSON), created_at
Rust: Write to audit_log inside every mutating command
Frontend: Settings → Audit Log (read-only paginated table)
Complexity: Medium (touches every command)
7.2 Data Backup Encryption
What: Current backup exists. Add password encryption to the backup file.

Rust: AES-256 encrypt/decrypt backup using aes + rand crates. Password set by admin.
Frontend: Backup settings → set backup password
Complexity: Medium
7.3 ABDM / ABHA Integration (Future)
What: Link patients to their Ayushman Bharat Health Account. Required eventually by NHA mandate.

Complexity: Very High — government API integration, OAuth, FHIR records
Defer to last — do everything else first
Build Order Summary
Phase	Name	Effort	Priority
1	Safety & Legal	1–2 weeks	Immediate
2	Billing & Revenue	2–3 weeks	Immediate
3	Pharmacy Compliance	3–4 weeks	High
4	Enhanced Clinical	2–3 weeks	High
5	Administrative	1–2 weeks	Medium
6	Reports & Analytics	2–3 weeks	Medium
7	Compliance & Security	2–3 weeks	Medium
—	ABDM/ABHA	4–6 weeks	Defer
Total estimated effort: 17–24 weeks for one developer working full-time, depending on design decisions along the way.

Key Design Decisions to Settle Before Building
Single doctor or multi-doctor? — affects queue, billing, scheduling
Nurse / receptionist role? — third user tier for queue + billing
GST on invoices? — affects invoice model (CGST/SGST fields)
Insurance / TPA billing? — separate flow entirely if needed
ICD-10 or free-text diagnosis? — free-text is faster to build, ICD-10 is proper
Review these, confirm priorities, and we can start Phase 1 immediately.