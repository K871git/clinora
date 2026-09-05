<?php

namespace Database\Factories;

use App\Models\Clinic;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Prescription>
 */
class PrescriptionFactory extends Factory
{
    public function definition(): array
    {
        $clinic  = Clinic::factory()->create();
        $patient = Patient::factory()->create(['clinic_id' => $clinic->id]);
        $doctor  = User::factory()->doctor()->create(['clinic_id' => $clinic->id]);
        $visit   = Visit::factory()->forClinic($clinic, $patient, $doctor)->create();

        return [
            'clinic_id'     => $clinic->id,
            'patient_id'    => $patient->id,
            'visit_id'      => $visit->id,
            'doctor_id'     => $doctor->id,
            'prescribed_at' => fake()->dateTimeBetween('-1 year', 'now'),
            'doctor_notes'  => fake()->optional()->sentence(),
            'status'        => 'draft',
        ];
    }

    public function forClinic(Clinic $clinic, Patient $patient, User $doctor, Visit $visit): static
    {
        return $this->state([
            'clinic_id'  => $clinic->id,
            'patient_id' => $patient->id,
            'visit_id'   => $visit->id,
            'doctor_id'  => $doctor->id,
        ]);
    }

    public function sent(): static
    {
        return $this->state(['status' => 'sent_to_pharmacy']);
    }

    public function completed(): static
    {
        return $this->state(['status' => 'completed']);
    }

    public function cancelled(): static
    {
        return $this->state(['status' => 'cancelled']);
    }
}
