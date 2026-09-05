<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\Prescription\StorePrescriptionRequest;
use App\Http\Requests\Prescription\UpdatePrescriptionRequest;
use App\Http\Resources\PrescriptionResource;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\Visit;
use App\Services\Prescription\PrescriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrescriptionController extends Controller
{
    public function __construct(private PrescriptionService $prescriptionService) {}

    public function index(Request $request): JsonResponse
    {
        $prescriptions = $this->prescriptionService->getClinicPrescriptions(
            $request->user()->clinic_id,
            $request->only(['status', 'q', 'per_page']),
        );

        return response()->json(PrescriptionResource::collection($prescriptions)->response()->getData(true));
    }

    public function store(StorePrescriptionRequest $request, Visit $visit): JsonResponse
    {
        $this->authorize('view', $visit);

        $prescription = $this->prescriptionService->createPrescription(
            $request->user()->clinic_id,
            $request->user()->id,
            $visit,
            $request->validated(),
        );

        return response()->json(
            ['data' => new PrescriptionResource($prescription->load(['patient', 'visit', 'doctor', 'items']))],
            201,
        );
    }

    public function show(Request $request, Prescription $prescription): JsonResponse
    {
        $this->authorize('view', $prescription);

        return response()->json(
            ['data' => new PrescriptionResource($prescription->load(['patient', 'visit', 'doctor', 'items']))],
        );
    }

    public function update(UpdatePrescriptionRequest $request, Prescription $prescription): JsonResponse
    {
        $this->authorize('update', $prescription);

        if ($prescription->status !== 'draft') {
            return response()->json(['message' => 'Only draft prescriptions can be updated.'], 422);
        }

        $prescription = $this->prescriptionService->updatePrescription($prescription, $request->validated());

        return response()->json(
            ['data' => new PrescriptionResource($prescription->load(['patient', 'visit', 'doctor', 'items']))],
        );
    }

    public function send(Request $request, Prescription $prescription): JsonResponse
    {
        $this->authorize('send', $prescription);

        if ($prescription->status !== 'draft') {
            return response()->json(['message' => 'Only draft prescriptions can be sent to pharmacy.'], 422);
        }

        $sent = $this->prescriptionService->sendToPharmacy($prescription);

        if (! $sent) {
            return response()->json(['message' => 'Prescription is no longer a draft.'], 409);
        }

        return response()->json(
            ['data' => new PrescriptionResource($prescription->fresh()->load(['patient', 'visit', 'doctor', 'items']))],
        );
    }

    public function destroy(Request $request, Prescription $prescription): JsonResponse
    {
        $this->authorize('delete', $prescription);

        if ($prescription->status !== 'draft') {
            return response()->json(['message' => 'Only draft prescriptions can be deleted.'], 422);
        }

        $this->prescriptionService->deletePrescription($prescription);

        return response()->json(null, 204);
    }

    public function patientHistory(Request $request, Patient $patient): JsonResponse
    {
        $this->authorize('view', $patient);

        $prescriptions = $this->prescriptionService->getPatientHistory(
            $request->user()->clinic_id,
            $patient,
        );

        return response()->json(PrescriptionResource::collection($prescriptions)->response()->getData(true));
    }
}
