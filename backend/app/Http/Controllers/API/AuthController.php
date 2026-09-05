<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private AuthService $authService) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $token = $this->authService->attemptLogin(
            $request->input('email'),
            $request->input('password'),
        );

        if (! $token) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        return response()->json(['token' => $token]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('clinic');

        return response()->json(['user' => $user]);
    }
}
