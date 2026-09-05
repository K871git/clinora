<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'mobile'        => $this->mobile,
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'age'           => $this->age,
            'gender'        => $this->gender,
            'address'       => $this->address,
            'created_at'    => $this->created_at->toISOString(),
            'last_visit_at' => $this->last_visit_at,
        ];
    }
}
