<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class ClinicSettingsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'clinic' => [
                'id'            => $this->id,
                'name'          => $this->name,
                'doctor_name'   => $this->doctor_name,
                'qualification' => $this->qualification,
                'address'       => $this->address,
                'contact'       => $this->contact,
                'logo_path'     => $this->logo_path,
            ],
            'prescription_settings' => [
                'prescription_header'       => $this->settings?->prescription_header,
                'prescription_footer'       => $this->settings?->prescription_footer,
                'show_doctor_contact'       => $this->settings?->show_doctor_contact ?? true,
                'show_clinic_contact'       => $this->settings?->show_clinic_contact ?? true,
                'prescription_template'     => $this->settings?->prescription_template,
                'prescription_template_url' => $this->resolveTemplateUrl(),
            ],
        ];
    }

    private function resolveTemplateUrl(): ?string
    {
        $filename = $this->settings?->prescription_template;
        if (!$filename) return null;

        // Uploaded files live in storage; check there first
        $storagePath = "prescription_templates/{$this->id}/{$filename}";
        if (Storage::disk('public')->exists($storagePath)) {
            return Storage::disk('public')->url($storagePath);
        }

        // Fall back to legacy public/prescriptiondoc folder
        return url('prescriptiondoc/' . rawurlencode($filename));
    }
}
