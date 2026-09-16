<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\LabReport;
use App\Models\Patient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LabReportController extends Controller
{
    public function index(Patient $patient)
    {
        $reports = $patient->labReports()
            ->with('visit:id,chief_complaint,created_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($r) {
                $r->file_url = $r->file_path
                    ? Storage::url($r->file_path)
                    : null;
                return $r;
            });

        return response()->json(['data' => $reports]);
    }

    public function store(Request $request, Patient $patient)
    {
        $data = $request->validate([
            'visit_id'    => 'nullable|exists:visits,id',
            'report_name' => 'required|string|max:200',
            'lab_name'    => 'nullable|string|max:200',
            'notes'       => 'nullable|string|max:2000',
            'status'      => 'in:ordered,received,reviewed',
            'ordered_at'  => 'nullable|date',
            'received_at' => 'nullable|date',
            'file'        => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:10240',
        ]);

        $data['patient_id'] = $patient->id;

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $path = $file->storeAs(
                'lab-reports/' . $patient->id,
                Str::uuid() . '.' . $file->extension(),
                'public'
            );
            $data['file_path'] = $path;
            $data['file_name'] = $file->getClientOriginalName();
        }

        unset($data['file']);
        $report = LabReport::create($data);
        $report->file_url = $report->file_path ? Storage::url($report->file_path) : null;

        return response()->json(['data' => $report], 201);
    }

    public function update(Request $request, Patient $patient, LabReport $labReport)
    {
        abort_if($labReport->patient_id !== $patient->id, 404);

        $data = $request->validate([
            'report_name' => 'sometimes|string|max:200',
            'lab_name'    => 'nullable|string|max:200',
            'notes'       => 'nullable|string|max:2000',
            'status'      => 'in:ordered,received,reviewed',
            'ordered_at'  => 'nullable|date',
            'received_at' => 'nullable|date',
            'file'        => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:10240',
        ]);

        if ($request->hasFile('file')) {
            if ($labReport->file_path) Storage::disk('public')->delete($labReport->file_path);
            $file = $request->file('file');
            $path = $file->storeAs(
                'lab-reports/' . $patient->id,
                Str::uuid() . '.' . $file->extension(),
                'public'
            );
            $data['file_path'] = $path;
            $data['file_name'] = $file->getClientOriginalName();
        }

        unset($data['file']);
        $labReport->update($data);
        $labReport->file_url = $labReport->file_path ? Storage::url($labReport->file_path) : null;

        return response()->json(['data' => $labReport]);
    }

    public function destroy(Patient $patient, LabReport $labReport)
    {
        abort_if($labReport->patient_id !== $patient->id, 404);
        if ($labReport->file_path) Storage::disk('public')->delete($labReport->file_path);
        $labReport->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
