<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateClinicRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'          => ['required', 'string', 'max:150'],
            'doctor_name'   => ['required', 'string', 'max:150'],
            'qualification' => ['nullable', 'string', 'max:150'],
            'address'       => ['nullable', 'string', 'max:500'],
            'contact'       => ['nullable', 'string', 'max:30'],
            'logo_path'     => ['nullable', 'string', 'max:255'],
        ];
    }
}
