<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Visit extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'clinic_id',
        'patient_id',
        'doctor_id',
        'visited_at',
        'consultation_notes',
        'consultation_fee',
        'status',
        'invoiced_at',
    ];

    protected function casts(): array
    {
        return [
            'clinic_id'        => 'integer',
            'patient_id'       => 'integer',
            'doctor_id'        => 'integer',
            'visited_at'       => 'datetime',
            'consultation_fee' => 'decimal:2',
            'invoiced_at'      => 'datetime',
        ];
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function prescriptions(): HasMany
    {
        return $this->hasMany(Prescription::class);
    }
}
