<?php

namespace Tests\Feature\Patient;

use App\Models\Clinic;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PatientTest extends TestCase
{
    use RefreshDatabase;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function doctor(?Clinic $clinic = null): User
    {
        return User::factory()->doctor()->create([
            'clinic_id' => $clinic?->id ?? Clinic::factory()->create()->id,
        ]);
    }

    private function pharmacy(?Clinic $clinic = null): User
    {
        return User::factory()->pharmacy()->create([
            'clinic_id' => $clinic?->id ?? Clinic::factory()->create()->id,
        ]);
    }

    // -----------------------------------------------------------------------
    // Patient creation
    // -----------------------------------------------------------------------

    public function test_doctor_can_register_a_patient(): void
    {
        $doctor = $this->doctor();

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/patients', [
                'name'   => 'Ravi Kumar',
                'mobile' => '9800001111',
            ]);

        $response->assertCreated()
            ->assertJsonStructure(['data' => ['id', 'name', 'mobile', 'created_at']]);

        $this->assertDatabaseHas('patients', [
            'clinic_id' => $doctor->clinic_id,
            'name'      => 'Ravi Kumar',
            'mobile'    => '9800001111',
        ]);
    }

    public function test_patient_is_assigned_to_doctors_clinic(): void
    {
        $doctor = $this->doctor();

        $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/patients', [
                'name'   => 'Test Patient',
                'mobile' => '9800002222',
            ]);

        $patient = Patient::where('mobile', '9800002222')->first();
        $this->assertEquals($doctor->clinic_id, $patient->clinic_id);
    }

    public function test_patient_registration_requires_name(): void
    {
        $doctor = $this->doctor();

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/patients', ['mobile' => '9800003333']);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_patient_registration_requires_mobile(): void
    {
        $doctor = $this->doctor();

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/patients', ['name' => 'Test Patient']);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['mobile']);
    }

    public function test_patient_registration_validates_gender(): void
    {
        $doctor = $this->doctor();

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/patients', [
                'name'   => 'Test Patient',
                'mobile' => '9800004444',
                'gender' => 'unknown',
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['gender']);
    }

    // -----------------------------------------------------------------------
    // Duplicate detection
    // -----------------------------------------------------------------------

    public function test_duplicate_is_detected_by_mobile(): void
    {
        $doctor = $this->doctor();
        $clinic = Clinic::find($doctor->clinic_id);

        Patient::factory()->create([
            'clinic_id' => $clinic->id,
            'name'      => 'Existing Patient',
            'mobile'    => '9800005555',
        ]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/patients', [
                'name'   => 'New Name Same Mobile',
                'mobile' => '9800005555',
            ]);

        $response->assertStatus(409)
            ->assertJson(['message' => 'A patient with this mobile number already exists.'])
            ->assertJsonStructure(['duplicate' => ['id', 'name', 'mobile']]);
    }

    public function test_duplicate_response_includes_existing_patient_data(): void
    {
        $doctor  = $this->doctor();
        $existing = Patient::factory()->create([
            'clinic_id' => $doctor->clinic_id,
            'name'      => 'Existing Patient',
            'mobile'    => '9800006666',
        ]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/patients', [
                'name'   => 'Another Name',
                'mobile' => '9800006666',
            ]);

        $response->assertStatus(409);
        $this->assertEquals($existing->id, $response->json('duplicate.id'));
        $this->assertEquals('Existing Patient', $response->json('duplicate.name'));
    }

    public function test_same_mobile_in_different_clinic_is_not_a_duplicate(): void
    {
        $otherClinic = Clinic::factory()->create();
        Patient::factory()->create([
            'clinic_id' => $otherClinic->id,
            'mobile'    => '9800007777',
        ]);

        $doctor = $this->doctor();

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/patients', [
                'name'   => 'New Patient',
                'mobile' => '9800007777',
            ]);

        $response->assertCreated();
    }

    // -----------------------------------------------------------------------
    // Patient search
    // -----------------------------------------------------------------------

    public function test_doctor_can_search_patients_by_name(): void
    {
        $doctor = $this->doctor();

        Patient::factory()->create(['clinic_id' => $doctor->clinic_id, 'name' => 'Ravi Kumar', 'mobile' => '9000000001']);
        Patient::factory()->create(['clinic_id' => $doctor->clinic_id, 'name' => 'Priya Sharma', 'mobile' => '9000000002']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/patients?q=Ravi');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('Ravi Kumar', $response->json('data.0.name'));
    }

    public function test_doctor_can_search_patients_by_mobile(): void
    {
        $doctor = $this->doctor();

        Patient::factory()->create(['clinic_id' => $doctor->clinic_id, 'name' => 'Patient A', 'mobile' => '9111111111']);
        Patient::factory()->create(['clinic_id' => $doctor->clinic_id, 'name' => 'Patient B', 'mobile' => '9222222222']);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/patients?q=9111111111');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('Patient A', $response->json('data.0.name'));
    }

    public function test_search_with_no_query_returns_patients(): void
    {
        $doctor = $this->doctor();

        Patient::factory()->count(3)->create(['clinic_id' => $doctor->clinic_id]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/patients');

        $response->assertOk();
        $this->assertCount(3, $response->json('data'));
    }

    public function test_search_is_restricted_to_own_clinic(): void
    {
        $doctor = $this->doctor();

        $otherClinic = Clinic::factory()->create();
        Patient::factory()->count(2)->create(['clinic_id' => $otherClinic->id]);
        Patient::factory()->count(1)->create(['clinic_id' => $doctor->clinic_id]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/patients');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }

    // -----------------------------------------------------------------------
    // Patient details
    // -----------------------------------------------------------------------

    public function test_doctor_can_view_patient_details(): void
    {
        $doctor  = $this->doctor();
        $patient = Patient::factory()->create(['clinic_id' => $doctor->clinic_id]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['id', 'name', 'mobile', 'gender', 'address', 'created_at']]);

        $this->assertEquals($patient->id, $response->json('data.id'));
    }

    public function test_doctor_cannot_view_another_clinics_patient(): void
    {
        $doctor      = $this->doctor();
        $otherClinic = Clinic::factory()->create();
        $patient     = Patient::factory()->create(['clinic_id' => $otherClinic->id]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson("/api/patients/{$patient->id}");

        $response->assertForbidden();
    }

    public function test_show_returns_404_for_nonexistent_patient(): void
    {
        $doctor = $this->doctor();

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/patients/99999');

        $response->assertNotFound();
    }

    // -----------------------------------------------------------------------
    // Patient update
    // -----------------------------------------------------------------------

    public function test_doctor_can_update_patient(): void
    {
        $doctor  = $this->doctor();
        $patient = Patient::factory()->create(['clinic_id' => $doctor->clinic_id]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/patients/{$patient->id}", [
                'name'    => 'Updated Name',
                'mobile'  => '9999888877',
                'gender'  => 'male',
                'address' => '123 New Street',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'Updated Name')
            ->assertJsonPath('data.mobile', '9999888877');

        $this->assertDatabaseHas('patients', [
            'id'   => $patient->id,
            'name' => 'Updated Name',
        ]);
    }

    public function test_update_validates_required_fields(): void
    {
        $doctor  = $this->doctor();
        $patient = Patient::factory()->create(['clinic_id' => $doctor->clinic_id]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/patients/{$patient->id}", []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'mobile']);
    }

    public function test_doctor_cannot_update_another_clinics_patient(): void
    {
        $doctor      = $this->doctor();
        $otherClinic = Clinic::factory()->create();
        $patient     = Patient::factory()->create(['clinic_id' => $otherClinic->id]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/patients/{$patient->id}", [
                'name'   => 'Hacked Name',
                'mobile' => '0000000000',
            ]);

        $response->assertForbidden();
    }

    // -----------------------------------------------------------------------
    // Authorization — pharmacy and unauthenticated
    // -----------------------------------------------------------------------

    public function test_pharmacy_cannot_create_patient(): void
    {
        $pharmacy = $this->pharmacy();

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->postJson('/api/patients', [
                'name'   => 'Test',
                'mobile' => '9800009999',
            ]);

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_list_patients(): void
    {
        $pharmacy = $this->pharmacy();

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/api/patients');

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_view_patient_details(): void
    {
        $clinic   = Clinic::factory()->create();
        $pharmacy = $this->pharmacy($clinic);
        $patient  = Patient::factory()->create(['clinic_id' => $clinic->id]);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson("/api/patients/{$patient->id}");

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_update_patient(): void
    {
        $clinic   = Clinic::factory()->create();
        $pharmacy = $this->pharmacy($clinic);
        $patient  = Patient::factory()->create(['clinic_id' => $clinic->id]);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->putJson("/api/patients/{$patient->id}", [
                'name'   => 'Hacked',
                'mobile' => '0000000000',
            ]);

        $response->assertForbidden();
    }

    public function test_unauthenticated_cannot_access_patients(): void
    {
        $response = $this->getJson('/api/patients');

        $response->assertUnauthorized();
    }

    public function test_unauthenticated_cannot_create_patient(): void
    {
        $response = $this->postJson('/api/patients', [
            'name'   => 'Test',
            'mobile' => '9800000000',
        ]);

        $response->assertUnauthorized();
    }
}
