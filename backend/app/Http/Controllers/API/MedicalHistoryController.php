<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\MedicalHistory;
use App\Models\Patient;
use Illuminate\Http\Request;

class MedicalHistoryController extends Controller
{
    public function index(Patient $patient)
    {
        $histories = $patient->medicalHistories()
            ->orderByRaw("FIELD(type,'allergy','chronic','medication','surgery','family','other')")
            ->orderByDesc('is_active')
            ->orderByDesc('diagnosed_at')
            ->get();

        return response()->json(['data' => $histories]);
    }

    public function store(Request $request, Patient $patient)
    {
        $data = $request->validate([
            'type'         => 'required|in:allergy,chronic,surgery,family,medication,other',
            'title'        => 'required|string|max:200',
            'description'  => 'nullable|string|max:2000',
            'severity'     => 'nullable|in:mild,moderate,severe',
            'diagnosed_at' => 'nullable|date|before_or_equal:today',
            'is_active'    => 'boolean',
        ]);

        $data['patient_id'] = $patient->id;
        $item = MedicalHistory::create($data);

        return response()->json(['data' => $item], 201);
    }

    public function update(Request $request, Patient $patient, MedicalHistory $medicalHistory)
    {
        abort_if($medicalHistory->patient_id !== $patient->id, 404);

        $data = $request->validate([
            'type'         => 'sometimes|in:allergy,chronic,surgery,family,medication,other',
            'title'        => 'sometimes|string|max:200',
            'description'  => 'nullable|string|max:2000',
            'severity'     => 'nullable|in:mild,moderate,severe',
            'diagnosed_at' => 'nullable|date|before_or_equal:today',
            'is_active'    => 'boolean',
        ]);

        $medicalHistory->update($data);
        return response()->json(['data' => $medicalHistory]);
    }

    public function destroy(Patient $patient, MedicalHistory $medicalHistory)
    {
        abort_if($medicalHistory->patient_id !== $patient->id, 404);
        $medicalHistory->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
