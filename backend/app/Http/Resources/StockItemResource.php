<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'category'       => $this->category,
            'unit'           => $this->unit,
            'selling_price'  => $this->selling_price !== null ? (float) $this->selling_price : null,
            'stock_quantity' => $this->stock_quantity,
            'description'    => $this->description,
            'created_at'     => $this->created_at->toISOString(),
            'updated_at'     => $this->updated_at->toISOString(),
        ];
    }
}
