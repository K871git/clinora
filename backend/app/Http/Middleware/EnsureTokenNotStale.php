<?php

namespace App\Http\Middleware;

use Carbon\Carbon;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class EnsureTokenNotStale
{
    // Inactivity window: session expires after this many minutes with no API call.
    private const INACTIVITY_MINUTES = 120;

    public function handle(Request $request, Closure $next): Response
    {
        $bearer = $request->bearerToken();

        // No token — let auth:sanctum handle the unauthenticated case.
        if (!$bearer || !str_contains($bearer, '|')) {
            return $next($request);
        }

        [$id, $plaintext] = explode('|', $bearer, 2);

        // Read last_used_at directly from DB BEFORE auth:sanctum updates it.
        $record = DB::table('personal_access_tokens')
            ->where('id', (int) $id)
            ->where('token', hash('sha256', $plaintext))
            ->first(['last_used_at', 'created_at']);

        // Token not found — auth:sanctum will return 401.
        if (!$record) {
            return $next($request);
        }

        // Use last_used_at if set, otherwise fall back to created_at
        // (brand-new token that's never been used yet).
        $lastActivity = $record->last_used_at
            ? Carbon::parse($record->last_used_at)
            : Carbon::parse($record->created_at);

        if ($lastActivity->lt(now()->subMinutes(self::INACTIVITY_MINUTES))) {
            // Revoke the stale token so it can't be reused.
            DB::table('personal_access_tokens')->where('id', (int) $id)->delete();

            return response()->json([
                'message' => 'Session expired due to inactivity. Please log in again.',
                'expired' => true,
            ], 401);
        }

        return $next($request);
    }
}
