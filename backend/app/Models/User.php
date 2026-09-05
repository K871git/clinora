<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        'clinic_id',
        'name',
        'email',
        'avatar',
        'username',
        'phone',
        'gender',
        'dob',
        'address',
        'password',
        'role',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password'  => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function isDoctor(): bool
    {
        return $this->role === 'doctor';
    }

    public function isPharmacy(): bool
    {
        return $this->role === 'pharmacy';
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }
}
