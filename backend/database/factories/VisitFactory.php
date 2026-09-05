<?php

namespace Database\Factories;

use App\Models\Clinic;
use App\Models\Patient;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Visit>
 */
class VisitFactory extends Factory
{
    public function definition(): array
    {
        $clinic  = Clinic::factory()->create();
        $patient = Patient::factory()->create(['clinic_id' => $clinic->id]);
        $doctor  = User::factory()->doctor()->create(['clinic_id' => $clinic->id]);

        return [
            'clinic_id'          => $clinic->id,
            'patient_id'         => $patient->id,
            'doctor_id'          => $doctor->id,
            'visited_at'         => fake()->dateTimeBetween('-1 year', 'now'),
            'consultation_notes' => fake()->optional()->sentence(),
        ];
    }

    public function forClinic(Clinic $clinic, Patient $patient, User $doctor): static
    {
        return $this->state([
            'clinic_id'  => $clinic->id,
            'patient_id' => $patient->id,
            'doctor_id'  => $doctor->id,
        ]);
    }
}
