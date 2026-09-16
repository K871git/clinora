<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\VitalSign;
use Illuminate\Http\Request;

class VitalSignController extends Controller
{
    public function index(Patient $patient)
    {
        $vitals = $patient->vitalSigns()
            ->with('visit:id,chief_complaint,created_at')
            ->orderByDesc('recorded_at')
            ->get();

        return response()->json(['data' => $vitals]);
    }

    public function store(Request $request, Patient $patient)
    {
        $data = $request->validate([
            'visit_id'         => 'nullable|exists:visits,id',
            'bp_systolic'      => 'nullable|integer|between:40,300',
            'bp_diastolic'     => 'nullable|integer|between:20,200',
            'pulse'            => 'nullable|integer|between:20,300',
            'temperature'      => 'nullable|numeric|between:30,45',
            'weight'           => 'nullable|numeric|between:1,500',
            'height'           => 'nullable|numeric|between:10,300',
            'spo2'             => 'nullable|integer|between:50,100',
            'respiratory_rate' => 'nullable|integer|between:4,60',
            'blood_group'      => 'nullable|string|max:5',
            'notes'            => 'nullable|string|max:1000',
            'recorded_at'      => 'nullable|date',
        ]);

        $data['patient_id']  = $patient->id;
        $data['recorded_at'] = $data['recorded_at'] ?? now();

        $vital = VitalSign::create($data);
        $vital->load('visit:id,chief_complaint,created_at');

        return response()->json(['data' => $vital], 201);
    }

    public function update(Request $request, Patient $patient, VitalSign $vitalSign)
    {
        abort_if($vitalSign->patient_id !== $patient->id, 404);

        $data = $request->validate([
            'bp_systolic'      => 'nullable|integer|between:40,300',
            'bp_diastolic'     => 'nullable|integer|between:20,200',
            'pulse'            => 'nullable|integer|between:20,300',
            'temperature'      => 'nullable|numeric|between:30,45',
            'weight'           => 'nullable|numeric|between:1,500',
            'height'           => 'nullable|numeric|between:10,300',
            'spo2'             => 'nullable|integer|between:50,100',
            'respiratory_rate' => 'nullable|integer|between:4,60',
            'blood_group'      => 'nullable|string|max:5',
            'notes'            => 'nullable|string|max:1000',
            'recorded_at'      => 'nullable|date',
        ]);

        $vitalSign->update($data);
        $vitalSign->load('visit:id,chief_complaint,created_at');

        return response()->json(['data' => $vitalSign]);
    }

    public function destroy(Patient $patient, VitalSign $vitalSign)
    {
        abort_if($vitalSign->patient_id !== $patient->id, 404);
        $vitalSign->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // Latest vitals for a patient — used in visit detail quick view
    public function latest(Patient $patient)
    {
        $vital = $patient->vitalSigns()->orderByDesc('recorded_at')->first();
        return response()->json(['data' => $vital]);
    }
}
