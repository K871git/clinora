<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\Visit\StoreVisitRequest;
use App\Http\Requests\Visit\UpdateVisitRequest;
use App\Http\Resources\VisitResource;
use App\Models\Patient;
use App\Models\Visit;
use App\Services\Visit\VisitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VisitController extends Controller
{
    public function __construct(private VisitService $visitService) {}

    public function index(Request $request): JsonResponse
    {
        $visits = \App\Models\Visit::where('clinic_id', $request->user()->clinic_id)
            ->with(['patient', 'doctor'])
            ->orderBy('visited_at', 'desc')
            ->paginate(100);

        return response()->json(VisitResource::collection($visits)->response()->getData(true));
    }

    public function store(StoreVisitRequest $request, Patient $patient): JsonResponse
    {
        // Ensures the patient belongs to the authenticated user's clinic
        $this->authorize('view', $patient);

        $visit = $this->visitService->createVisit(
            $request->user()->clinic_id,
            $request->user()->id,
            $patient,
            $request->validated(),
        );

        return response()->json(
            ['data' => new VisitResource($visit->load(['patient', 'doctor']))],
            201,
        );
    }

    public function show(Request $request, Visit $visit): JsonResponse
    {
        $this->authorize('view', $visit);

        return response()->json(
            ['data' => new VisitResource($visit->load(['patient', 'doctor', 'prescriptions.items']))],
        );
    }

    public function complete(Request $request, Visit $visit): JsonResponse
    {
        $this->authorize('update', $visit);

        if ($visit->status === 'completed') {
            return response()->json(['message' => 'Visit is already completed.'], 422);
        }

        $validated = $request->validate([
            'consultation_fee' => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
        ]);

        $visit = $this->visitService->completeVisit(
            $visit,
            isset($validated['consultation_fee']) ? (float) $validated['consultation_fee'] : null,
        );

        return response()->json(
            ['data' => new VisitResource($visit->load(['patient', 'doctor', 'prescriptions.items']))],
        );
    }

    public function updateFee(Request $request, Visit $visit): JsonResponse
    {
        $this->authorize('update', $visit);

        $validated = $request->validate([
            'consultation_fee' => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
        ]);

        $visit->update([
            'consultation_fee' => isset($validated['consultation_fee'])
                ? (float) $validated['consultation_fee']
                : 0,
        ]);

        return response()->json(
            ['data' => new VisitResource($visit->load(['patient', 'doctor', 'prescriptions.items']))],
        );
    }

    public function update(UpdateVisitRequest $request, Visit $visit): JsonResponse
    {
        $this->authorize('update', $visit);

        $visit = $this->visitService->updateVisit($visit, $request->validated());

        return response()->json(
            ['data' => new VisitResource($visit->load(['patient', 'doctor']))],
        );
    }

    public function recordPayment(Request $request, Visit $visit): JsonResponse
    {
        $this->authorize('update', $visit);

        $validated = $request->validate([
            'payment_status' => ['required', 'in:unpaid,partial,paid'],
            'amount_paid'    => ['nullable', 'numeric', 'min:0', 'max:9999999.99'],
            'payment_notes'  => ['nullable', 'string', 'max:500'],
        ]);

        $visit->update([
            'payment_status' => $validated['payment_status'],
            'amount_paid'    => $validated['amount_paid'] ?? 0,
            'payment_notes'  => $validated['payment_notes'] ?? null,
        ]);

        return response()->json(
            ['data' => new VisitResource($visit->load(['patient', 'doctor', 'prescriptions.items']))],
        );
    }

    public function patientHistory(Request $request, Patient $patient): JsonResponse
    {
        $this->authorize('view', $patient);

        $visits = $this->visitService->getPatientHistory(
            $request->user()->clinic_id,
            $patient,
        );

        return response()->json(VisitResource::collection($visits)->response()->getData(true));
    }
}
