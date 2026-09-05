<?php

namespace App\Services\Medicine;

use App\Models\Medicine;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;

class MedicineService
{
    public function search(int $clinicId, ?string $q = null, int $perPage = 100): LengthAwarePaginator
    {
        $q     = $q ?? '';
        $query = Medicine::where('clinic_id', $clinicId)->orderBy('name');

        if ($q !== '') {
            $query->where(function ($qb) use ($q) {
                $qb->where('name', 'like', '%' . $q . '%')
                   ->orWhere('generic_name', 'like', '%' . $q . '%');
            });
        }

        return $query->paginate($perPage);
    }

    public function create(int $clinicId, array $data): Medicine
    {
        return Medicine::create(array_merge(['clinic_id' => $clinicId], $data));
    }

    public function update(Medicine $medicine, array $data): Medicine
    {
        $medicine->update($data);
        return $medicine->fresh();
    }

    public function delete(Medicine $medicine): void
    {
        $medicine->delete();
    }

    public function findOrCreate(int $clinicId, string $name): Medicine
    {
        return Medicine::firstOrCreate(
            ['clinic_id' => $clinicId, 'name' => $name],
            ['quantity' => 0]
        );
    }

    public function importFromFile(int $clinicId, UploadedFile $file): array
    {
        $content = file_get_contents($file->getRealPath());
        $lines   = preg_split('/\r?\n/', trim($content));

        if (empty($lines)) {
            return ['imported' => 0, 'skipped' => 0];
        }

        $firstLine = $lines[0];
        $delimiter = str_contains($firstLine, "\t") ? "\t" : ',';
        $headers   = str_getcsv($firstLine, $delimiter);

        $hasHeaders = count($headers) > 1
            && preg_match('/^(name|medicine|drug|brand)/i', trim($headers[0]));

        $startLine = $hasHeaders ? 1 : 0;

        $colMap = [
            'name'         => 0,
            'generic_name' => null,
            'category'     => null,
            'unit'         => null,
            'price'        => null,
        ];

        if ($hasHeaders) {
            foreach ($headers as $i => $h) {
                $h = strtolower(trim($h));
                if (str_contains($h, 'generic'))                     $colMap['generic_name'] = $i;
                elseif (str_contains($h, 'categ'))                   $colMap['category']     = $i;
                elseif (str_contains($h, 'unit') || str_contains($h, 'form') || str_contains($h, 'dosage form')) $colMap['unit'] = $i;
                elseif (str_contains($h, 'price') || str_contains($h, 'cost') || str_contains($h, 'rate'))       $colMap['price'] = $i;
                elseif (str_contains($h, 'name') || str_contains($h, 'medicine') || str_contains($h, 'drug') || str_contains($h, 'brand')) $colMap['name'] = $i;
            }
        }

        $imported = 0;
        $skipped  = 0;

        for ($i = $startLine; $i < count($lines); $i++) {
            $line = trim($lines[$i]);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $row  = str_getcsv($line, $delimiter);
            $name = trim($row[$colMap['name']] ?? '');

            if ($name === '') {
                $skipped++;
                continue;
            }

            $exists = Medicine::where('clinic_id', $clinicId)
                ->whereRaw('LOWER(name) = ?', [strtolower($name)])
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            Medicine::create([
                'clinic_id'    => $clinicId,
                'name'         => $name,
                'generic_name' => $colMap['generic_name'] !== null
                    ? (trim($row[$colMap['generic_name']] ?? '') ?: null) : null,
                'category'     => $colMap['category'] !== null
                    ? (trim($row[$colMap['category']] ?? '') ?: null) : null,
                'unit'         => $colMap['unit'] !== null
                    ? (trim($row[$colMap['unit']] ?? '') ?: null) : null,
                'price'        => $colMap['price'] !== null && is_numeric(trim($row[$colMap['price']] ?? ''))
                    ? (float) trim($row[$colMap['price']]) : null,
            ]);

            $imported++;
        }

        return ['imported' => $imported, 'skipped' => $skipped];
    }
}
