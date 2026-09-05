<?php

namespace Tests\Feature\Visit;

use App\Models\Clinic;
use App\Models\Patient;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VisitTest extends TestCase
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

    // -----------------------------------------------------------------------
    // Create visit
    // -----------------------------------------------------------------------

    public function test_doctor_can_create_a_visit_for_patient(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/patients/{$patient->id}/visits", [
                'visited_at'         => '2026-09-02 10:00:00',
                'consultation_notes' => 'Patient has fever and cough.',
            ]);

        $response->assertCreated()
            ->assertJsonStructure(['data' => [
                'id', 'visited_at', 'consultation_notes', 'patient', 'doctor', 'created_at',
            ]]);

        $this->assertDatabaseHas('visits', [
            'clinic_id'  => $clinic->id,
            'patient_id' => $patient->id,
            'doctor_id'  => $doctor->id,
        ]);
    }

    public function test_visit_stores_clinic_and_doctor_from_authenticated_user(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);

        $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/patients/{$patient->id}/visits", [
                'visited_at' => '2026-09-02 10:00:00',
            ]);

        $visit = Visit::where('patient_id', $patient->id)->first();

        $this->assertEquals($clinic->id, $visit->clinic_id);
        $this->assertEquals($doctor->id, $visit->doctor_id);
    }

    public function test_visit_creation_requires_visited_at(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/patients/{$patient->id}/visits", []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['visited_at']);
    }

    public function test_doctor_cannot_create_visit_for_another_clinics_patient(): void
    {
        $clinic       = $this->makeClinic();
        $doctor       = $this->doctor($clinic);
        $otherClinic  = $this->makeClinic();
        $otherPatient = $this->patient($otherClinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/patients/{$otherPatient->id}/visits", [
                'visited_at' => '2026-09-02 10:00:00',
            ]);

        $response->assertForbidden();
    }

    public function test_create_visit_returns_404_for_nonexistent_patient(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/patients/99999/visits', [
                'visited_at' => '2026-09-02 10:00:00',
            ]);

        $response->assertNotFound();
    }

    // -----------------------------------------------------------------------
    // View visit
    // -----------------------------------------------------------------------

    public function test_doctor_can_view_a_visit(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/visits/{$visit->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', $visit->id)
            ->assertJsonStructure(['data' => [
                'id', 'visited_at', 'consultation_notes', 'patient', 'doctor',
            ]]);
    }

    public function test_visit_detail_includes_patient_and_doctor_info(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/visits/{$visit->id}");

        $response->assertOk()
            ->assertJsonPath('data.patient.id', $patient->id)
            ->assertJsonPath('data.patient.name', $patient->name)
            ->assertJsonPath('data.doctor.id', $doctor->id)
            ->assertJsonPath('data.doctor.name', $doctor->name);
    }

    public function test_doctor_cannot_view_another_clinics_visit(): void
    {
        $clinic      = $this->makeClinic();
        $doctor      = $this->doctor($clinic);
        $otherClinic = $this->makeClinic();
        $otherDoctor = $this->doctor($otherClinic);
        $otherPatient = $this->patient($otherClinic);
        $otherVisit  = $this->visit($otherClinic, $otherPatient, $otherDoctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/visits/{$otherVisit->id}");

        $response->assertForbidden();
    }

    public function test_show_visit_returns_404_for_nonexistent_visit(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/visits/99999');

        $response->assertNotFound();
    }

    // -----------------------------------------------------------------------
    // Update visit
    // -----------------------------------------------------------------------

    public function test_doctor_can_update_visit_consultation_notes(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/visits/{$visit->id}", [
                'visited_at'         => '2026-09-02 11:00:00',
                'consultation_notes' => 'Updated notes after re-examination.',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.consultation_notes', 'Updated notes after re-examination.');

        $this->assertDatabaseHas('visits', [
            'id'                 => $visit->id,
            'consultation_notes' => 'Updated notes after re-examination.',
        ]);
    }

    public function test_update_does_not_change_clinic_patient_or_doctor(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/visits/{$visit->id}", [
                'visited_at'         => '2026-09-02 11:00:00',
                'consultation_notes' => 'Some notes',
            ]);

        $visit->refresh();
        $this->assertEquals($clinic->id, $visit->clinic_id);
        $this->assertEquals($patient->id, $visit->patient_id);
        $this->assertEquals($doctor->id, $visit->doctor_id);
    }

    public function test_doctor_cannot_update_another_clinics_visit(): void
    {
        $clinic      = $this->makeClinic();
        $doctor      = $this->doctor($clinic);
        $otherClinic = $this->makeClinic();
        $otherDoctor = $this->doctor($otherClinic);
        $otherPatient = $this->patient($otherClinic);
        $otherVisit  = $this->visit($otherClinic, $otherPatient, $otherDoctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/visits/{$otherVisit->id}", [
                'visited_at'         => '2026-09-02 11:00:00',
                'consultation_notes' => 'Hacked notes',
            ]);

        $response->assertForbidden();
    }

    // -----------------------------------------------------------------------
    // Patient visit history
    // -----------------------------------------------------------------------

    public function test_doctor_can_view_patient_visit_history(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);

        Visit::factory()->forClinic($clinic, $patient, $doctor)->count(3)->create();

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}/visits");

        $response->assertOk()
            ->assertJsonStructure(['data', 'links', 'meta']);

        $this->assertCount(3, $response->json('data'));
    }

    public function test_visit_history_is_ordered_newest_first(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);

        Visit::factory()->forClinic($clinic, $patient, $doctor)->create(['visited_at' => '2026-01-01 09:00:00']);
        Visit::factory()->forClinic($clinic, $patient, $doctor)->create(['visited_at' => '2026-06-15 09:00:00']);
        Visit::factory()->forClinic($clinic, $patient, $doctor)->create(['visited_at' => '2026-09-01 09:00:00']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}/visits");

        $dates = collect($response->json('data'))->pluck('visited_at');
        $this->assertTrue($dates[0] > $dates[1]);
        $this->assertTrue($dates[1] > $dates[2]);
    }

    public function test_visit_history_only_returns_this_patients_visits(): void
    {
        $clinic   = $this->makeClinic();
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);
        $patient2 = $this->patient($clinic);

        Visit::factory()->forClinic($clinic, $patient, $doctor)->count(2)->create();
        Visit::factory()->forClinic($clinic, $patient2, $doctor)->count(3)->create();

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}/visits");

        $this->assertCount(2, $response->json('data'));
    }

    public function test_doctor_cannot_view_visit_history_of_another_clinics_patient(): void
    {
        $clinic      = $this->makeClinic();
        $doctor      = $this->doctor($clinic);
        $otherClinic = $this->makeClinic();
        $otherPatient = $this->patient($otherClinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$otherPatient->id}/visits");

        $response->assertForbidden();
    }

    // -----------------------------------------------------------------------
    // Role restrictions
    // -----------------------------------------------------------------------

    public function test_pharmacy_cannot_create_a_visit(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);
        $patient  = $this->patient($clinic);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/patients/{$patient->id}/visits", [
                'visited_at' => '2026-09-02 10:00:00',
            ]);

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_update_a_visit(): void
    {
        $clinic      = $this->makeClinic();
        $pharmacy    = $this->pharmacy($clinic);
        $doctor      = $this->doctor($clinic);
        $patient     = $this->patient($clinic);
        $visit       = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->putJson("/api/visits/{$visit->id}", [
                'visited_at'         => '2026-09-02 11:00:00',
                'consultation_notes' => 'Hacked',
            ]);

        $response->assertForbidden();
    }

    public function test_unauthenticated_cannot_create_visit(): void
    {
        $clinic  = $this->makeClinic();
        $patient = $this->patient($clinic);

        $response = $this->postJson("/api/patients/{$patient->id}/visits", [
            'visited_at' => '2026-09-02 10:00:00',
        ]);

        $response->assertUnauthorized();
    }

    public function test_unauthenticated_cannot_view_visit_history(): void
    {
        $clinic  = $this->makeClinic();
        $patient = $this->patient($clinic);

        $response = $this->getJson("/api/patients/{$patient->id}/visits");

        $response->assertUnauthorized();
    }
}
