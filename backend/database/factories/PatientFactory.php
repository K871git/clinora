<?php

namespace Database\Factories;

use App\Models\Clinic;
use App\Models\Patient;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Patient>
 */
class PatientFactory extends Factory
{
    public function definition(): array
    {
        return [
            'clinic_id'     => Clinic::factory(),
            'name'          => fake()->name(),
            'mobile'        => fake()->numerify('98########'),
            'date_of_birth' => fake()->optional()->dateTimeBetween('-80 years', '-1 year')?->format('Y-m-d'),
            'age'           => fake()->optional()->numberBetween(1, 90),
            'gender'        => fake()->optional()->randomElement(['male', 'female', 'other']),
            'address'       => fake()->optional()->address(),
        ];
    }
}
