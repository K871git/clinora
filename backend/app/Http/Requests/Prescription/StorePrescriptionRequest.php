<?php

namespace App\Http\Requests\Prescription;

use Illuminate\Foundation\Http\FormRequest;

class StorePrescriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'prescribed_at'          => ['required', 'date'],
            'doctor_notes'           => ['nullable', 'string', 'max:10000'],
            'items'                  => ['nullable', 'array'],
            'items.*.medicine_name'  => ['required', 'string', 'max:200'],
            'items.*.dosage'         => ['nullable', 'string', 'max:100'],
            'items.*.frequency'      => ['nullable', 'string', 'max:100'],
            'items.*.duration'       => ['nullable', 'string', 'max:100'],
            'items.*.instructions'   => ['nullable', 'string', 'max:2000'],
            'items.*.sort_order'     => ['nullable', 'integer', 'min:0'],
        ];
    }
}
