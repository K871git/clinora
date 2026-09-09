<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Prescription extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'clinic_id',
        'patient_id',
        'visit_id',
        'doctor_id',
        'prescribed_at',
        'doctor_notes',
        'status',
        'sent_to_pharmacy_at',
        'dispensed_at',
        'completed_at',
        'completed_by',
        'payment_status',
        'amount_paid',
        'payment_notes',
    ];

    protected function casts(): array
    {
        return [
            'clinic_id'           => 'integer',
            'patient_id'          => 'integer',
            'visit_id'            => 'integer',
            'doctor_id'           => 'integer',
            'completed_by'        => 'integer',
            'prescribed_at'       => 'datetime',
            'sent_to_pharmacy_at' => 'datetime',
            'dispensed_at'        => 'datetime',
            'completed_at'        => 'datetime',
            'amount_paid'         => 'decimal:2',
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

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PrescriptionItem::class)->orderBy('sort_order');
    }
}
