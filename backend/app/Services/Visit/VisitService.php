<?php

namespace App\Services\Visit;

use App\Models\Patient;
use App\Models\Visit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class VisitService
{
    public function createVisit(int $clinicId, int $doctorId, Patient $patient, array $data): Visit
    {
        return Visit::create([
            'clinic_id'          => $clinicId,
            'patient_id'         => $patient->id,
            'doctor_id'          => $doctorId,
            'visited_at'         => $data['visited_at'],
            'consultation_notes' => $data['consultation_notes'] ?? null,
        ]);
    }

    public function getPatientHistory(int $clinicId, Patient $patient): LengthAwarePaginator
    {
        return Visit::where('clinic_id', $clinicId)
            ->where('patient_id', $patient->id)
            ->orderBy('visited_at', 'desc')
            ->paginate(10);
    }

    public function updateVisit(Visit $visit, array $data): Visit
    {
        $visit->update([
            'visited_at'         => $data['visited_at'],
            'consultation_notes' => $data['consultation_notes'] ?? null,
        ]);

        return $visit->fresh();
    }

    public function completeVisit(Visit $visit, ?float $consultationFee = null): Visit
    {
        $data = [
            'status'      => 'completed',
            'invoiced_at' => now(),
        ];

        if ($consultationFee !== null) {
            $data['consultation_fee'] = $consultationFee;
        }

        $visit->update($data);

        return $visit->fresh();
    }
}
