<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Clinic extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'doctor_name',
        'qualification',
        'address',
        'contact',
        'logo_path',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function patients(): HasMany
    {
        return $this->hasMany(Patient::class);
    }

    public function settings(): HasOne
    {
        return $this->hasOne(ClinicSetting::class);
    }
}
