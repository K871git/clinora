<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    public function attemptLogin(string $email, string $password): ?string
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            return null;
        }

        if (! $user->is_active) {
            return null;
        }

        // Revoke all previous tokens before issuing a new one
        $user->tokens()->delete();

        return $user->createToken('clinora-auth')->plainTextToken;
    }

    public function logout(User $user): void
    {
        // Revoke all tokens — a user only ever holds one at a time (see attemptLogin)
        $user->tokens()->delete();
    }
}
