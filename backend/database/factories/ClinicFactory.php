<?php

namespace Database\Factories;

use App\Models\Clinic;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Clinic>
 */
class ClinicFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'          => fake()->company().' Clinic',
            'doctor_name'   => 'Dr. '.fake()->name(),
            'qualification' => 'MBBS',
            'address'       => fake()->address(),
            'contact'       => fake()->phoneNumber(),
            'logo_path'     => null,
        ];
    }
}
