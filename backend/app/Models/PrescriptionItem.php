<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PrescriptionItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'prescription_id',
        'medicine_name',
        'dosage',
        'frequency',
        'duration',
        'instructions',
        'sort_order',
        'unit_price',
    ];

    protected function casts(): array
    {
        return [
            'prescription_id' => 'integer',
            'sort_order'      => 'integer',
            'unit_price'      => 'decimal:2',
        ];
    }

    public function prescription(): BelongsTo
    {
        return $this->belongsTo(Prescription::class);
    }
}
