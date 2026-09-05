<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\PrescriptionResource;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $id = $request->user()->clinic_id;

        return response()->json([
            'data' => [
                'today_visits'    => Visit::where('clinic_id', $id)->whereDate('visited_at', today())->count(),
                'yesterday_visits'=> Visit::where('clinic_id', $id)->whereDate('visited_at', today()->subDay())->count(),
                'total_visits'    => Visit::where('clinic_id', $id)->count(),
                'total_patients'  => Patient::where('clinic_id', $id)->count(),
                'pending_rx'      => Prescription::where('clinic_id', $id)->where('status', 'sent_to_pharmacy')->count(),
                'draft_rx'        => Prescription::where('clinic_id', $id)->where('status', 'draft')->count(),
                'completed_today' => Prescription::where('clinic_id', $id)->where('status', 'completed')->whereDate('completed_at', today())->count(),
                'today_revenue'   => (float) Visit::where('clinic_id', $id)->whereDate('visited_at', today())->sum('consultation_fee'),
                'monthly_revenue' => (float) Visit::where('clinic_id', $id)->whereMonth('visited_at', now()->month)->whereYear('visited_at', now()->year)->sum('consultation_fee'),
                'week_activity'   => $this->weekActivity($id),
            ],
        ]);
    }

    private function weekActivity(int $clinicId): array
    {
        return collect(range(6, 0))->map(fn ($ago) => [
            'label'    => today()->subDays($ago)->format('D'),
            'count'    => Visit::where('clinic_id', $clinicId)
                               ->whereDate('visited_at', today()->subDays($ago))
                               ->count(),
            'is_today' => $ago === 0,
        ])->values()->all();
    }

    public function revenue(Request $request): JsonResponse
    {
        $id = $request->user()->clinic_id;

        [$todayStart, $todayEnd] = [today()->startOfDay(), today()->endOfDay()];
        [$weekStart,  $weekEnd]  = [now()->startOfWeek(), now()->endOfWeek()];
        [$monthStart, $monthEnd] = [now()->startOfMonth(), now()->endOfMonth()];

        $period = function ($start, $end) use ($id) {
            $q = Visit::where('clinic_id', $id)->whereBetween('visited_at', [$start, $end]);
            return [
                'revenue'      => (float) (clone $q)->sum('consultation_fee'),
                'paid_visits'  => (clone $q)->where('consultation_fee', '>', 0)->count(),
                'total_visits' => (clone $q)->count(),
            ];
        };

        $allPaid = Visit::where('clinic_id', $id)->where('consultation_fee', '>', 0);

        return response()->json([
            'data' => [
                'today'      => $period($todayStart, $todayEnd),
                'this_week'  => $period($weekStart,  $weekEnd),
                'this_month' => $period($monthStart, $monthEnd),
                'all_time'   => [
                    'revenue'      => (float) Visit::where('clinic_id', $id)->sum('consultation_fee'),
                    'paid_visits'  => (clone $allPaid)->count(),
                    'total_visits' => Visit::where('clinic_id', $id)->count(),
                    'avg_fee'      => (float) (clone $allPaid)->avg('consultation_fee'),
                ],
            ],
        ]);
    }

    public function todayPatients(Request $request): JsonResponse
    {
        $id = $request->user()->clinic_id;

        $visits = Visit::with('patient')
            ->where('clinic_id', $id)
            ->whereDate('visited_at', today())
            ->orderByDesc('visited_at')
            ->limit(8)
            ->get();

        return response()->json([
            'data' => $visits->map(fn ($v) => [
                'id'               => $v->id,
                'patient_id'       => $v->patient_id,
                'visited_at'       => $v->visited_at->format('H:i'),
                'consultation_fee' => (float) ($v->consultation_fee ?? 0),
                'patient'          => $v->patient ? [
                    'id'     => $v->patient->id,
                    'name'   => $v->patient->name,
                    'mobile' => $v->patient->mobile ?? null,
                ] : null,
            ]),
        ]);
    }

    public function pendingRx(Request $request): JsonResponse
    {
        $id = $request->user()->clinic_id;

        $prescriptions = Prescription::with(['patient', 'items'])
            ->where('clinic_id', $id)
            ->where('status', 'sent_to_pharmacy')
            ->orderByDesc('sent_to_pharmacy_at')
            ->limit(8)
            ->get();

        return response()->json([
            'data' => PrescriptionResource::collection($prescriptions),
        ]);
    }
}
