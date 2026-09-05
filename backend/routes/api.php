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
    Route::get('/medicines', [MedicineController::class, 'index']);
    Route::patch('/medicines/{medicine}', [MedicineController::class, 'update']);
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
    Route::get('/dashboard/revenue',        [DashboardController::class, 'revenue']);

    // Patients
    Route::get('/patients', [PatientController::class, 'index']);
    Route::post('/patients', [PatientController::class, 'store']);
    Route::get('/patients/{patient}', [PatientController::class, 'show']);
    Route::put('/patients/{patient}', [PatientController::class, 'update']);

    // Visits — nested under patient for create/history, standalone for detail/update
    Route::post('/patients/{patient}/visits', [VisitController::class, 'store']);
    Route::get('/patients/{patient}/visits', [VisitController::class, 'patientHistory']);
    Route::get('/visits/{visit}', [VisitController::class, 'show']);
    Route::put('/visits/{visit}', [VisitController::class, 'update']);
    Route::post('/visits/{visit}/complete', [VisitController::class, 'complete']);

    // Clinic settings — doctor can update
    Route::put('/settings/clinic', [ClinicSettingsController::class, 'updateClinic']);
    Route::put('/settings/prescriptions', [ClinicSettingsController::class, 'updatePrescriptionSettings']);

    // Medicines — doctor manages the library
    Route::post('/medicines', [MedicineController::class, 'store']);
    Route::post('/medicines/import', [MedicineController::class, 'import']);
    Route::put('/medicines/{medicine}', [MedicineController::class, 'update']);
    Route::delete('/medicines/{medicine}', [MedicineController::class, 'destroy']);

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
    Route::get('/pharmacy/prescriptions', [PharmacyController::class, 'index']);
    Route::get('/pharmacy/prescriptions/history', [PharmacyController::class, 'history']);
    Route::get('/pharmacy/prescriptions/{prescription}', [PharmacyController::class, 'show']);
    Route::post('/pharmacy/prescriptions/{prescription}/start-dispensing', [PharmacyController::class, 'startDispensing']);
    Route::post('/pharmacy/prescriptions/{prescription}/complete', [PharmacyController::class, 'complete']);
});
