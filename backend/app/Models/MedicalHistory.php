<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MedicalHistory extends Model
{
    protected $fillable = [
        'patient_id', 'type', 'title', 'description',
        'severity', 'diagnosed_at', 'is_active',
    ];

    protected $casts = [
        'diagnosed_at' => 'date',
        'is_active'    => 'boolean',
    ];

    public function patient() { return $this->belongsTo(Patient::class); }
}
