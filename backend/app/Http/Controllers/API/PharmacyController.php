<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\PrescriptionResource;
use App\Models\Prescription;
use App\Services\Prescription\PrescriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PharmacyController extends Controller
{
    public function __construct(private PrescriptionService $prescriptionService) {}

    public function stats(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->prescriptionService->getPharmacyStats($request->user()->clinic_id),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $prescriptions = $this->prescriptionService->getPendingPrescriptions(
            $request->user()->clinic_id,
            $request->query('q') ?: null,
        );

        return response()->json(PrescriptionResource::collection($prescriptions)->response()->getData(true));
    }

    public function history(Request $request): JsonResponse
    {
        $prescriptions = $this->prescriptionService->getCompletedPrescriptions(
            $request->user()->clinic_id,
            $request->query('q') ?: null,
        );

        return response()->json(PrescriptionResource::collection($prescriptions)->response()->getData(true));
    }

    public function show(Request $request, Prescription $prescription): JsonResponse
    {
        $this->authorize('view', $prescription);

        return response()->json(
            ['data' => new PrescriptionResource($prescription->load(['patient', 'visit', 'doctor', 'items']))],
        );
    }

    public function startDispensing(Request $request, Prescription $prescription): JsonResponse
    {
        $this->authorize('complete', $prescription);

        if ($prescription->status !== 'sent_to_pharmacy') {
            return response()->json(['message' => 'Only pending prescriptions can be moved to dispensing.'], 422);
        }

        $started = $this->prescriptionService->startDispensing($prescription);

        if (!$started) {
            return response()->json(['message' => 'Prescription is no longer pending.'], 409);
        }

        return response()->json(
            ['data' => new PrescriptionResource($prescription->fresh()->load(['patient', 'visit', 'doctor', 'items']))],
        );
    }

    public function complete(Request $request, Prescription $prescription): JsonResponse
    {
        $this->authorize('complete', $prescription);

        if (!in_array($prescription->status, ['sent_to_pharmacy', 'dispensing'])) {
            return response()->json(['message' => 'Only pending or dispensing prescriptions can be completed.'], 422);
        }

        $validated = $request->validate([
            'items'              => ['sometimes', 'array'],
            'items.*.id'         => ['required_with:items', 'integer'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
            'payment_status'     => ['nullable', 'in:unpaid,partial,paid'],
            'amount_paid'        => ['nullable', 'numeric', 'min:0', 'max:9999999.99'],
            'payment_notes'      => ['nullable', 'string', 'max:500'],
        ]);

        $completed = $this->prescriptionService->completePrescription(
            $prescription,
            $request->user()->id,
            $validated['items'] ?? [],
        );

        if (!$completed) {
            return response()->json(['message' => 'Prescription is no longer active.'], 409);
        }

        $fresh = $prescription->fresh();

        if (isset($validated['payment_status'])) {
            $itemTotal = $fresh->items()->whereNotNull('unit_price')->sum('unit_price');
            $fresh->update([
                'payment_status' => $validated['payment_status'],
                'amount_paid'    => $validated['payment_status'] === 'paid'
                    ? ($validated['amount_paid'] ?? $itemTotal ?? 0)
                    : ($validated['amount_paid'] ?? 0),
                'payment_notes'  => $validated['payment_notes'] ?? null,
            ]);
        }

        return response()->json(
            ['data' => new PrescriptionResource($fresh->load(['patient', 'visit', 'doctor', 'items']))],
        );
    }

    public function recordPayment(Request $request, Prescription $prescription): JsonResponse
    {
        $this->authorize('complete', $prescription);

        if ($prescription->status !== 'completed') {
            return response()->json(['message' => 'Can only record payment for completed prescriptions.'], 422);
        }

        $validated = $request->validate([
            'payment_status' => ['required', 'in:unpaid,partial,paid'],
            'amount_paid'    => ['nullable', 'numeric', 'min:0', 'max:9999999.99'],
            'payment_notes'  => ['nullable', 'string', 'max:500'],
        ]);

        $itemTotal = $prescription->items()->whereNotNull('unit_price')->sum('unit_price');
        $prescription->update([
            'payment_status' => $validated['payment_status'],
            'amount_paid'    => $validated['payment_status'] === 'paid'
                ? ($validated['amount_paid'] ?? $itemTotal ?? 0)
                : ($validated['amount_paid'] ?? 0),
            'payment_notes'  => $validated['payment_notes'] ?? null,
        ]);

        return response()->json(
            ['data' => new PrescriptionResource($prescription->fresh()->load(['patient', 'visit', 'doctor', 'items']))],
        );
    }

    public function revenue(Request $request): JsonResponse
    {
        $clinicId = $request->user()->clinic_id;

        [$todayStart, $todayEnd] = [today()->startOfDay(), today()->endOfDay()];
        [$weekStart,  $weekEnd]  = [now()->startOfWeek(), now()->endOfWeek()];
        [$monthStart, $monthEnd] = [now()->startOfMonth(), now()->endOfMonth()];

        $medicineTotal = fn ($q) => (float) \DB::table('prescription_items as pi')
            ->join('prescriptions as p', 'p.id', '=', 'pi.prescription_id')
            ->whereNull('p.deleted_at')
            ->whereNull('pi.deleted_at')
            ->whereNotNull('pi.unit_price')
            ->where('p.clinic_id', $clinicId)
            ->where('p.status', 'completed')
            ->whereBetween('p.completed_at', [$q[0], $q[1]])
            ->sum('pi.unit_price');

        $period = function ($start, $end) use ($clinicId, $medicineTotal) {
            $q = Prescription::where('clinic_id', $clinicId)
                ->where('status', 'completed')
                ->whereBetween('completed_at', [$start, $end]);

            $amountCollected = (float) (clone $q)->where('payment_status', 'paid')->sum('amount_paid')
                + (float) (clone $q)->where('payment_status', 'partial')->sum('amount_paid');

            return [
                'revenue'          => $medicineTotal([$start, $end]),
                'total_dispensed'  => (clone $q)->count(),
                'paid_count'       => (clone $q)->where('payment_status', 'paid')->count(),
                'unpaid_count'     => (clone $q)->whereIn('payment_status', ['unpaid', 'partial'])->count(),
                'amount_collected' => $amountCollected,
            ];
        };

        $allBase = Prescription::where('clinic_id', $clinicId)->where('status', 'completed');

        $allRevenue = (float) \DB::table('prescription_items as pi')
            ->join('prescriptions as p', 'p.id', '=', 'pi.prescription_id')
            ->whereNull('p.deleted_at')->whereNull('pi.deleted_at')
            ->whereNotNull('pi.unit_price')
            ->where('p.clinic_id', $clinicId)
            ->where('p.status', 'completed')
            ->sum('pi.unit_price');

        $allCollected = (float) (clone $allBase)->where('payment_status', 'paid')->sum('amount_paid')
            + (float) (clone $allBase)->where('payment_status', 'partial')->sum('amount_paid');

        $debts = Prescription::where('clinic_id', $clinicId)
            ->where('status', 'completed')
            ->whereIn('payment_status', ['unpaid', 'partial'])
            ->with(['patient', 'items'])
            ->orderByDesc('completed_at')
            ->limit(30)
            ->get();

        return response()->json([
            'data' => [
                'today'      => $period($todayStart, $todayEnd),
                'this_week'  => $period($weekStart,  $weekEnd),
                'this_month' => $period($monthStart, $monthEnd),
                'all_time'   => [
                    'revenue'          => $allRevenue,
                    'total_dispensed'  => (clone $allBase)->count(),
                    'paid_count'       => (clone $allBase)->where('payment_status', 'paid')->count(),
                    'unpaid_count'     => (clone $allBase)->whereIn('payment_status', ['unpaid', 'partial'])->count(),
                    'amount_collected' => $allCollected,
                ],
            ],
        ]);
    }

    public function transactions(Request $request): JsonResponse
    {
        $clinicId = $request->user()->clinic_id;
        $period   = $request->query('period', 'this_month');
        $filter   = $request->query('filter', 'all');

        [$start, $end] = match($period) {
            'today'      => [today()->startOfDay(), today()->endOfDay()],
            'this_week'  => [now()->startOfWeek(), now()->endOfWeek()],
            'this_month' => [now()->startOfMonth(), now()->endOfMonth()],
            default      => [null, null],
        };

        $q = Prescription::where('clinic_id', $clinicId)
            ->where('status', 'completed')
            ->with(['patient', 'items']);

        if ($start && $end) {
            $q->whereBetween('completed_at', [$start, $end]);
        }

        match($filter) {
            'collected'   => $q->where('payment_status', 'paid'),
            'outstanding' => $q->whereIn('payment_status', ['unpaid', 'partial']),
            default       => null,
        };

        $prescriptions = $q->orderByDesc('completed_at')->limit(100)->get();

        return response()->json([
            'data' => $prescriptions->map(fn ($rx) => [
                'id'             => $rx->id,
                'patient_name'   => $rx->patient?->name,
                'patient_id'     => $rx->patient_id,
                'completed_at'   => $rx->completed_at?->toISOString(),
                'total_amount'   => (float) $rx->items->sum('unit_price'),
                'amount_paid'    => (float) ($rx->amount_paid ?? 0),
                'payment_status' => $rx->payment_status ?? 'unpaid',
                'payment_notes'  => $rx->payment_notes,
            ]),
        ]);
    }
}
