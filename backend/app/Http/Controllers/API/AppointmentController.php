<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Patient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'date'   => 'nullable|date',
            'month'  => 'nullable|string|regex:/^\d{4}-\d{2}$/',
            'status' => 'nullable|in:scheduled,confirmed,completed,cancelled,no_show',
        ]);

        $query = Appointment::with('patient:id,name,mobile')
            ->where('user_id', Auth::id());

        if ($request->date) {
            $query->whereDate('scheduled_at', $request->date);
        } elseif ($request->month) {
            $query->whereRaw("DATE_FORMAT(scheduled_at, '%Y-%m') = ?", [$request->month]);
        } else {
            // Default: upcoming + today
            $query->whereDate('scheduled_at', '>=', today());
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        $appointments = $query->orderBy('scheduled_at')->get();

        return response()->json(['data' => $appointments]);
    }

    // Days that have appointments in a month — for calendar dot indicators
    public function daysWithAppointments(Request $request)
    {
        $month = $request->validate(['month' => 'required|string|regex:/^\d{4}-\d{2}$/'])['month'];

        $days = Appointment::where('user_id', Auth::id())
            ->whereRaw("DATE_FORMAT(scheduled_at, '%Y-%m') = ?", [$month])
            ->whereIn('status', ['scheduled', 'confirmed'])
            ->selectRaw("DATE_FORMAT(scheduled_at, '%Y-%m-%d') as day")
            ->distinct()
            ->pluck('day');

        return response()->json(['data' => $days]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'patient_id'       => 'required|exists:patients,id',
            'title'            => 'nullable|string|max:200',
            'scheduled_at'     => 'required|date',
            'duration_minutes' => 'integer|min:5|max:480',
            'status'           => 'in:scheduled,confirmed,completed,cancelled,no_show',
            'type'             => 'in:consultation,follow_up,checkup,procedure,other',
            'notes'            => 'nullable|string|max:1000',
        ]);

        $data['user_id'] = Auth::id();
        $appt = Appointment::create($data);
        $appt->load('patient:id,name,mobile');

        return response()->json(['data' => $appt], 201);
    }

    public function show(Appointment $appointment)
    {
        abort_if($appointment->user_id !== Auth::id(), 404);
        $appointment->load('patient:id,name,mobile,age,gender');
        return response()->json(['data' => $appointment]);
    }

    public function update(Request $request, Appointment $appointment)
    {
        abort_if($appointment->user_id !== Auth::id(), 404);

        $data = $request->validate([
            'title'            => 'nullable|string|max:200',
            'scheduled_at'     => 'sometimes|date',
            'duration_minutes' => 'integer|min:5|max:480',
            'status'           => 'in:scheduled,confirmed,completed,cancelled,no_show',
            'type'             => 'in:consultation,follow_up,checkup,procedure,other',
            'notes'            => 'nullable|string|max:1000',
        ]);

        $appointment->update($data);
        $appointment->load('patient:id,name,mobile');
        return response()->json(['data' => $appointment]);
    }

    public function destroy(Appointment $appointment)
    {
        abort_if($appointment->user_id !== Auth::id(), 404);
        $appointment->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // Appointments for a specific patient
    public function forPatient(Patient $patient)
    {
        $appointments = $patient->appointments()
            ->where('user_id', Auth::id())
            ->orderByDesc('scheduled_at')
            ->limit(20)
            ->get();

        return response()->json(['data' => $appointments]);
    }
}
