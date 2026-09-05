<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateClinicRequest;
use App\Http\Requests\Settings\UpdatePrescriptionSettingsRequest;
use App\Http\Resources\ClinicSettingsResource;
use App\Services\Settings\ClinicSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ClinicSettingsController extends Controller
{
    public function __construct(private ClinicSettingsService $settingsService) {}

    public function show(Request $request): JsonResponse
    {
        $clinic = $this->settingsService->getClinicWithSettings($request->user()->clinic_id);

        return response()->json(['data' => new ClinicSettingsResource($clinic)]);
    }

    public function updateClinicName(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
        ]);

        $clinic = $this->settingsService->updateClinicInfo(
            $request->user()->clinic,
            $validated,
        );

        return response()->json(['data' => new ClinicSettingsResource($clinic)]);
    }

    public function updateClinic(UpdateClinicRequest $request): JsonResponse
    {
        $clinic = $this->settingsService->updateClinicInfo(
            $request->user()->clinic,
            $request->validated(),
        );

        return response()->json(['data' => new ClinicSettingsResource($clinic)]);
    }

    public function updatePrescriptionSettings(UpdatePrescriptionSettingsRequest $request): JsonResponse
    {
        $clinic = $this->settingsService->updatePrescriptionSettings(
            $request->user()->clinic,
            $request->validated(),
        );

        return response()->json(['data' => new ClinicSettingsResource($clinic)]);
    }

    public function listTemplates(Request $request): JsonResponse
    {
        $clinicId      = $request->user()->clinic_id;
        $disk          = Storage::disk('public');
        $validExts     = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
        $activeTemplate = $request->user()->clinic->settings?->prescription_template;
        $templates     = [];

        // Scan server storage (uploaded templates)
        $storageDir = "prescription_templates/{$clinicId}";
        if ($disk->exists($storageDir)) {
            foreach ($disk->files($storageDir) as $path) {
                $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                if (!in_array($ext, $validExts)) continue;
                $name = basename($path);
                $templates[] = [
                    'name'      => $name,
                    'label'     => pathinfo($name, PATHINFO_FILENAME),
                    'url'       => $disk->url($path),
                    'type'      => $ext === 'pdf' ? 'pdf' : 'image',
                    'source'    => 'storage',
                    'is_active' => $activeTemplate === $name,
                ];
            }
        }

        // Also scan legacy public/prescriptiondoc for backwards compat
        $legacyDir = public_path('prescriptiondoc');
        if (is_dir($legacyDir)) {
            $existingNames = array_column($templates, 'name');
            foreach (glob($legacyDir . '/*') ?: [] as $file) {
                if (!is_file($file)) continue;
                $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                if (!in_array($ext, $validExts)) continue;
                $name = basename($file);
                if (in_array($name, $existingNames)) continue; // skip duplicates
                $templates[] = [
                    'name'      => $name,
                    'label'     => pathinfo($name, PATHINFO_FILENAME),
                    'url'       => url('prescriptiondoc/' . rawurlencode($name)),
                    'type'      => $ext === 'pdf' ? 'pdf' : 'image',
                    'source'    => 'legacy',
                    'is_active' => $activeTemplate === $name,
                ];
            }
        }

        return response()->json(['data' => $templates]);
    }

    public function uploadTemplate(Request $request): JsonResponse
    {
        $request->validate([
            'template' => 'required|file|mimes:pdf,png,jpg,jpeg,webp|max:10240',
        ]);

        $clinicId = $request->user()->clinic_id;
        $file     = $request->file('template');
        $ext      = strtolower($file->getClientOriginalExtension());
        $base     = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        $filename = $base . '_' . time() . '.' . $ext;

        $path = $file->storeAs("prescription_templates/{$clinicId}", $filename, 'public');

        return response()->json([
            'data' => [
                'name'      => $filename,
                'label'     => pathinfo($filename, PATHINFO_FILENAME),
                'url'       => Storage::disk('public')->url($path),
                'type'      => $ext === 'pdf' ? 'pdf' : 'image',
                'source'    => 'storage',
                'is_active' => false,
            ],
        ], 201);
    }

    public function deleteTemplate(Request $request, string $filename): JsonResponse
    {
        // Prevent path traversal
        if (str_contains($filename, '/') || str_contains($filename, '..') || str_contains($filename, '\\')) {
            return response()->json(['message' => 'Invalid filename.'], 422);
        }

        $clinicId = $request->user()->clinic_id;
        $disk     = Storage::disk('public');
        $path     = "prescription_templates/{$clinicId}/{$filename}";

        if (!$disk->exists($path)) {
            return response()->json(['message' => 'Template not found.'], 404);
        }

        // If this template is currently active, clear it
        $settings = $request->user()->clinic->settings;
        if ($settings && $settings->prescription_template === $filename) {
            $settings->update(['prescription_template' => null]);
        }

        $disk->delete($path);

        return response()->json(null, 204);
    }
}
