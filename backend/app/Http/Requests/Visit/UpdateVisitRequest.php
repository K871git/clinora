<?php

namespace App\Http\Requests\Visit;

use Illuminate\Foundation\Http\FormRequest;

class UpdateVisitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'visited_at'         => ['required', 'date'],
            'consultation_notes' => ['nullable', 'string', 'max:10000'],
        ];
    }
}
