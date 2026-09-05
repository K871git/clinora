<?php

namespace Tests\Feature\Settings;

use App\Models\Clinic;
use App\Models\ClinicSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClinicSettingsTest extends TestCase
{
    use RefreshDatabase;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function makeClinic(array $attrs = []): Clinic
    {
        return Clinic::factory()->create($attrs);
    }

    private function doctor(Clinic $clinic): User
    {
        return User::factory()->doctor()->create(['clinic_id' => $clinic->id]);
    }

    private function pharmacy(Clinic $clinic): User
    {
        return User::factory()->pharmacy()->create(['clinic_id' => $clinic->id]);
    }

    private function clinicPayload(array $override = []): array
    {
        return array_merge([
            'name'          => 'Sunrise Clinic',
            'doctor_name'   => 'Dr. Arun Sharma',
            'qualification' => 'MBBS, MD',
            'address'       => '12 Main Street, Mumbai',
            'contact'       => '+91-9876543210',
            'logo_path'     => 'logos/sunrise.png',
        ], $override);
    }

    private function prescriptionSettingsPayload(array $override = []): array
    {
        return array_merge([
            'prescription_header' => 'Sunrise Clinic | Dr. Arun Sharma',
            'prescription_footer' => 'Valid for 30 days',
            'show_doctor_contact' => true,
            'show_clinic_contact' => true,
        ], $override);
    }

    // -----------------------------------------------------------------------
    // View settings
    // -----------------------------------------------------------------------

    public function test_doctor_can_view_clinic_settings(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/settings');

        $response->assertOk()
            ->assertJsonStructure(['data' => [
                'clinic' => ['id', 'name', 'doctor_name', 'qualification', 'address', 'contact', 'logo_path'],
                'prescription_settings',
            ]]);
    }

    public function test_pharmacy_can_view_clinic_settings(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/api/settings');

        $response->assertOk()
            ->assertJsonStructure(['data' => ['clinic', 'prescription_settings']]);
    }

    public function test_settings_returns_correct_clinic_data(): void
    {
        $clinic = $this->makeClinic(['name' => 'Test Clinic', 'doctor_name' => 'Dr. Test']);
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/settings');

        $response->assertOk()
            ->assertJsonPath('data.clinic.name', 'Test Clinic')
            ->assertJsonPath('data.clinic.doctor_name', 'Dr. Test');
    }

    public function test_settings_returns_prescription_settings_when_they_exist(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        ClinicSetting::create([
            'clinic_id'           => $clinic->id,
            'prescription_header' => 'Custom Header',
            'prescription_footer' => 'Custom Footer',
            'show_doctor_contact' => true,
            'show_clinic_contact' => false,
        ]);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/settings');

        $response->assertOk()
            ->assertJsonPath('data.prescription_settings.prescription_header', 'Custom Header')
            ->assertJsonPath('data.prescription_settings.prescription_footer', 'Custom Footer')
            ->assertJsonPath('data.prescription_settings.show_clinic_contact', false);
    }

    public function test_settings_returns_defaults_when_no_prescription_settings_exist(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/api/settings');

        $response->assertOk();

        $settings = $response->json('data.prescription_settings');
        $this->assertNull($settings['prescription_header']);
        $this->assertNull($settings['prescription_footer']);
        $this->assertTrue($settings['show_doctor_contact']);
        $this->assertTrue($settings['show_clinic_contact']);
    }

    public function test_settings_returns_own_clinic_data_only(): void
    {
        $clinicA = $this->makeClinic(['name' => 'Clinic A']);
        $clinicB = $this->makeClinic(['name' => 'Clinic B']);
        $doctorA = $this->doctor($clinicA);

        $response = $this->actingAs($doctorA, 'sanctum')
            ->getJson('/api/settings');

        $response->assertOk()
            ->assertJsonPath('data.clinic.name', 'Clinic A');

        $this->assertNotEquals('Clinic B', $response->json('data.clinic.name'));
    }

    public function test_unauthenticated_cannot_view_settings(): void
    {
        $response = $this->getJson('/api/settings');

        $response->assertUnauthorized();
    }

    // -----------------------------------------------------------------------
    // Update clinic info
    // -----------------------------------------------------------------------

    public function test_doctor_can_update_clinic_info(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/clinic', $this->clinicPayload());

        $response->assertOk()
            ->assertJsonPath('data.clinic.name', 'Sunrise Clinic')
            ->assertJsonPath('data.clinic.doctor_name', 'Dr. Arun Sharma')
            ->assertJsonPath('data.clinic.qualification', 'MBBS, MD');

        $this->assertDatabaseHas('clinics', [
            'id'          => $clinic->id,
            'name'        => 'Sunrise Clinic',
            'doctor_name' => 'Dr. Arun Sharma',
        ]);
    }

    public function test_update_clinic_response_includes_prescription_settings(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/clinic', $this->clinicPayload());

        $response->assertOk()
            ->assertJsonStructure(['data' => ['clinic', 'prescription_settings']]);
    }

    public function test_update_clinic_requires_name(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/clinic', $this->clinicPayload(['name' => '']));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_update_clinic_requires_doctor_name(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/clinic', $this->clinicPayload(['doctor_name' => '']));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['doctor_name']);
    }

    public function test_update_clinic_enforces_name_max_length(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/clinic', $this->clinicPayload([
                'name' => str_repeat('x', 151),
            ]));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_update_clinic_enforces_contact_max_length(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/clinic', $this->clinicPayload([
                'contact' => str_repeat('1', 31),
            ]));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['contact']);
    }

    public function test_update_clinic_optional_fields_can_be_null(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/clinic', [
                'name'          => 'Basic Clinic',
                'doctor_name'   => 'Dr. Basic',
                'qualification' => null,
                'address'       => null,
                'contact'       => null,
                'logo_path'     => null,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.clinic.qualification', null)
            ->assertJsonPath('data.clinic.contact', null);
    }

    public function test_update_clinic_does_not_affect_other_clinics(): void
    {
        $clinicA = $this->makeClinic(['name' => 'Original A']);
        $clinicB = $this->makeClinic(['name' => 'Original B']);
        $doctorA = $this->doctor($clinicA);

        $this->actingAs($doctorA, 'sanctum')
            ->putJson('/api/settings/clinic', $this->clinicPayload(['name' => 'Updated A']));

        $this->assertDatabaseHas('clinics', ['id' => $clinicB->id, 'name' => 'Original B']);
    }

    // -----------------------------------------------------------------------
    // Update prescription settings
    // -----------------------------------------------------------------------

    public function test_doctor_can_update_prescription_settings(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/prescriptions', $this->prescriptionSettingsPayload());

        $response->assertOk()
            ->assertJsonPath('data.prescription_settings.prescription_header', 'Sunrise Clinic | Dr. Arun Sharma')
            ->assertJsonPath('data.prescription_settings.prescription_footer', 'Valid for 30 days')
            ->assertJsonPath('data.prescription_settings.show_doctor_contact', true)
            ->assertJsonPath('data.prescription_settings.show_clinic_contact', true);
    }

    public function test_prescription_settings_are_created_if_not_exist(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $this->assertDatabaseMissing('clinic_settings', ['clinic_id' => $clinic->id]);

        $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/prescriptions', $this->prescriptionSettingsPayload());

        $this->assertDatabaseHas('clinic_settings', [
            'clinic_id'           => $clinic->id,
            'prescription_header' => 'Sunrise Clinic | Dr. Arun Sharma',
        ]);
    }

    public function test_prescription_settings_update_existing_record(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        ClinicSetting::create([
            'clinic_id'           => $clinic->id,
            'prescription_header' => 'Old Header',
        ]);

        $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/prescriptions', $this->prescriptionSettingsPayload([
                'prescription_header' => 'New Header',
            ]));

        $this->assertDatabaseCount('clinic_settings', 1);
        $this->assertDatabaseHas('clinic_settings', [
            'clinic_id'           => $clinic->id,
            'prescription_header' => 'New Header',
        ]);
    }

    public function test_update_prescription_settings_validates_boolean_fields(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $response = $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/prescriptions', [
                'show_doctor_contact' => 'not-a-boolean',
                'show_clinic_contact' => 'not-a-boolean',
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['show_doctor_contact', 'show_clinic_contact']);
    }

    public function test_prescription_settings_can_disable_contact_display(): void
    {
        $clinic = $this->makeClinic();
        $doctor = $this->doctor($clinic);

        $this->actingAs($doctor, 'sanctum')
            ->putJson('/api/settings/prescriptions', [
                'show_doctor_contact' => false,
                'show_clinic_contact' => false,
            ]);

        $this->assertDatabaseHas('clinic_settings', [
            'clinic_id'           => $clinic->id,
            'show_doctor_contact' => 0,
            'show_clinic_contact' => 0,
        ]);
    }

    // -----------------------------------------------------------------------
    // Authorization
    // -----------------------------------------------------------------------

    public function test_pharmacy_cannot_update_clinic_info(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->putJson('/api/settings/clinic', $this->clinicPayload());

        $response->assertForbidden();
    }

    public function test_pharmacy_cannot_update_prescription_settings(): void
    {
        $clinic   = $this->makeClinic();
        $pharmacy = $this->pharmacy($clinic);

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->putJson('/api/settings/prescriptions', $this->prescriptionSettingsPayload());

        $response->assertForbidden();
    }

    public function test_unauthenticated_cannot_update_clinic_info(): void
    {
        $response = $this->putJson('/api/settings/clinic', $this->clinicPayload());

        $response->assertUnauthorized();
    }

    public function test_unauthenticated_cannot_update_prescription_settings(): void
    {
        $response = $this->putJson('/api/settings/prescriptions', $this->prescriptionSettingsPayload());

        $response->assertUnauthorized();
    }
}
