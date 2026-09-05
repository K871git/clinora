<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MedicineResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'name'         => $this->name,
            'generic_name' => $this->generic_name,
            'category'     => $this->category,
            'unit'         => $this->unit,
            'quantity'     => $this->quantity,
            'price'        => $this->price !== null ? (float) $this->price : null,
        ];
    }
}
