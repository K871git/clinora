<?php

namespace Tests\Feature\Prescription;

use App\Models\Clinic;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrescriptionTest extends TestCase
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

    private function itemPayload(int $sortOrder = 0): array
    {
        return [
            'medicine_name' => 'Amoxicillin',
            'dosage'        => '500mg',
            'frequency'     => 'Twice daily',
            'duration'      => '5 days',
            'instructions'  => 'Take after food',
            'sort_order'    => $sortOrder,
        ];
    }

    // -----------------------------------------------------------------------
    // Create prescription
    // -----------------------------------------------------------------------

    public function test_doctor_can_create_a_prescription_for_a_visit(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/visits/{$visit->id}/prescriptions", [
                'prescribed_at' => '2026-09-02 10:00:00',
                'doctor_notes'  => 'Rest for 3 days.',
                'items'         => [$this->itemPayload()],
            ]);

        $response->assertCreated()
            ->assertJsonStructure(['data' => [
                'id', 'prescribed_at', 'doctor_notes', 'status',
                'patient', 'visit', 'doctor', 'items', 'created_at',
            ]]);

        $this->assertDatabaseHas('prescriptions', [
            'clinic_id'  => $clinic->id,
            'patient_id' => $patient->id,
            'visit_id'   => $visit->id,
            'doctor_id'  => $doctor->id,
            'status'     => 'draft',
        ]);
    }

    public function test_prescription_stores_clinic_and_doctor_from_authenticated_user(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/visits/{$visit->id}/prescriptions", [
                'prescribed_at' => '2026-09-02 10:00:00',
            ]);

        $prescription = Prescription::where('visit_id', $visit->id)->first();

        $this->assertEquals($clinic->id, $prescription->clinic_id);
        $this->assertEquals($doctor->id, $prescription->doctor_id);
        $this->assertEquals($patient->id, $prescription->patient_id);
    }

    public function test_create_prescription_with_multiple_medicine_items(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/visits/{$visit->id}/prescriptions", [
                'prescribed_at' => '2026-09-02 10:00:00',
                'items'         => [
                    $this->itemPayload(0),
                    array_merge($this->itemPayload(1), ['medicine_name' => 'Paracetamol', 'dosage' => '1g']),
                    array_merge($this->itemPayload(2), ['medicine_name' => 'Ibuprofen', 'dosage' => '400mg']),
                ],
            ]);

        $response->assertCreated();

        $prescriptionId = $response->json('data.id');
        $this->assertCount(3, $response->json('data.items'));
        $this->assertDatabaseCount('prescription_items', 3);

        $this->assertDatabaseHas('prescription_items', [
            'prescription_id' => $prescriptionId,
            'medicine_name'   => 'Paracetamol',
        ]);
    }

    public function test_create_prescription_starts_as_draft(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/visits/{$visit->id}/prescriptions", [
                'prescribed_at' => '2026-09-02 10:00:00',
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'draft');
    }

    public function test_create_prescription_requires_prescribed_at(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/visits/{$visit->id}/prescriptions", []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['prescribed_at']);
    }

    public function test_create_prescription_validates_item_medicine_name(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/visits/{$visit->id}/prescriptions", [
                'prescribed_at' => '2026-09-02 10:00:00',
                'items'         => [['dosage' => '500mg']], // missing medicine_name
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.medicine_name']);
    }

    public function test_doctor_cannot_create_prescription_for_another_clinics_visit(): void
    {
        $clinic      = $this->makeClinic();
        $doctor      = $this->doctor($clinic);
        $otherClinic = $this->makeClinic();
        $otherDoctor = $this->doctor($otherClinic);
        $otherPatient = $this->patient($otherClinic);
        $otherVisit  = $this->visit($otherClinic, $otherPatient, $otherDoctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/visits/{$otherVisit->id}/prescriptions", [
                'prescribed_at' => '2026-09-02 10:00:00',
            ]);

        $response->assertForbidden();
    }

    public function test_create_prescription_returns_404_for_nonexistent_visit(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/visits/99999/prescriptions', [
                'prescribed_at' => '2026-09-02 10:00:00',
            ]);

        $response->assertNotFound();
    }

    // -----------------------------------------------------------------------
    // View prescription
    // -----------------------------------------------------------------------

    public function test_doctor_can_view_prescription_with_full_details(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        PrescriptionItem::factory()->create([
            'prescription_id' => $prescription->id,
            'medicine_name'   => 'Amoxicillin',
        ]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/prescriptions/{$prescription->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', $prescription->id)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonStructure(['data' => [
                'id', 'prescribed_at', 'doctor_notes', 'status',
                'patient', 'visit', 'doctor', 'items', 'created_at',
            ]]);
    }

    public function test_prescription_detail_includes_patient_visit_doctor_and_items(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        PrescriptionItem::factory()->create([
            'prescription_id' => $prescription->id,
            'medicine_name'   => 'TestMed',
            'sort_order'      => 0,
        ]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/prescriptions/{$prescription->id}");

        $response->assertOk()
            ->assertJsonPath('data.patient.id', $patient->id)
            ->assertJsonPath('data.visit.id', $visit->id)
            ->assertJsonPath('data.doctor.id', $doctor->id)
            ->assertJsonPath('data.items.0.medicine_name', 'TestMed');
    }

    public function test_doctor_cannot_view_another_clinics_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $otherClinic  = $this->makeClinic();
        $otherDoctor  = $this->doctor($otherClinic);
        $otherPatient = $this->patient($otherClinic);
        $otherVisit   = $this->visit($otherClinic, $otherPatient, $otherDoctor);
        $otherPrescription = $this->prescription($otherClinic, $otherPatient, $otherDoctor, $otherVisit);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/prescriptions/{$otherPrescription->id}");

        $response->assertForbidden();
    }

    public function test_show_prescription_returns_404_for_nonexistent(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/prescriptions/99999');

        $response->assertNotFound();
    }

    // -----------------------------------------------------------------------
    // Update prescription
    // -----------------------------------------------------------------------

    public function test_doctor_can_update_draft_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => '2026-09-02 11:00:00',
                'doctor_notes'  => 'Updated notes.',
                'items'         => [$this->itemPayload()],
            ]);

        $response->assertOk()
            ->assertJsonPath('data.doctor_notes', 'Updated notes.');

        $this->assertDatabaseHas('prescriptions', [
            'id'           => $prescription->id,
            'doctor_notes' => 'Updated notes.',
        ]);
    }

    public function test_update_prescription_replaces_all_medicine_items(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        // Create initial items
        PrescriptionItem::factory()->count(3)->create(['prescription_id' => $prescription->id]);

        $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => '2026-09-02 11:00:00',
                'items'         => [
                    $this->itemPayload(0),
                    array_merge($this->itemPayload(1), ['medicine_name' => 'NewMed']),
                ],
            ]);

        $this->assertCount(2, $prescription->fresh()->items);
        $this->assertDatabaseHas('prescription_items', ['medicine_name' => 'NewMed']);
    }

    public function test_update_removes_all_items_when_items_is_empty_array(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        PrescriptionItem::factory()->count(2)->create(['prescription_id' => $prescription->id]);

        $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => '2026-09-02 11:00:00',
                'items'         => [],
            ]);

        $this->assertCount(0, $prescription->fresh()->items);
    }

    public function test_cannot_update_sent_to_pharmacy_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit, ['status' => 'sent_to_pharmacy']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => '2026-09-02 11:00:00',
                'doctor_notes'  => 'Should fail.',
            ]);

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'Only draft prescriptions can be updated.');
    }

    public function test_cannot_update_completed_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit, ['status' => 'completed']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => '2026-09-02 11:00:00',
                'doctor_notes'  => 'Should fail.',
            ]);

        $response->assertUnprocessable();
    }

    public function test_cannot_update_cancelled_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit, ['status' => 'cancelled']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => '2026-09-02 11:00:00',
            ]);

        $response->assertUnprocessable();
    }

    public function test_doctor_cannot_update_another_clinics_prescription(): void
    {
        $clinic            = $this->makeClinic();
        $doctor            = $this->doctor($clinic);
        $otherClinic       = $this->makeClinic();
        $otherDoctor       = $this->doctor($otherClinic);
        $otherPatient      = $this->patient($otherClinic);
        $otherVisit        = $this->visit($otherClinic, $otherPatient, $otherDoctor);
        $otherPrescription = $this->prescription($otherClinic, $otherPatient, $otherDoctor, $otherVisit);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$otherPrescription->id}", [
                'prescribed_at' => '2026-09-02 11:00:00',
                'doctor_notes'  => 'Hacked.',
            ]);

        $response->assertForbidden();
    }

    public function test_update_does_not_change_clinic_patient_visit_or_doctor(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => '2026-09-02 11:00:00',
                'doctor_notes'  => 'Some notes',
            ]);

        $prescription->refresh();

        $this->assertEquals($clinic->id, $prescription->clinic_id);
        $this->assertEquals($patient->id, $prescription->patient_id);
        $this->assertEquals($visit->id, $prescription->visit_id);
        $this->assertEquals($doctor->id, $prescription->doctor_id);
    }

    // -----------------------------------------------------------------------
    // Patient prescription history
    // -----------------------------------------------------------------------

    public function test_doctor_can_view_patient_prescription_history(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);

        $visit1 = $this->visit($clinic, $patient, $doctor);
        $visit2 = $this->visit($clinic, $patient, $doctor);
        $visit3 = $this->visit($clinic, $patient, $doctor);

        $this->prescription($clinic, $patient, $doctor, $visit1);
        $this->prescription($clinic, $patient, $doctor, $visit2);
        $this->prescription($clinic, $patient, $doctor, $visit3);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}/prescriptions");

        $response->assertOk()
            ->assertJsonStructure(['data', 'links', 'meta']);

        $this->assertCount(3, $response->json('data'));
    }

    public function test_prescription_history_is_newest_first(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);

        $visit1 = $this->visit($clinic, $patient, $doctor);
        $visit2 = $this->visit($clinic, $patient, $doctor);
        $visit3 = $this->visit($clinic, $patient, $doctor);

        $this->prescription($clinic, $patient, $doctor, $visit1, ['prescribed_at' => '2026-01-01 09:00:00']);
        $this->prescription($clinic, $patient, $doctor, $visit2, ['prescribed_at' => '2026-06-15 09:00:00']);
        $this->prescription($clinic, $patient, $doctor, $visit3, ['prescribed_at' => '2026-09-01 09:00:00']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}/prescriptions");

        $dates = collect($response->json('data'))->pluck('prescribed_at');
        $this->assertTrue($dates[0] > $dates[1]);
        $this->assertTrue($dates[1] > $dates[2]);
    }

    public function test_prescription_history_only_returns_this_patients_prescriptions(): void
    {
        $clinic   = $this->makeClinic();
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);
        $patient2 = $this->patient($clinic);

        $visit1 = $this->visit($clinic, $patient, $doctor);
        $visit2 = $this->visit($clinic, $patient2, $doctor);
        $visit3 = $this->visit($clinic, $patient2, $doctor);

        $this->prescription($clinic, $patient, $doctor, $visit1);
        $this->prescription($clinic, $patient2, $doctor, $visit2);
        $this->prescription($clinic, $patient2, $doctor, $visit3);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}/prescriptions");

        $this->assertCount(1, $response->json('data'));
    }

    public function test_prescription_history_includes_visit_and_doctor(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $this->prescription($clinic, $patient, $doctor, $visit);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}/prescriptions");

        $response->assertOk()
            ->assertJsonPath('data.0.visit.id', $visit->id)
            ->assertJsonPath('data.0.doctor.id', $doctor->id);
    }

    public function test_doctor_cannot_view_prescription_history_of_another_clinics_patient(): void
    {
        $clinic      = $this->makeClinic();
        $doctor      = $this->doctor($clinic);
        $otherClinic = $this->makeClinic();
        $otherPatient = $this->patient($otherClinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$otherPatient->id}/prescriptions");

        $response->assertForbidden();
    }

    // -----------------------------------------------------------------------
    // Role and auth restrictions
    // -----------------------------------------------------------------------

    public function test_pharmacy_cannot_create_a_prescription(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);
        $visit    = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/visits/{$visit->id}/prescriptions", [
                'prescribed_at' => '2026-09-02 10:00:00',
            ]);

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_update_a_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $pharmacy     = $this->pharmacy($clinic);
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => '2026-09-02 11:00:00',
                'doctor_notes'  => 'Hacked.',
            ]);

        $response->assertForbidden();
    }

    public function test_unauthenticated_cannot_create_prescription(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->postJson("/api/visits/{$visit->id}/prescriptions", [
            'prescribed_at' => '2026-09-02 10:00:00',
        ]);

        $response->assertUnauthorized();
    }

    public function test_unauthenticated_cannot_view_prescription(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $patient      = $this->patient($clinic);
        $visit        = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        $response = $this->getJson("/api/prescriptions/{$prescription->id}");

        $response->assertUnauthorized();
    }

    public function test_unauthenticated_cannot_view_prescription_history(): void
    {
        $clinic  = $this->makeClinic();
        $patient = $this->patient($clinic);

        $response = $this->getJson("/api/patients/{$patient->id}/prescriptions");

        $response->assertUnauthorized();
    }
}
