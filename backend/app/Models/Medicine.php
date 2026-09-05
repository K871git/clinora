<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Medicine extends Model
{
    protected $fillable = [
        'clinic_id',
        'name',
        'generic_name',
        'category',
        'unit',
        'quantity',
        'price',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'price'    => 'decimal:2',
    ];

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }
}
