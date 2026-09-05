<?php

namespace App\Policies;

use App\Models\Patient;
use App\Models\User;

class PatientPolicy
{
    public function view(User $user, Patient $patient): bool
    {
        return (int) $user->clinic_id === (int) $patient->clinic_id;
    }

    public function update(User $user, Patient $patient): bool
    {
        return (int) $user->clinic_id === (int) $patient->clinic_id;
    }
}
