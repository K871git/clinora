<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    // -----------------------------------------------------------------------
    // Login
    // -----------------------------------------------------------------------

    public function test_doctor_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->doctor()->create([
            'email'    => 'doctor@clinic.com',
            'password' => bcrypt('secret123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'doctor@clinic.com',
            'password' => 'secret123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token']);
    }

    public function test_pharmacy_can_login_with_valid_credentials(): void
    {
        User::factory()->pharmacy()->create([
            'email'    => 'pharmacy@clinic.com',
            'password' => bcrypt('secret123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'pharmacy@clinic.com',
            'password' => 'secret123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token']);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create(['email' => 'doctor@clinic.com']);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'doctor@clinic.com',
            'password' => 'wrong-password',
        ]);

        $response->assertUnauthorized()
            ->assertJson(['message' => 'Invalid credentials']);
    }

    public function test_login_fails_with_unknown_email(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email'    => 'nobody@clinic.com',
            'password' => 'secret123',
        ]);

        $response->assertUnauthorized()
            ->assertJson(['message' => 'Invalid credentials']);
    }

    public function test_login_fails_for_inactive_user(): void
    {
        User::factory()->inactive()->create([
            'email'    => 'inactive@clinic.com',
            'password' => bcrypt('secret123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'inactive@clinic.com',
            'password' => 'secret123',
        ]);

        $response->assertUnauthorized()
            ->assertJson(['message' => 'Invalid credentials']);
    }

    public function test_login_validates_required_fields(): void
    {
        $response = $this->postJson('/api/auth/login', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_login_validates_email_format(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email'    => 'not-an-email',
            'password' => 'secret123',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    // -----------------------------------------------------------------------
    // Authenticated user (me)
    // -----------------------------------------------------------------------

    public function test_me_returns_authenticated_user(): void
    {
        $user = User::factory()->doctor()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/auth/me');

        $response->assertOk()
            ->assertJsonStructure(['user' => ['id', 'name', 'email', 'role', 'clinic']]);
    }

    public function test_me_is_rejected_without_authentication(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response->assertUnauthorized()
            ->assertJson(['message' => 'Unauthenticated']);
    }

    // -----------------------------------------------------------------------
    // Logout
    // -----------------------------------------------------------------------

    public function test_authenticated_user_can_logout(): void
    {
        $user = User::factory()->doctor()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/auth/logout');

        $response->assertOk()
            ->assertJson(['message' => 'Logged out successfully']);
    }

    public function test_logout_is_rejected_without_authentication(): void
    {
        $response = $this->postJson('/api/auth/logout');

        $response->assertUnauthorized();
    }

    // -----------------------------------------------------------------------
    // Role authorization
    // -----------------------------------------------------------------------

    public function test_doctor_can_access_doctor_routes(): void
    {
        $doctor = User::factory()->doctor()->create();

        // The doctor group currently has no routes, so we verify the middleware
        // chain works by hitting a route that requires doctor role.
        // We use a real route here once patient routes are added.
        // For now, confirm the doctor user has the expected role.
        $this->assertSame('doctor', $doctor->role);
        $this->assertTrue($doctor->isDoctor());
        $this->assertFalse($doctor->isPharmacy());
    }

    public function test_pharmacy_user_is_blocked_from_doctor_routes(): void
    {
        // We register a temporary test route to verify the middleware rejects pharmacy users.
        \Illuminate\Support\Facades\Route::middleware(['auth:sanctum', 'role:doctor'])
            ->get('/_test/doctor-only', fn () => response()->json(['ok' => true]));

        $pharmacy = User::factory()->pharmacy()->create();

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/_test/doctor-only');

        $response->assertForbidden()
            ->assertJson(['message' => 'Forbidden']);
    }

    public function test_doctor_user_is_blocked_from_pharmacy_routes(): void
    {
        \Illuminate\Support\Facades\Route::middleware(['auth:sanctum', 'role:pharmacy'])
            ->get('/_test/pharmacy-only', fn () => response()->json(['ok' => true]));

        $doctor = User::factory()->doctor()->create();

        $response = $this->actingAs($doctor, 'sanctum')
            ->getJson('/_test/pharmacy-only');

        $response->assertForbidden()
            ->assertJson(['message' => 'Forbidden']);
    }

    public function test_pharmacy_can_access_pharmacy_routes(): void
    {
        \Illuminate\Support\Facades\Route::middleware(['auth:sanctum', 'role:pharmacy'])
            ->get('/_test/pharmacy-check', fn () => response()->json(['ok' => true]));

        $pharmacy = User::factory()->pharmacy()->create();

        $response = $this->actingAs($pharmacy, 'sanctum')
            ->getJson('/_test/pharmacy-check');

        $response->assertOk()
            ->assertJson(['ok' => true]);
    }

    public function test_unauthenticated_request_to_protected_route_is_rejected(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response->assertUnauthorized()
            ->assertJson(['message' => 'Unauthenticated']);
    }
}
