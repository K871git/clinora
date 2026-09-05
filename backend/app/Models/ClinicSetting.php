<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'clinic_id',
        'prescription_header',
        'prescription_footer',
        'show_doctor_contact',
        'show_clinic_contact',
        'prescription_template',
    ];

    protected function casts(): array
    {
        return [
            'clinic_id'           => 'integer',
            'show_doctor_contact' => 'boolean',
            'show_clinic_contact' => 'boolean',
        ];
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }
}
