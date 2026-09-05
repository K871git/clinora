<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrescriptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'prescribed_at' => $this->prescribed_at->toISOString(),
            'doctor_notes'  => $this->doctor_notes,
            'status'              => $this->status,
            'sent_to_pharmacy_at' => $this->sent_to_pharmacy_at?->toISOString(),
            'dispensed_at'        => $this->dispensed_at?->toISOString(),
            'completed_at'        => $this->completed_at?->toISOString(),
            'completed_by'        => $this->completed_by,
            'patient'       => $this->whenLoaded('patient', fn () => [
                'id'            => $this->patient->id,
                'name'          => $this->patient->name,
                'mobile'        => $this->patient->mobile,
                'age'           => $this->patient->age,
                'gender'        => $this->patient->gender,
                'date_of_birth' => $this->patient->date_of_birth?->toDateString(),
            ]),
            'visit'         => $this->whenLoaded('visit', fn () => [
                'id'         => $this->visit->id,
                'visited_at' => $this->visit->visited_at->toISOString(),
            ]),
            'doctor'        => $this->whenLoaded('doctor', fn () => [
                'id'   => $this->doctor->id,
                'name' => $this->doctor->name,
            ]),
            'items'         => $this->whenLoaded('items', fn () =>
                PrescriptionItemResource::collection($this->items)
            ),
            'total_amount'  => $this->whenLoaded('items', function () {
                $hasPrice = $this->items->contains(fn ($i) => $i->unit_price !== null);
                return $hasPrice ? (float) $this->items->sum('unit_price') : null;
            }),
            'created_at'    => $this->created_at->toISOString(),
        ];
    }
}
