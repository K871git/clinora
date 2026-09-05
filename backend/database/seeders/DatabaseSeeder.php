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
            'name'          => 'Atmajyot Clinic',
            'doctor_name'   => 'Dr. Kunal Sasane',
            'qualification' => 'BHMS (MUHS), Nashik',
            'address'       => 'Mandali, Tal: Karjat, Dist: Ahilyanagar',
            'contact'       => '+91 89992 20511',
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
            'name'      => 'Yash Shinde',
            'email'     => 'pharmacy@clinora.local',
            'password'  => Hash::make('password'),
            'role'      => 'pharmacy',
            'is_active' => 1,
        ]);
    }
}
