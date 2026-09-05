<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePrescriptionSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'prescription_header' => ['nullable', 'string', 'max:1000'],
            'prescription_footer' => ['nullable', 'string', 'max:1000'],
            'show_doctor_contact'   => ['nullable', 'boolean'],
            'show_clinic_contact'   => ['nullable', 'boolean'],
            'prescription_template' => ['nullable', 'string', 'max:255'],
        ];
    }
}
