<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    protected $fillable = [
        'patient_id', 'user_id', 'title', 'scheduled_at',
        'duration_minutes', 'status', 'type', 'notes',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
    ];

    public function patient() { return $this->belongsTo(Patient::class); }
    public function doctor()  { return $this->belongsTo(User::class, 'user_id'); }
}
