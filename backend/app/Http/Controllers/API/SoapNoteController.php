<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Visit;
use Illuminate\Http\Request;

class SoapNoteController extends Controller
{
    public function show(Visit $visit)
    {
        return response()->json([
            'data' => [
                'visit_id'         => $visit->id,
                'soap_subjective'  => $visit->soap_subjective,
                'soap_objective'   => $visit->soap_objective,
                'soap_assessment'  => $visit->soap_assessment,
                'soap_plan'        => $visit->soap_plan,
            ]
        ]);
    }

    public function upsert(Request $request, Visit $visit)
    {
        $data = $request->validate([
            'soap_subjective' => 'nullable|string|max:5000',
            'soap_objective'  => 'nullable|string|max:5000',
            'soap_assessment' => 'nullable|string|max:5000',
            'soap_plan'       => 'nullable|string|max:5000',
        ]);

        $visit->update($data);

        return response()->json([
            'data' => [
                'visit_id'         => $visit->id,
                'soap_subjective'  => $visit->soap_subjective,
                'soap_objective'   => $visit->soap_objective,
                'soap_assessment'  => $visit->soap_assessment,
                'soap_plan'        => $visit->soap_plan,
            ]
        ]);
    }
}
