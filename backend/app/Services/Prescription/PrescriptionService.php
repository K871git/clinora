<?php

namespace App\Services\Prescription;

use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\Visit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class PrescriptionService
{
    public function createPrescription(int $clinicId, int $doctorId, Visit $visit, array $data): Prescription
    {
        return DB::transaction(function () use ($clinicId, $doctorId, $visit, $data) {
            $prescription = Prescription::create([
                'clinic_id'     => $clinicId,
                'patient_id'    => $visit->patient_id,
                'visit_id'      => $visit->id,
                'doctor_id'     => $doctorId,
                'prescribed_at' => $data['prescribed_at'],
                'doctor_notes'  => $data['doctor_notes'] ?? null,
                'status'        => 'draft',
            ]);

            if (!empty($data['items'])) {
                $this->syncItems($prescription, $data['items'], $clinicId);
            }

            return $prescription;
        });
    }

    public function updatePrescription(Prescription $prescription, array $data): Prescription
    {
        return DB::transaction(function () use ($prescription, $data) {
            $prescription->update([
                'prescribed_at' => $data['prescribed_at'],
                'doctor_notes'  => $data['doctor_notes'] ?? null,
            ]);

            if (array_key_exists('items', $data)) {
                $this->syncItems($prescription, $data['items'] ?? [], $prescription->clinic_id);
            }

            return $prescription->fresh();
        });
    }

    public function getClinicPrescriptions(int $clinicId, array $filters = []): LengthAwarePaginator
    {
        $query = Prescription::where('clinic_id', $clinicId)
            ->with(['patient', 'doctor', 'items'])
            ->orderBy('prescribed_at', 'desc');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['q'])) {
            $query->whereHas('patient', fn ($q) => $q
                ->where('name', 'like', '%' . $filters['q'] . '%')
                ->orWhere('mobile', 'like', '%' . $filters['q'] . '%')
            );
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 1000);
        return $query->paginate($perPage);
    }

    public function getPatientHistory(int $clinicId, Patient $patient): LengthAwarePaginator
    {
        return Prescription::where('clinic_id', $clinicId)
            ->where('patient_id', $patient->id)
            ->with(['visit', 'doctor'])
            ->orderBy('prescribed_at', 'desc')
            ->paginate(10);
    }

    public function sendToPharmacy(Prescription $prescription): bool
    {
        $updated = DB::table('prescriptions')
            ->where('id', $prescription->id)
            ->where('status', 'draft')
            ->update([
                'status'              => 'sent_to_pharmacy',
                'sent_to_pharmacy_at' => now(),
                'updated_at'          => now(),
            ]);

        return $updated > 0;
    }

    public function getPharmacyStats(int $clinicId): array
    {
        return [
            'pending'    => Prescription::where('clinic_id', $clinicId)->where('status', 'sent_to_pharmacy')->count(),
            'dispensing' => Prescription::where('clinic_id', $clinicId)->where('status', 'dispensing')->count(),
            'today_done' => Prescription::where('clinic_id', $clinicId)
                ->where('status', 'completed')
                ->whereDate('completed_at', today())
                ->count(),
        ];
    }

    public function getPendingPrescriptions(int $clinicId, ?string $search = null): LengthAwarePaginator
    {
        $query = Prescription::where('clinic_id', $clinicId)
            ->whereIn('status', ['sent_to_pharmacy', 'dispensing'])
            ->with(['patient', 'doctor', 'items'])
            ->orderBy('prescribed_at', 'desc');

        if ($search) {
            $query->whereHas('patient', fn ($q) => $q
                ->where('name', 'like', '%' . $search . '%')
                ->orWhere('mobile', 'like', '%' . $search . '%')
            );
        }

        return $query->paginate(100);
    }

    public function getCompletedPrescriptions(int $clinicId, ?string $search = null): LengthAwarePaginator
    {
        $query = Prescription::where('clinic_id', $clinicId)
            ->where('status', 'completed')
            ->with(['patient', 'doctor', 'items'])
            ->orderBy('completed_at', 'desc');

        if ($search) {
            $query->whereHas('patient', fn ($q) => $q
                ->where('name', 'like', '%' . $search . '%')
                ->orWhere('mobile', 'like', '%' . $search . '%')
            );
        }

        return $query->paginate(50);
    }

    public function startDispensing(Prescription $prescription): bool
    {
        $updated = DB::table('prescriptions')
            ->where('id', $prescription->id)
            ->where('status', 'sent_to_pharmacy')
            ->update([
                'status'       => 'dispensing',
                'dispensed_at' => now(),
                'updated_at'   => now(),
            ]);

        return $updated > 0;
    }

    public function completePrescription(Prescription $prescription, int $userId, array $itemPrices = []): bool
    {
        return DB::transaction(function () use ($prescription, $userId, $itemPrices) {
            if (!empty($itemPrices)) {
                $validIds = $prescription->items()->pluck('id')->flip();
                foreach ($itemPrices as $entry) {
                    if (isset($entry['id']) && $validIds->has($entry['id'])) {
                        PrescriptionItem::where('id', $entry['id'])
                            ->update(['unit_price' => isset($entry['unit_price']) ? (float) $entry['unit_price'] : null]);
                    }
                }
            }

            $updated = DB::table('prescriptions')
                ->where('id', $prescription->id)
                ->whereIn('status', ['sent_to_pharmacy', 'dispensing'])
                ->update([
                    'status'       => 'completed',
                    'completed_at' => now(),
                    'completed_by' => $userId,
                    'updated_at'   => now(),
                ]);

            if ($updated > 0) {
                // Decrement stock for each dispensed medicine (never below 0)
                $names = $prescription->items()->pluck('medicine_name');
                foreach ($names as $name) {
                    DB::table('medicines')
                        ->where('clinic_id', $prescription->clinic_id)
                        ->whereRaw('LOWER(name) = ?', [strtolower($name)])
                        ->where('quantity', '>', 0)
                        ->decrement('quantity');
                }
            }

            return $updated > 0;
        });
    }

    public function deletePrescription(Prescription $prescription): void
    {
        DB::transaction(function () use ($prescription) {
            $prescription->items()->delete();
            $prescription->delete();
        });
    }

    private function syncItems(Prescription $prescription, array $items, int $clinicId): void
    {
        $prescription->items()->delete();

        foreach ($items as $item) {
            $name = $item['medicine_name'];

            // Auto-register medicine in the clinic library if not already present
            Medicine::firstOrCreate(
                ['clinic_id' => $clinicId, 'name' => $name],
                ['quantity' => 0]
            );

            $prescription->items()->create([
                'medicine_name' => $name,
                'dosage'        => $item['dosage'] ?? null,
                'frequency'     => $item['frequency'] ?? null,
                'duration'      => $item['duration'] ?? null,
                'instructions'  => $item['instructions'] ?? null,
                'sort_order'    => $item['sort_order'] ?? 0,
            ]);
        }
    }
}
