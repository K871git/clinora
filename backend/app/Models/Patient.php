<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Patient extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'clinic_id',
        'name',
        'mobile',
        'date_of_birth',
        'age',
        'gender',
        'address',
    ];

    protected function casts(): array
    {
        return [
            'clinic_id'     => 'integer',
            'date_of_birth' => 'date:Y-m-d',
            'age'           => 'integer',
        ];
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class);
    }
}
