<?php

namespace App\Http\Requests\Patient;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'          => ['required', 'string', 'max:150'],
            'mobile'        => ['required', 'string', 'max:20'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'age'           => ['nullable', 'integer', 'min:0', 'max:150'],
            'gender'        => ['nullable', 'in:male,female,other'],
            'address'       => ['nullable', 'string', 'max:500'],
        ];
    }
}
