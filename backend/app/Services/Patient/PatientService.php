<?php

namespace App\Services\Patient;

use App\Models\Patient;
use App\Models\Visit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class PatientService
{
    /**
     * Paginated, filterable, sortable patient list.
     * Used by the patient list page and all /patients index calls.
     */
    public function list(
        int     $clinicId,
        ?string $query   = null,
        string  $sortBy  = 'name',
        string  $sortDir = 'asc',
        string  $gender  = '',
        bool    $isNew   = false,
        int     $perPage = 15,
    ): LengthAwarePaginator {
        $q = trim((string) $query);

        $allowed = ['name', 'created_at', 'last_visit_at'];
        $sortBy  = in_array($sortBy, $allowed) ? $sortBy : 'name';
        $sortDir = $sortDir === 'desc' ? 'desc' : 'asc';

        $lastVisitSub = Visit::select('visited_at')
            ->whereColumn('patient_id', 'patients.id')
            ->orderByDesc('visited_at')
            ->limit(1);

        $builder = Patient::where('clinic_id', $clinicId)
            ->addSelect(['last_visit_at' => $lastVisitSub]);

        if ($q !== '') {
            $builder->where(function ($sql) use ($q) {
                $sql->where('name', 'like', "%{$q}%")
                    ->orWhere('mobile', 'like', "%{$q}%");
            });
        }

        if ($gender !== '') {
            $builder->where('gender', $gender);
        }

        if ($isNew) {
            $builder->where('created_at', '>=', now()->subDays(2));
        }

        if ($sortBy === 'last_visit_at') {
            // NULL (never visited) always appears last regardless of direction
            $builder->orderByRaw('last_visit_at IS NULL ASC, last_visit_at ' . $sortDir);
        } else {
            $builder->orderBy($sortBy, $sortDir);
        }

        return $builder->paginate($perPage);
    }

    /**
     * Attempt to create a patient.
     *
     * Returns an array with two keys:
     *   'duplicate' => bool   — true when an existing patient was found
     *   'patient'   => Patient
     */
    public function createPatient(int $clinicId, array $data): array
    {
        $existing = $this->findDuplicateByMobile($clinicId, $data['mobile']);

        if ($existing) {
            return ['duplicate' => true, 'patient' => $existing];
        }

        $patient = Patient::create(array_merge($data, ['clinic_id' => $clinicId]));

        return ['duplicate' => false, 'patient' => $patient];
    }

    public function updatePatient(Patient $patient, array $data): Patient
    {
        $patient->update($data);

        return $patient->fresh();
    }

    private function findDuplicateByMobile(int $clinicId, string $mobile): ?Patient
    {
        return Patient::where('clinic_id', $clinicId)
            ->where('mobile', $mobile)
            ->first();
    }
}
