<?php

namespace App\Policies;

use App\Models\Prescription;
use App\Models\User;

class PrescriptionPolicy
{
    public function view(User $user, Prescription $prescription): bool
    {
        return (int) $user->clinic_id === (int) $prescription->clinic_id;
    }

    public function update(User $user, Prescription $prescription): bool
    {
        return (int) $user->clinic_id === (int) $prescription->clinic_id;
    }

    public function send(User $user, Prescription $prescription): bool
    {
        return (int) $user->clinic_id === (int) $prescription->clinic_id;
    }

    public function complete(User $user, Prescription $prescription): bool
    {
        return (int) $user->clinic_id === (int) $prescription->clinic_id;
    }

    public function delete(User $user, Prescription $prescription): bool
    {
        return (int) $user->clinic_id === (int) $prescription->clinic_id;
    }
}
