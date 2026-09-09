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
            $amountCollected = (float) (clone $q)->where('payment_status', 'paid')->sum('consultation_fee')
                + (float) (clone $q)->where('payment_status', 'partial')->sum('amount_paid');
            $debtAmount = (float) (clone $q)
                ->whereIn('payment_status', ['unpaid', 'partial'])
                ->where('consultation_fee', '>', 0)
                ->selectRaw("SUM(CASE WHEN payment_status = 'unpaid' THEN consultation_fee ELSE (consultation_fee - amount_paid) END) as d")
                ->value('d');
            return [
                'revenue'          => (float) (clone $q)->sum('consultation_fee'),
                'paid_visits'      => (clone $q)->where('payment_status', 'paid')->count(),
                'unpaid_count'     => (clone $q)->whereIn('payment_status', ['unpaid', 'partial'])->where('consultation_fee', '>', 0)->count(),
                'total_visits'     => (clone $q)->count(),
                'amount_collected' => $amountCollected,
                'debt_amount'      => max(0.0, (float) $debtAmount),
            ];
        };

        $allBase  = Visit::where('clinic_id', $id);
        $allDebt  = (float) (clone $allBase)
            ->whereIn('payment_status', ['unpaid', 'partial'])
            ->where('consultation_fee', '>', 0)
            ->selectRaw("SUM(CASE WHEN payment_status = 'unpaid' THEN consultation_fee ELSE (consultation_fee - amount_paid) END) as d")
            ->value('d');
        $allCollected = (float) (clone $allBase)->where('payment_status', 'paid')->sum('consultation_fee')
            + (float) (clone $allBase)->where('payment_status', 'partial')->sum('amount_paid');

        return response()->json([
            'data' => [
                'today'      => $period($todayStart, $todayEnd),
                'this_week'  => $period($weekStart,  $weekEnd),
                'this_month' => $period($monthStart, $monthEnd),
                'all_time'   => [
                    'revenue'          => (float) (clone $allBase)->sum('consultation_fee'),
                    'paid_visits'      => (clone $allBase)->where('payment_status', 'paid')->count(),
                    'unpaid_count'     => (clone $allBase)->whereIn('payment_status', ['unpaid', 'partial'])->where('consultation_fee', '>', 0)->count(),
                    'total_visits'     => (clone $allBase)->count(),
                    'avg_fee'          => (float) (clone $allBase)->where('consultation_fee', '>', 0)->avg('consultation_fee'),
                    'amount_collected' => $allCollected,
                    'debt_amount'      => max(0.0, $allDebt),
                ],
            ],
        ]);
    }

    public function transactions(Request $request): JsonResponse
    {
        $id     = $request->user()->clinic_id;
        $period = $request->query('period', 'this_month');
        $filter = $request->query('filter', 'all');

        [$start, $end] = match($period) {
            'today'      => [today()->startOfDay(), today()->endOfDay()],
            'this_week'  => [now()->startOfWeek(), now()->endOfWeek()],
            'this_month' => [now()->startOfMonth(), now()->endOfMonth()],
            default      => [null, null],
        };

        $q = Visit::where('clinic_id', $id)
            ->where('consultation_fee', '>', 0)
            ->with('patient');

        if ($start && $end) {
            $q->whereBetween('visited_at', [$start, $end]);
        }

        match($filter) {
            'collected'   => $q->where('payment_status', 'paid'),
            'outstanding' => $q->whereIn('payment_status', ['unpaid', 'partial']),
            default       => null,
        };

        $visits = $q->orderByDesc('visited_at')->limit(100)->get();

        return response()->json([
            'data' => $visits->map(fn ($v) => [
                'id'               => $v->id,
                'patient_name'     => $v->patient?->name,
                'patient_id'       => $v->patient_id,
                'visited_at'       => $v->visited_at->toISOString(),
                'consultation_fee' => (float) ($v->consultation_fee ?? 0),
                'amount_paid'      => (float) ($v->amount_paid ?? 0),
                'payment_status'   => $v->payment_status ?? 'unpaid',
                'payment_notes'    => $v->payment_notes,
            ]),
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
