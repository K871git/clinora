<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrescriptionItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'medicine_name' => $this->medicine_name,
            'dosage'        => $this->dosage,
            'frequency'     => $this->frequency,
            'duration'      => $this->duration,
            'instructions'  => $this->instructions,
            'sort_order'    => $this->sort_order,
            'unit_price'    => $this->unit_price !== null ? (float) $this->unit_price : null,
        ];
    }
}
