<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Visit;

class VisitPolicy
{
    public function view(User $user, Visit $visit): bool
    {
        return (int) $user->clinic_id === (int) $visit->clinic_id;
    }

    public function update(User $user, Visit $visit): bool
    {
        return (int) $user->clinic_id === (int) $visit->clinic_id;
    }
}
