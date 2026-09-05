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
        ]);

        $completed = $this->prescriptionService->completePrescription(
            $prescription,
            $request->user()->id,
            $validated['items'] ?? [],
        );

        if (!$completed) {
            return response()->json(['message' => 'Prescription is no longer active.'], 409);
        }

        return response()->json(
            ['data' => new PrescriptionResource($prescription->fresh()->load(['patient', 'visit', 'doctor', 'items']))],
        );
    }
}
