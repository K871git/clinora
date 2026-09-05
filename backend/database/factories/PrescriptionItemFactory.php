<?php

namespace Database\Factories;

use App\Models\Prescription;
use App\Models\PrescriptionItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PrescriptionItem>
 */
class PrescriptionItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'prescription_id' => Prescription::factory(),
            'medicine_name'   => fake()->words(2, true),
            'dosage'          => fake()->optional()->randomElement(['500mg', '250mg', '100mg', '50mg']),
            'frequency'       => fake()->optional()->randomElement(['Once daily', 'Twice daily', 'Three times daily']),
            'duration'        => fake()->optional()->randomElement(['3 days', '5 days', '7 days', '10 days']),
            'instructions'    => fake()->optional()->sentence(),
            'sort_order'      => 0,
        ];
    }
}
