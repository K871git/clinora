<?php

namespace App\Services\Settings;

use App\Models\Clinic;
use App\Models\ClinicSetting;

class ClinicSettingsService
{
    public function getClinicWithSettings(int $clinicId): Clinic
    {
        return Clinic::with('settings')->findOrFail($clinicId);
    }

    public function updateClinicInfo(Clinic $clinic, array $data): Clinic
    {
        $clinic->update($data);

        return $clinic->fresh()->load('settings');
    }

    public function updatePrescriptionSettings(Clinic $clinic, array $data): Clinic
    {
        ClinicSetting::updateOrCreate(
            ['clinic_id' => $clinic->id],
            $data,
        );

        return $clinic->fresh()->load('settings');
    }
}
