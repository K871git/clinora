<?php

namespace Database\Factories;

use App\Models\Clinic;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'clinic_id'      => Clinic::factory(),
            'name'           => fake()->name(),
            'email'          => fake()->unique()->safeEmail(),
            'password'       => static::$password ??= Hash::make('password'),
            'role'           => 'doctor',
            'is_active'      => 1,
            'remember_token' => Str::random(10),
        ];
    }

    public function doctor(): static
    {
        return $this->state(['role' => 'doctor']);
    }

    public function pharmacy(): static
    {
        return $this->state(['role' => 'pharmacy']);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => 0]);
    }
}
