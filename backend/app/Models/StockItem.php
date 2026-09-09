<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'clinic_id',
        'name',
        'category',
        'unit',
        'selling_price',
        'stock_quantity',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'clinic_id'      => 'integer',
            'selling_price'  => 'decimal:2',
            'stock_quantity' => 'integer',
        ];
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }
}
