<?php

use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\ProfileController;
use App\Http\Controllers\API\ClinicSettingsController;
use App\Http\Controllers\API\DashboardController;
use App\Http\Controllers\API\MedicineController;
use App\Http\Controllers\API\PatientController;
use App\Http\Controllers\API\PharmacyController;
use App\Http\Controllers\API\PrescriptionController;
use App\Http\Controllers\API\PrescriptionPdfController;
use App\Http\Controllers\API\AppointmentController;
use App\Http\Controllers\API\LabReportController;
use App\Http\Controllers\API\MedicalHistoryController;
use App\Http\Controllers\API\SoapNoteController;
use App\Http\Controllers\API\StockItemController;
use App\Http\Controllers\API\VitalSignController;
use App\Http\Controllers\API\VisitController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Auth routes — open (no authentication required)
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1');

    Route::middleware('auth:sanctum')->group(function () {
        // Logout is always allowed — no stale-token check so doctor can always sign out.
        Route::post('/logout', [AuthController::class, 'logout']);
    });

    // /me uses stale-token so session restore fails fast on an inactive session.
    Route::middleware(['stale-token', 'auth:sanctum'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
    });
});

/*
|--------------------------------------------------------------------------
| Shared authenticated routes (doctor + pharmacy)
|--------------------------------------------------------------------------
*/
Route::middleware(['stale-token', 'auth:sanctum', 'active'])->group(function () {
    Route::get('/settings', [ClinicSettingsController::class, 'show']);
    Route::put('/settings/clinic-name', [ClinicSettingsController::class, 'updateClinicName']);

    // Medicines — full management open to both doctor and pharmacy
    Route::get('/medicines', [MedicineController::class, 'index']);
    Route::post('/medicines', [MedicineController::class, 'store']);
    Route::post('/medicines/import', [MedicineController::class, 'import']);
    Route::patch('/medicines/{medicine}', [MedicineController::class, 'update']);
    Route::put('/medicines/{medicine}', [MedicineController::class, 'update']);
    Route::delete('/medicines/{medicine}', [MedicineController::class, 'destroy']);
});

/*
|--------------------------------------------------------------------------
| Doctor-only routes
|--------------------------------------------------------------------------
*/
Route::middleware(['stale-token', 'auth:sanctum', 'active', 'role:doctor', 'throttle:120,1'])->group(function () {
    // Dashboard
    Route::get('/dashboard/stats',          [DashboardController::class, 'stats']);
    Route::get('/dashboard/today-patients', [DashboardController::class, 'todayPatients']);
    Route::get('/dashboard/pending-rx',     [DashboardController::class, 'pendingRx']);
    Route::get('/dashboard/revenue',              [DashboardController::class, 'revenue']);
    Route::get('/dashboard/revenue/transactions', [DashboardController::class, 'transactions']);

    // Patients
    Route::get('/patients', [PatientController::class, 'index']);
    Route::post('/patients', [PatientController::class, 'store']);
    Route::get('/patients/{patient}', [PatientController::class, 'show']);
    Route::put('/patients/{patient}', [PatientController::class, 'update']);

    // Visits — nested under patient for create/history, standalone for detail/update
    Route::get('/visits', [VisitController::class, 'index']);
    Route::post('/patients/{patient}/visits', [VisitController::class, 'store']);
    Route::get('/patients/{patient}/visits', [VisitController::class, 'patientHistory']);
    Route::get('/visits/{visit}', [VisitController::class, 'show']);
    Route::put('/visits/{visit}', [VisitController::class, 'update']);
    Route::patch('/visits/{visit}/fee', [VisitController::class, 'updateFee']);
    Route::post('/visits/{visit}/complete', [VisitController::class, 'complete']);

    // Clinic settings — doctor can update
    Route::put('/settings/clinic', [ClinicSettingsController::class, 'updateClinic']);
    Route::put('/settings/prescriptions', [ClinicSettingsController::class, 'updatePrescriptionSettings']);

    // Visit payment tracking
    Route::patch('/visits/{visit}/payment', [VisitController::class, 'recordPayment']);

    // Prescription templates — list, upload, set active, delete
    Route::get('/prescription-templates', [ClinicSettingsController::class, 'listTemplates']);
    Route::post('/prescription-templates', [ClinicSettingsController::class, 'uploadTemplate']);
    Route::delete('/prescription-templates/{filename}', [ClinicSettingsController::class, 'deleteTemplate'])
        ->where('filename', '.+');

    // Prescriptions — create nested under visit, manage standalone, history under patient
    Route::get('/prescriptions', [PrescriptionController::class, 'index']);
    Route::post('/visits/{visit}/prescriptions', [PrescriptionController::class, 'store']);
    Route::get('/prescriptions/{prescription}', [PrescriptionController::class, 'show']);
    Route::put('/prescriptions/{prescription}', [PrescriptionController::class, 'update']);
    Route::delete('/prescriptions/{prescription}', [PrescriptionController::class, 'destroy']);
    Route::post('/prescriptions/{prescription}/send', [PrescriptionController::class, 'send']);
    Route::get('/prescriptions/{prescription}/pdf', [PrescriptionPdfController::class, 'generate']);
    Route::get('/patients/{patient}/prescriptions', [PrescriptionController::class, 'patientHistory']);

    // Vital Signs
    Route::get('/patients/{patient}/vitals',             [VitalSignController::class, 'index']);
    Route::get('/patients/{patient}/vitals/latest',      [VitalSignController::class, 'latest']);
    Route::post('/patients/{patient}/vitals',            [VitalSignController::class, 'store']);
    Route::put('/patients/{patient}/vitals/{vitalSign}', [VitalSignController::class, 'update']);
    Route::delete('/patients/{patient}/vitals/{vitalSign}', [VitalSignController::class, 'destroy']);

    // Medical History
    Route::get('/patients/{patient}/medical-history',                       [MedicalHistoryController::class, 'index']);
    Route::post('/patients/{patient}/medical-history',                      [MedicalHistoryController::class, 'store']);
    Route::put('/patients/{patient}/medical-history/{medicalHistory}',      [MedicalHistoryController::class, 'update']);
    Route::delete('/patients/{patient}/medical-history/{medicalHistory}',   [MedicalHistoryController::class, 'destroy']);

    // Appointments
    Route::get('/appointments',                          [AppointmentController::class, 'index']);
    Route::get('/appointments/calendar',                 [AppointmentController::class, 'daysWithAppointments']);
    Route::post('/appointments',                         [AppointmentController::class, 'store']);
    Route::get('/appointments/{appointment}',            [AppointmentController::class, 'show']);
    Route::put('/appointments/{appointment}',            [AppointmentController::class, 'update']);
    Route::delete('/appointments/{appointment}',         [AppointmentController::class, 'destroy']);
    Route::get('/patients/{patient}/appointments',       [AppointmentController::class, 'forPatient']);

    // Lab Reports
    Route::get('/patients/{patient}/lab-reports',                      [LabReportController::class, 'index']);
    Route::post('/patients/{patient}/lab-reports',                     [LabReportController::class, 'store']);
    Route::post('/patients/{patient}/lab-reports/{labReport}',         [LabReportController::class, 'update']);
    Route::delete('/patients/{patient}/lab-reports/{labReport}',       [LabReportController::class, 'destroy']);

    // SOAP Notes
    Route::get('/visits/{visit}/soap',  [SoapNoteController::class, 'show']);
    Route::put('/visits/{visit}/soap',  [SoapNoteController::class, 'upsert']);
});

/*
|--------------------------------------------------------------------------
| Profile routes — any authenticated active user
|--------------------------------------------------------------------------
*/
Route::middleware(['stale-token', 'auth:sanctum', 'active', 'throttle:60,1'])->group(function () {
    Route::get('/profile',           [ProfileController::class, 'show']);
    Route::put('/profile',           [ProfileController::class, 'update']);
    Route::put('/profile/password',  [ProfileController::class, 'updatePassword']);
    Route::post('/profile/avatar',   [ProfileController::class, 'uploadAvatar']);
    Route::delete('/profile/avatar', [ProfileController::class, 'removeAvatar']);
});

/*
|--------------------------------------------------------------------------
| Pharmacy-only routes
|--------------------------------------------------------------------------
*/
Route::middleware(['stale-token', 'auth:sanctum', 'active', 'role:pharmacy', 'throttle:120,1'])->group(function () {
    Route::get('/pharmacy/stats', [PharmacyController::class, 'stats']);
    Route::get('/pharmacy/revenue',              [PharmacyController::class, 'revenue']);
    Route::get('/pharmacy/revenue/transactions', [PharmacyController::class, 'transactions']);
    Route::get('/pharmacy/prescriptions', [PharmacyController::class, 'index']);
    Route::get('/pharmacy/prescriptions/history', [PharmacyController::class, 'history']);
    Route::get('/pharmacy/prescriptions/{prescription}', [PharmacyController::class, 'show']);
    Route::post('/pharmacy/prescriptions/{prescription}/start-dispensing', [PharmacyController::class, 'startDispensing']);
    Route::post('/pharmacy/prescriptions/{prescription}/complete', [PharmacyController::class, 'complete']);
    Route::patch('/pharmacy/prescriptions/{prescription}/payment', [PharmacyController::class, 'recordPayment']);

    // Stock items — non-medicine inventory
    Route::get('/stock-items', [StockItemController::class, 'index']);
    Route::post('/stock-items', [StockItemController::class, 'store']);
    Route::patch('/stock-items/{stockItem}', [StockItemController::class, 'update']);
    Route::delete('/stock-items/{stockItem}', [StockItemController::class, 'destroy']);
});
