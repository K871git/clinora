<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VitalSign extends Model
{
    protected $fillable = [
        'patient_id', 'visit_id', 'bp_systolic', 'bp_diastolic',
        'pulse', 'temperature', 'weight', 'height', 'spo2',
        'respiratory_rate', 'blood_group', 'notes', 'recorded_at',
    ];

    protected $casts = [
        'recorded_at'  => 'datetime',
        'temperature'  => 'float',
        'weight'       => 'float',
        'height'       => 'float',
    ];

    public function patient() { return $this->belongsTo(Patient::class); }
    public function visit()   { return $this->belongsTo(Visit::class); }
}
