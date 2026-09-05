<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\Patient\SearchPatientRequest;
use App\Http\Requests\Patient\StorePatientRequest;
use App\Http\Requests\Patient\UpdatePatientRequest;
use App\Http\Resources\PatientResource;
use App\Models\Patient;
use App\Services\Patient\PatientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PatientController extends Controller
{
    public function __construct(private PatientService $patientService) {}

    public function index(SearchPatientRequest $request): AnonymousResourceCollection
    {
        $patients = $this->patientService->list(
            clinicId: $request->user()->clinic_id,
            query:    $request->input('q'),
            sortBy:   $request->input('sort_by', 'name'),
            sortDir:  $request->input('sort_dir', 'asc'),
            gender:   (string) $request->input('gender', ''),
            isNew:    $request->boolean('is_new'),
            perPage:  $request->integer('per_page', 15),
        );

        return PatientResource::collection($patients);
    }

    public function store(StorePatientRequest $request): JsonResponse
    {
        $result = $this->patientService->createPatient(
            $request->user()->clinic_id,
            $request->validated(),
        );

        if ($result['duplicate']) {
            return response()->json([
                'message'   => 'A patient with this mobile number already exists.',
                'duplicate' => new PatientResource($result['patient']),
            ], 409);
        }

        return response()->json(
            ['data' => new PatientResource($result['patient'])],
            201,
        );
    }

    public function show(Request $request, Patient $patient): JsonResponse
    {
        $this->authorize('view', $patient);

        return response()->json(['data' => new PatientResource($patient)]);
    }

    public function update(UpdatePatientRequest $request, Patient $patient): JsonResponse
    {
        $this->authorize('update', $patient);

        $patient = $this->patientService->updatePatient($patient, $request->validated());

        return response()->json(['data' => new PatientResource($patient)]);
    }
}
