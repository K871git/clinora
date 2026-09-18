Good — now I have the full picture. Prescription templates are already fully built (backend + frontend in NewPrescriptionPage.jsx). So it's just 4 things to build.

Plan
1. Diagnosis Field on Visit
Complexity: Low

Layer	What changes
Migration 0018	ALTER TABLE visits ADD COLUMN diagnosis TEXT NULL
visits.rs	Add diagnosis to get_visit SELECT + JSON output. Add new save_diagnosis command (UPDATE visits SET diagnosis=?)
lib.rs	Register save_diagnosis
VisitDetailPage.jsx	Editable diagnosis field above consultation notes, saves on blur
NewVisitPage.jsx	Optional diagnosis input at visit creation
PrintPrescriptionPage.jsx	Show diagnosis on printed prescription
VisitInvoicePage.jsx	Show diagnosis on doctor invoice
 

3. Medical Certificates
Complexity: Medium

Layer	What changes
Migration 0019	New table medical_certificates (id, clinic_id, patient_id, visit_id, doctor_id, cert_type, purpose, valid_from, valid_until, notes, created_at)
commands/certificates.rs	create_certificate, list_certificates(patient_id), get_certificate(id), delete_certificate(id)
mod.rs + lib.rs	Register module + 4 commands
VisitDetailPage.jsx	"Generate Certificate" button → modal with: Type (Fitness / Sick Leave / Medico-Legal / Custom), Purpose text, Valid From, Valid Until, Notes
routes/index.jsx	Add /visits/:visitId/certificate/:certId standalone route
CertificatePrintPage.jsx (new)	Clinic letterhead + patient name + date + certificate body text (auto-generated from type) + doctor name + registration number + signature space
PatientDetailPage.jsx	Show past certificates list in the visits/history section
Certificate body auto-text examples:

Fitness: "This is to certify that [Name], aged [X] years, was examined on [date] and is medically fit for [purpose]."
Sick Leave: "This is to certify that [Name] was under my care from [from] to [until] and is advised complete rest during this period."
Custom: free text
4. Pharmacy Return / Credit Note
Complexity: High

Layer	What changes
Migration 0020	New table pharmacy_returns (id, clinic_id, prescription_id, patient_id, returned_by, return_reason, total_refund, created_at)
Migration 0020	New table pharmacy_return_items (id, return_id, medicine_id, medicine_name, quantity_returned, unit_price, subtotal)
commands/pharmacy_returns.rs	create_pharmacy_return — creates return record + items + restores stock qty + logs audit entry. list_pharmacy_returns. get_pharmacy_return(id)
mod.rs + lib.rs	Register module + 3 commands
PharmacyPrescriptionPage.jsx	After status = completed, show "Process Return" button → modal listing dispensed medicines with qty fields + reason input
PharmacyHistoryPage.jsx	Show returns in history with credit note link
routes/index.jsx	Add /pharmacy/returns/:returnId/credit-note standalone route
PharmacyCreditNotePage.jsx (new)	Formatted credit note: clinic header, patient, return items table, total refund amount, reason
Build Order (recommended)

1 → Diagnosis field        (easy win, affects print + invoice)
2 → Allergy cross-check    (frontend only, quick)
3 → Medical certificates   (medium, self-contained)
4 → Pharmacy return        (most complex, do last)
Ready to start building? I'll go feature by feature, one at a time.