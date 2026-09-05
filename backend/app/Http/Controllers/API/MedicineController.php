<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\MedicineResource;
use App\Models\Medicine;
use App\Services\Medicine\MedicineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MedicineController extends Controller
{
    public function __construct(private MedicineService $medicineService) {}

    public function index(Request $request): JsonResponse
    {
        $clinicId = $request->user()->clinic->id;
        $perPage  = min((int) $request->input('per_page', 100), 500);
        $q        = (string) ($request->input('q') ?? '');

        $paged = $this->medicineService->search($clinicId, $q, $perPage);

        return response()->json([
            'data' => MedicineResource::collection($paged->items()),
            'meta' => [
                'total'        => $paged->total(),
                'current_page' => $paged->currentPage(),
                'last_page'    => $paged->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'         => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'category'     => ['nullable', 'string', 'max:100'],
            'unit'         => ['nullable', 'string', 'max:50'],
            'quantity'     => ['nullable', 'integer', 'min:0'],
            'price'        => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
        ]);

        $medicine = $this->medicineService->create($request->user()->clinic->id, $validated);

        return response()->json(['data' => new MedicineResource($medicine)], 201);
    }

    public function update(Request $request, Medicine $medicine): JsonResponse
    {
        if ($medicine->clinic_id !== $request->user()->clinic->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name'         => ['sometimes', 'required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'category'     => ['nullable', 'string', 'max:100'],
            'unit'         => ['nullable', 'string', 'max:50'],
            'quantity'     => ['nullable', 'integer', 'min:0'],
            'price'        => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
        ]);

        $medicine = $this->medicineService->update($medicine, $validated);

        return response()->json(['data' => new MedicineResource($medicine)]);
    }

    public function destroy(Request $request, Medicine $medicine): JsonResponse
    {
        if ($medicine->clinic_id !== $request->user()->clinic->id) {
            abort(403);
        }

        $this->medicineService->delete($medicine);

        return response()->json(null, 204);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:2048'],
        ]);

        $ext = strtolower($request->file('file')->getClientOriginalExtension());
        if (!in_array($ext, ['csv', 'txt'])) {
            return response()->json(['message' => 'Only CSV and TXT files are supported.'], 422);
        }

        $result = $this->medicineService->importFromFile(
            $request->user()->clinic->id,
            $request->file('file')
        );

        return response()->json($result);
    }
}
