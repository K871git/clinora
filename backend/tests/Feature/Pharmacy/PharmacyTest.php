<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Clinic;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\User;
use App\Models\Visit;
use App\Services\Prescription\PrescriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PharmacyTest extends TestCase
{
    use RefreshDatabase;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function makeClinic(): Clinic
    {
        return Clinic::factory()->create();
    }

    private function doctor(Clinic $clinic): User
    {
        return User::factory()->doctor()->create(['clinic_id' => $clinic->id]);
    }

    private function pharmacy(Clinic $clinic): User
    {
        return User::factory()->pharmacy()->create(['clinic_id' => $clinic->id]);
    }

    private function patient(Clinic $clinic): Patient
    {
        return Patient::factory()->create(['clinic_id' => $clinic->id]);
    }

    private function visit(Clinic $clinic, Patient $patient, User $doctor): Visit
    {
        return Visit::factory()->forClinic($clinic, $patient, $doctor)->create();
    }

    private function prescription(Clinic $clinic, Patient $patient, User $doctor, Visit $visit, array $attrs = []): Prescription
    {
        return Prescription::factory()->forClinic($clinic, $patient, $doctor, $visit)->create($attrs);
    }

    private function sentPrescription(Clinic $clinic, Patient $patient, User $doctor, Visit $visit): Prescription
    {
        return $this->prescription($clinic, $patient, $doctor, $visit, ['status' => 'sent_to_pharmacy']);
    }

    // -----------------------------------------------------------------------
    // Doctor sends prescription to pharmacy
    // -----------------------------------------------------------------------

    public function test_doctor_can_send_draft_prescription_to_pharmacy(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/prescriptions/{$prescription->id}/send");

        $response->assertOk()
            ->assertJsonPath('data.status', 'sent_to_pharmacy');
    }

    public function test_send_changes_status_and_stores_sent_at(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/prescriptions/{$prescription->id}/send");

        $prescription->refresh();

        $this->assertEquals('sent_to_pharmacy', $prescription->status);
        $this->assertNotNull($prescription->sent_to_pharmacy_at);
    }

    public function test_cannot_send_already_sent_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->sentPrescription($clinic, $patient, $doctor, $visit);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/prescriptions/{$prescription->id}/send");

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'Only draft prescriptions can be sent to pharmacy.');
    }

    public function test_cannot_send_completed_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit, ['status' => 'completed']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/prescriptions/{$prescription->id}/send");

        $response->assertUnprocessable();
    }

    public function test_cannot_send_cancelled_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit, ['status' => 'cancelled']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/prescriptions/{$prescription->id}/send");

        $response->assertUnprocessable();
    }

    public function test_doctor_cannot_send_another_clinics_prescription(): void
    {
        $clinic            = $this->makeClinic();
        $doctor            = $this->doctor($clinic);
        $otherClinic       = $this->makeClinic();
        $otherDoctor       = $this->doctor($otherClinic);
        $otherPatient      = $this->patient($otherClinic);
        $otherVisit        = $this->visit($otherClinic, $otherPatient, $otherDoctor);
        $otherPrescription = $this->prescription($otherClinic, $otherPatient, $otherDoctor, $otherVisit);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/prescriptions/{$otherPrescription->id}/send");

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_send_a_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $pharmacy     = $this->pharmacy($clinic);
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/prescriptions/{$prescription->id}/send");

        $response->assertForbidden();
    }

    // -----------------------------------------------------------------------
    // Pharmacy pending prescriptions list
    // -----------------------------------------------------------------------

    public function test_pharmacy_can_view_pending_prescriptions(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);

        $visit1 = $this->visit($clinic, $patient, $doctor);
        $visit2 = $this->visit($clinic, $patient, $doctor);
        $visit3 = $this->visit($clinic, $patient, $doctor);

        $this->sentPrescription($clinic, $patient, $doctor, $visit1);
        $this->sentPrescription($clinic, $patient, $doctor, $visit2);
        $this->prescription($clinic, $patient, $doctor, $visit3); // draft, must not appear

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/api/pharmacy/prescriptions');

        $response->assertOk()
            ->assertJsonStructure(['data', 'links', 'meta']);

        $this->assertCount(2, $response->json('data'));
    }

    public function test_pending_list_only_shows_sent_to_pharmacy_status(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);

        $visit1 = $this->visit($clinic, $patient, $doctor);
        $visit2 = $this->visit($clinic, $patient, $doctor);
        $visit3 = $this->visit($clinic, $patient, $doctor);
        $visit4 = $this->visit($clinic, $patient, $doctor);

        $this->prescription($clinic, $patient, $doctor, $visit1, ['status' => 'draft']);
        $this->sentPrescription($clinic, $patient, $doctor, $visit2);
        $this->prescription($clinic, $patient, $doctor, $visit3, ['status' => 'completed']);
        $this->prescription($clinic, $patient, $doctor, $visit4, ['status' => 'cancelled']);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/api/pharmacy/prescriptions');

        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('sent_to_pharmacy', $response->json('data.0.status'));
    }

    public function test_pending_list_is_clinic_scoped(): void
    {
        $clinic      = $this->makeClinic();
        $pharmacy    = $this->pharmacy($clinic);
        $doctor      = $this->doctor($clinic);
        $patient     = $this->patient($clinic);
        $visit       = $this->visit($clinic, $patient, $doctor);

        $otherClinic  = $this->makeClinic();
        $otherDoctor  = $this->doctor($otherClinic);
        $otherPatient = $this->patient($otherClinic);
        $otherVisit   = $this->visit($otherClinic, $otherPatient, $otherDoctor);

        $this->sentPrescription($clinic, $patient, $doctor, $visit);
        $this->sentPrescription($otherClinic, $otherPatient, $otherDoctor, $otherVisit);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/api/pharmacy/prescriptions');

        $this->assertCount(1, $response->json('data'));
    }

    public function test_pending_list_is_newest_first(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);

        $visit1 = $this->visit($clinic, $patient, $doctor);
        $visit2 = $this->visit($clinic, $patient, $doctor);
        $visit3 = $this->visit($clinic, $patient, $doctor);

        $this->prescription($clinic, $patient, $doctor, $visit1, ['status' => 'sent_to_pharmacy', 'prescribed_at' => '2026-01-01 09:00:00']);
        $this->prescription($clinic, $patient, $doctor, $visit2, ['status' => 'sent_to_pharmacy', 'prescribed_at' => '2026-06-15 09:00:00']);
        $this->prescription($clinic, $patient, $doctor, $visit3, ['status' => 'sent_to_pharmacy', 'prescribed_at' => '2026-09-01 09:00:00']);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/api/pharmacy/prescriptions');

        $dates = collect($response->json('data'))->pluck('prescribed_at');
        $this->assertGreaterThan($dates[1], $dates[0]);
        $this->assertGreaterThan($dates[2], $dates[1]);
    }

    public function test_doctor_cannot_access_pharmacy_pending_list(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/pharmacy/prescriptions');

        $response->assertForbidden();
    }

    public function test_unauthenticated_cannot_access_pharmacy_endpoints(): void
    {
        $response = $this->getJson('/api/pharmacy/prescriptions');

        $response->assertUnauthorized();
    }

    // -----------------------------------------------------------------------
    // Pharmacy view prescription
    // -----------------------------------------------------------------------

    public function test_pharmacy_can_view_sent_prescription_detail(): void
    {
        $clinic       = $this->makeClinic();
        $pharmacy     = $this->pharmacy($clinic);
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->sentPrescription($clinic, $patient, $doctor, $visit);

        PrescriptionItem::factory()->create([
            'prescription_id' => $prescription->id,
            'medicine_name'   => 'Amoxicillin',
            'dosage'          => '500mg',
            'frequency'       => 'Twice daily',
        ]);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson("/api/pharmacy/prescriptions/{$prescription->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', $prescription->id)
            ->assertJsonPath('data.status', 'sent_to_pharmacy')
            ->assertJsonStructure(['data' => [
                'id', 'prescribed_at', 'doctor_notes', 'status',
                'patient', 'visit', 'doctor', 'items',
            ]]);
    }

    public function test_pharmacy_view_includes_patient_medicines_and_doctor(): void
    {
        $clinic       = $this->makeClinic();
        $pharmacy     = $this->pharmacy($clinic);
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->sentPrescription($clinic, $patient, $doctor, $visit);

        PrescriptionItem::factory()->create([
            'prescription_id' => $prescription->id,
            'medicine_name'   => 'Metformin',
            'dosage'          => '500mg',
            'frequency'       => 'Twice daily',
            'duration'        => '30 days',
            'instructions'    => 'Take with meals',
        ]);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson("/api/pharmacy/prescriptions/{$prescription->id}");

        $response->assertOk()
            ->assertJsonPath('data.patient.id', $patient->id)
            ->assertJsonPath('data.patient.name', $patient->name)
            ->assertJsonPath('data.doctor.id', $doctor->id)
            ->assertJsonPath('data.items.0.medicine_name', 'Metformin')
            ->assertJsonPath('data.items.0.dosage', '500mg')
            ->assertJsonPath('data.items.0.frequency', 'Twice daily')
            ->assertJsonPath('data.items.0.duration', '30 days')
            ->assertJsonPath('data.items.0.instructions', 'Take with meals');
    }

    public function test_pharmacy_cannot_view_another_clinics_prescription(): void
    {
        $clinic            = $this->makeClinic();
        $pharmacy          = $this->pharmacy($clinic);
        $otherClinic       = $this->makeClinic();
        $otherDoctor       = $this->doctor($otherClinic);
        $otherPatient      = $this->patient($otherClinic);
        $otherVisit        = $this->visit($otherClinic, $otherPatient, $otherDoctor);
        $otherPrescription = $this->sentPrescription($otherClinic, $otherPatient, $otherDoctor, $otherVisit);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson("/api/pharmacy/prescriptions/{$otherPrescription->id}");

        $response->assertForbidden();
    }

    // -----------------------------------------------------------------------
    // Pharmacy completes prescription
    // -----------------------------------------------------------------------

    public function test_pharmacy_can_complete_sent_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $pharmacy     = $this->pharmacy($clinic);
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->sentPrescription($clinic, $patient, $doctor, $visit);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/pharmacy/prescriptions/{$prescription->id}/complete");

        $response->assertOk()
            ->assertJsonPath('data.status', 'completed');
    }

    public function test_complete_stores_completed_at_and_completed_by(): void
    {
        $clinic       = $this->makeClinic();
        $pharmacy     = $this->pharmacy($clinic);
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->sentPrescription($clinic, $patient, $doctor, $visit);

        $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/pharmacy/prescriptions/{$prescription->id}/complete");

        $prescription->refresh();

        $this->assertEquals('completed', $prescription->status);
        $this->assertNotNull($prescription->completed_at);
        $this->assertEquals($pharmacy->id, $prescription->completed_by);
    }

    public function test_cannot_complete_draft_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $pharmacy     = $this->pharmacy($clinic);
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit); // status = draft

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/pharmacy/prescriptions/{$prescription->id}/complete");

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'Only sent prescriptions can be completed.');
    }

    public function test_cannot_complete_already_completed_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $pharmacy     = $this->pharmacy($clinic);
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit, ['status' => 'completed']);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/pharmacy/prescriptions/{$prescription->id}/complete");

        $response->assertUnprocessable();
    }

    public function test_pharmacy_cannot_complete_another_clinics_prescription(): void
    {
        $clinic            = $this->makeClinic();
        $pharmacy          = $this->pharmacy($clinic);
        $otherClinic       = $this->makeClinic();
        $otherDoctor       = $this->doctor($otherClinic);
        $otherPatient      = $this->patient($otherClinic);
        $otherVisit        = $this->visit($otherClinic, $otherPatient, $otherDoctor);
        $otherPrescription = $this->sentPrescription($otherClinic, $otherPatient, $otherDoctor, $otherVisit);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/pharmacy/prescriptions/{$otherPrescription->id}/complete");

        $response->assertForbidden();
    }

    public function test_doctor_cannot_complete_a_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->sentPrescription($clinic, $patient, $doctor, $visit);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/pharmacy/prescriptions/{$prescription->id}/complete");

        $response->assertForbidden();
    }

    public function test_concurrent_completion_is_protected_by_atomic_update(): void
    {
        $clinic       = $this->makeClinic();
        $pharmacy     = $this->pharmacy($clinic);
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->sentPrescription($clinic, $patient, $doctor, $visit);

        // Simulate another pharmacy user completing the prescription
        // concurrently (directly in the DB, bypassing the API check).
        // The service's conditional UPDATE must return 0 rows and the
        // controller must return 409.
        DB::table('prescriptions')
            ->where('id', $prescription->id)
            ->update(['status' => 'completed', 'completed_at' => now(), 'completed_by' => $pharmacy->id, 'updated_at' => now()]);

        // Reload so the controller sees the updated status ('completed')
        // — the controller check catches it and returns 422 before the service runs.
        // But we can also test the service layer directly:
        $service = app(PrescriptionService::class);
        $result  = $service->completePrescription($prescription, $pharmacy->id);

        $this->assertFalse($result);
    }

    // -----------------------------------------------------------------------
    // Completed prescriptions remain in history
    // -----------------------------------------------------------------------

    public function test_completed_prescriptions_appear_in_patient_history(): void
    {
        $clinic   = $this->makeClinic();
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);

        $visit1 = $this->visit($clinic, $patient, $doctor);
        $visit2 = $this->visit($clinic, $patient, $doctor);
        $visit3 = $this->visit($clinic, $patient, $doctor);

        $this->prescription($clinic, $patient, $doctor, $visit1, ['status' => 'draft']);
        $this->sentPrescription($clinic, $patient, $doctor, $visit2);
        $this->prescription($clinic, $patient, $doctor, $visit3, ['status' => 'completed']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}/prescriptions");

        $response->assertOk();
        $this->assertCount(3, $response->json('data'));

        $statuses = collect($response->json('data'))->pluck('status');
        $this->assertContains('completed', $statuses);
        $this->assertContains('sent_to_pharmacy', $statuses);
        $this->assertContains('draft', $statuses);
    }

    public function test_completing_prescription_removes_it_from_pending_list(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);
        $visit    = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->sentPrescription($clinic, $patient, $doctor, $visit);

        // Complete it
        $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/pharmacy/prescriptions/{$prescription->id}/complete");

        // Must no longer appear in pending list
        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/api/pharmacy/prescriptions');

        $this->assertCount(0, $response->json('data'));
    }
}
