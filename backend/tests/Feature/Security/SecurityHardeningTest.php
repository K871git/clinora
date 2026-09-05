<?php

namespace Tests\Feature\Security;

use App\Models\Clinic;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\User;
use App\Models\Visit;
use App\Services\Prescription\PrescriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
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

    private function prescription(Clinic $clinic, Patient $patient, User $doctor, Visit $visit): Prescription
    {
        return Prescription::factory()->forClinic($clinic, $patient, $doctor, $visit)->create();
    }

    // -----------------------------------------------------------------------
    // Inactive user — per-request enforcement
    // -----------------------------------------------------------------------

    public function test_inactive_doctor_is_blocked_from_protected_routes(): void
    {
        $user = User::factory()->doctor()->inactive()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/patients');

        $response->assertForbidden()
            ->assertJson(['message' => 'Account is inactive.']);
    }

    public function test_inactive_pharmacy_is_blocked_from_pharmacy_routes(): void
    {
        $user = User::factory()->pharmacy()->inactive()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/pharmacy/prescriptions');

        $response->assertForbidden()
            ->assertJson(['message' => 'Account is inactive.']);
    }

    public function test_inactive_user_is_blocked_from_shared_settings_route(): void
    {
        $user = User::factory()->doctor()->inactive()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/settings');

        $response->assertForbidden()
            ->assertJson(['message' => 'Account is inactive.']);
    }

    public function test_active_user_can_access_routes_normally(): void
    {
        $clinic = $this->makeClinic();
        $doctor = User::factory()->doctor()->create(['clinic_id' => $clinic->id, 'is_active' => true]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/settings');

        $response->assertOk();
    }

    // -----------------------------------------------------------------------
    // Sensitive data not exposed in responses
    // -----------------------------------------------------------------------

    public function test_me_does_not_expose_password(): void
    {
        $user = User::factory()->doctor()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/auth/me');

        $response->assertOk();
        $this->assertArrayNotHasKey('password', $response->json('user'));
    }

    public function test_me_does_not_expose_remember_token(): void
    {
        $user = User::factory()->doctor()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/auth/me');

        $response->assertOk();
        $this->assertArrayNotHasKey('remember_token', $response->json('user'));
    }

    public function test_patient_response_does_not_expose_clinic_id(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}");

        $response->assertOk();
        $this->assertArrayNotHasKey('clinic_id', $response->json('data'));
    }

    // -----------------------------------------------------------------------
    // Cross-clinic isolation
    // -----------------------------------------------------------------------

    public function test_doctor_cannot_view_patient_from_another_clinic(): void
    {
        $clinicA  = $this->makeClinic();
        $clinicB  = $this->makeClinic();
        $doctorA  = $this->doctor($clinicA);
        $patientB = $this->patient($clinicB);

        $response = $this->actingAs($doctorA, 'sanctum')
            ->getJson("/api/patients/{$patientB->id}");

        $response->assertForbidden();
    }

    public function test_doctor_cannot_update_patient_from_another_clinic(): void
    {
        $clinicA  = $this->makeClinic();
        $clinicB  = $this->makeClinic();
        $doctorA  = $this->doctor($clinicA);
        $patientB = $this->patient($clinicB);

        $response = $this->actingAs($doctorA, 'sanctum')
            ->putJson("/api/patients/{$patientB->id}", [
                'name'   => 'Hacker',
                'mobile' => '9999999999',
            ]);

        $response->assertForbidden();
    }

    public function test_doctor_cannot_view_visit_from_another_clinic(): void
    {
        $clinicA  = $this->makeClinic();
        $clinicB  = $this->makeClinic();
        $doctorA  = $this->doctor($clinicA);
        $doctorB  = $this->doctor($clinicB);
        $patientB = $this->patient($clinicB);
        $visitB   = $this->visit($clinicB, $patientB, $doctorB);

        $response = $this->actingAs($doctorA, 'sanctum')
            ->getJson("/api/visits/{$visitB->id}");

        $response->assertForbidden();
    }

    public function test_doctor_cannot_create_prescription_on_another_clinics_visit(): void
    {
        $clinicA  = $this->makeClinic();
        $clinicB  = $this->makeClinic();
        $doctorA  = $this->doctor($clinicA);
        $doctorB  = $this->doctor($clinicB);
        $patientB = $this->patient($clinicB);
        $visitB   = $this->visit($clinicB, $patientB, $doctorB);

        $response = $this->actingAs($doctorA, 'sanctum')
            ->postJson("/api/visits/{$visitB->id}/prescriptions", [
                'prescribed_at' => now()->toDateString(),
            ]);

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_view_prescription_from_another_clinic(): void
    {
        $clinicA       = $this->makeClinic();
        $clinicB       = $this->makeClinic();
        $pharmacyA     = $this->pharmacy($clinicA);
        $doctorB       = $this->doctor($clinicB);
        $patientB      = $this->patient($clinicB);
        $visitB        = $this->visit($clinicB, $patientB, $doctorB);
        $prescriptionB = Prescription::factory()
            ->forClinic($clinicB, $patientB, $doctorB, $visitB)
            ->sent()
            ->create();

        $response = $this->actingAs($pharmacyA, 'sanctum')
            ->getJson("/api/pharmacy/prescriptions/{$prescriptionB->id}");

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_complete_prescription_from_another_clinic(): void
    {
        $clinicA       = $this->makeClinic();
        $clinicB       = $this->makeClinic();
        $pharmacyA     = $this->pharmacy($clinicA);
        $doctorB       = $this->doctor($clinicB);
        $patientB      = $this->patient($clinicB);
        $visitB        = $this->visit($clinicB, $patientB, $doctorB);
        $prescriptionB = Prescription::factory()
            ->forClinic($clinicB, $patientB, $doctorB, $visitB)
            ->sent()
            ->create();

        $response = $this->actingAs($pharmacyA, 'sanctum')
            ->postJson("/api/pharmacy/prescriptions/{$prescriptionB->id}/complete");

        $response->assertForbidden();
    }

    // -----------------------------------------------------------------------
    // Status transition protection
    // -----------------------------------------------------------------------

    public function test_completed_prescription_cannot_be_updated(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);
        $prescription = Prescription::factory()
            ->forClinic($clinic, $patient, $doctor, $visit)
            ->completed()
            ->create();

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => now()->toDateString(),
            ]);

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'Only draft prescriptions can be updated.');
    }

    public function test_completed_prescription_cannot_be_sent_to_pharmacy(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);
        $prescription = Prescription::factory()
            ->forClinic($clinic, $patient, $doctor, $visit)
            ->completed()
            ->create();

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/prescriptions/{$prescription->id}/send");

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'Only draft prescriptions can be sent to pharmacy.');
    }

    public function test_sent_prescription_cannot_be_updated(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);
        $prescription = Prescription::factory()
            ->forClinic($clinic, $patient, $doctor, $visit)
            ->sent()
            ->create();

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => now()->toDateString(),
            ]);

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'Only draft prescriptions can be updated.');
    }

    public function test_sent_prescription_cannot_be_sent_again(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);
        $prescription = Prescription::factory()
            ->forClinic($clinic, $patient, $doctor, $visit)
            ->sent()
            ->create();

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/prescriptions/{$prescription->id}/send");

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'Only draft prescriptions can be sent to pharmacy.');
    }

    // -----------------------------------------------------------------------
    // Concurrent sendToPharmacy protection
    // -----------------------------------------------------------------------

    public function test_concurrent_send_to_pharmacy_is_atomic(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        $service = app(PrescriptionService::class);

        $result1 = $service->sendToPharmacy($prescription);
        $this->assertTrue($result1);

        // Second call hits the DB WHERE status='draft' guard — returns false
        $result2 = $service->sendToPharmacy($prescription);
        $this->assertFalse($result2);

        $this->assertEquals('sent_to_pharmacy', $prescription->fresh()->status);
    }

    // -----------------------------------------------------------------------
    // Prescription response includes pharmacy workflow timestamps
    // -----------------------------------------------------------------------

    public function test_prescription_response_includes_sent_at_timestamp(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);
        $prescription = Prescription::factory()
            ->forClinic($clinic, $patient, $doctor, $visit)
            ->sent()
            ->create(['sent_to_pharmacy_at' => now()]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/prescriptions/{$prescription->id}");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['sent_to_pharmacy_at', 'completed_at', 'completed_by']]);

        $this->assertNotNull($response->json('data.sent_to_pharmacy_at'));
    }

    public function test_prescription_response_includes_completion_fields_when_completed(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);
        $visit    = $this->visit($clinic, $patient, $doctor);
        $prescription = Prescription::factory()
            ->forClinic($clinic, $patient, $doctor, $visit)
            ->sent()
            ->create();

        $this->actingAs($pharmacy, 'sanctum')
            ->postJson("/api/pharmacy/prescriptions/{$prescription->id}/complete");

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/prescriptions/{$prescription->id}");

        $response->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertNotNull($response->json('data.completed_at'));
        $this->assertEquals($pharmacy->id, $response->json('data.completed_by'));
    }

    // -----------------------------------------------------------------------
    // Role restriction — pharmacy cannot perform doctor-only operations
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
                'prescribed_at' => now()->toDateString(),
            ]);

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_update_a_prescription(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);
        $doctor   = $this->doctor($clinic);
        $patient  = $this->patient($clinic);
        $visit    = $this->visit($clinic, $patient, $doctor);
        $prescription = $this->prescription($clinic, $patient, $doctor, $visit);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->putJson("/api/prescriptions/{$prescription->id}", [
                'prescribed_at' => now()->toDateString(),
            ]);

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_view_patient_list(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/api/patients');

        $response->assertForbidden();
    }

    // -----------------------------------------------------------------------
    // Input validation — oversized input protection
    // -----------------------------------------------------------------------

    public function test_consultation_notes_cannot_exceed_max_length(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/patients/{$patient->id}/visits", [
                'visited_at'         => now()->toDateString(),
                'consultation_notes' => str_repeat('x', 10001),
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['consultation_notes']);
    }

    public function test_doctor_notes_cannot_exceed_max_length(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/visits/{$visit->id}/prescriptions", [
                'prescribed_at' => now()->toDateString(),
                'doctor_notes'  => str_repeat('x', 10001),
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['doctor_notes']);
    }

    public function test_medicine_instructions_cannot_exceed_max_length(): void
    {
        $clinic  = $this->makeClinic();
        $doctor  = $this->doctor($clinic);
        $patient = $this->patient($clinic);
        $visit   = $this->visit($clinic, $patient, $doctor);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/visits/{$visit->id}/prescriptions", [
                'prescribed_at' => now()->toDateString(),
                'items'         => [[
                    'medicine_name' => 'Amoxicillin',
                    'instructions'  => str_repeat('x', 2001),
                ]],
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.instructions']);
    }

    public function test_login_email_cannot_exceed_max_length(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email'    => str_repeat('a', 151) . '@test.com',
            'password' => 'secret',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }
}
