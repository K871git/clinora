<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VisitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'visited_at'         => $this->visited_at->toISOString(),
            'consultation_notes' => $this->consultation_notes,
            'consultation_fee'   => (float) ($this->consultation_fee ?? 0),
            'status'             => $this->status ?? 'open',
            'invoiced_at'        => $this->invoiced_at?->toISOString(),
            'payment_status'     => $this->payment_status ?? 'unpaid',
            'amount_paid'        => (float) ($this->amount_paid ?? 0),
            'payment_notes'      => $this->payment_notes,
            'medicine_total'     => $this->whenLoaded('prescriptions', function () {
                return (float) $this->prescriptions
                    ->where('status', 'completed')
                    ->sum(fn ($rx) => $rx->relationLoaded('items') ? $rx->items->sum('unit_price') : 0);
            }),
            'prescriptions'      => $this->whenLoaded('prescriptions', fn () =>
                $this->prescriptions->map(fn ($rx) => [
                    'id'           => $rx->id,
                    'status'       => $rx->status,
                    'completed_at' => $rx->completed_at?->toISOString(),
                    'total_amount' => $rx->relationLoaded('items') ? (float) $rx->items->sum('unit_price') : null,
                    'items'        => $rx->relationLoaded('items')
                        ? $rx->items->filter(fn ($i) => $i->unit_price !== null)->values()->map(fn ($item) => [
                            'id'            => $item->id,
                            'medicine_name' => $item->medicine_name,
                            'dosage'        => $item->dosage,
                            'frequency'     => $item->frequency,
                            'duration'      => $item->duration,
                            'unit_price'    => (float) $item->unit_price,
                        ])
                        : [],
                ])
            ),
            'patient'            => $this->whenLoaded('patient', fn () => [
                'id'     => $this->patient->id,
                'name'   => $this->patient->name,
                'mobile' => $this->patient->mobile,
                'age'    => $this->patient->age,
                'gender' => $this->patient->gender,
            ]),
            'doctor'             => $this->whenLoaded('doctor', fn () => [
                'id'   => $this->doctor->id,
                'name' => $this->doctor->name,
            ]),
            'created_at'         => $this->created_at->toISOString(),
        ];
    }
}
