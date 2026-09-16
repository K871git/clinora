<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LabReport extends Model
{
    protected $fillable = [
        'patient_id', 'visit_id', 'report_name', 'lab_name',
        'file_path', 'file_name', 'notes', 'status',
        'ordered_at', 'received_at',
    ];

    protected $casts = [
        'ordered_at'  => 'date',
        'received_at' => 'date',
    ];

    public function patient() { return $this->belongsTo(Patient::class); }
    public function visit()   { return $this->belongsTo(Visit::class); }
}
