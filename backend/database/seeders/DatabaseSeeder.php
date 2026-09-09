<?php

namespace Database\Seeders;

use App\Models\Clinic;
use App\Models\ClinicSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        /* ── Clinic ─────────────────────────────────────────────────────── */

        $clinic = Clinic::create([
            'name'          => 'Shifa Medical Clinic',
            'doctor_name'   => 'Amol Patil',
            'qualification' => 'MBBS, MD (General Medicine)',
            'address'       => 'Shop No. 5, Saddar Bazaar, Karachi, Sindh',
            'contact'       => '+92 21 3456 7890',
        ]);

        ClinicSetting::create([
            'clinic_id'           => $clinic->id,
            'prescription_header' => null,
            'prescription_footer' => null,
            'show_doctor_contact' => true,
            'show_clinic_contact' => true,
        ]);

        /* ── Doctor ─────────────────────────────────────────────────────── */

        User::create([
            'clinic_id' => $clinic->id,
            'name'      => 'Dr. Amol Patil',
            'email'     => 'doctor@clinora.local',
            'password'  => Hash::make('password'),
            'role'      => 'doctor',
            'is_active' => 1,
        ]);

        /* ── Pharmacy ────────────────────────────────────────────────────── */

        User::create([
            'clinic_id' => $clinic->id,
            'name'      => 'Sonali Shinde',
            'email'     => 'pharmacy@clinora.local',
            'password'  => Hash::make('password'),
            'role'      => 'pharmacy',
            'is_active' => 1,
        ]);
    }
}
