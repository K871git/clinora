<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\ClinicSetting;
use App\Models\Prescription;
use App\Services\Prescription\TemplateLayoutScanner;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use setasign\Fpdi\Fpdi;

class PrescriptionPdfController extends Controller
{
    // Per-line heights (mm)
    private const LH_NAME     = 7.0;
    private const LH_MED_NAME = 7.0;
    private const LH_MED_META = 6.0;
    private const LH_INSTRUCT = 5.5;
    private const LH_MED_GAP  = 4.0;
    private const LH_NOTE     = 6.5;

    // Page 2 notes start position
    private const PAGE2_Y = 30.0;

    /* ──────────────────────────────────────────────────────────────────── */

    public function generate(Request $request, Prescription $prescription): Response
    {
        $this->authorize('view', $prescription);

        $prescription->load(['patient', 'items']);

        $settings     = ClinicSetting::where('clinic_id', $prescription->clinic_id)->first();
        $templateFile = $this->resolveTemplatePath($settings, $prescription->clinic_id);

        if ($templateFile === null) {
            abort(404, 'No active prescription template configured for this clinic.');
        }

        // Auto-detect layout from the template PDF
        $layout = (new TemplateLayoutScanner())->scan($templateFile);

        $pdf = $this->buildPdf($prescription, $templateFile, $layout);

        $bytes = $pdf->Output('S');

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="prescription-' . $prescription->id . '.pdf"',
            'Cache-Control'       => 'private, no-store',
        ]);
    }

    /* ── PDF builder ─────────────────────────────────────────────────────── */

    private function buildPdf(Prescription $prescription, string $templateFile, array $L): Fpdi
    {
        $pdf = new Fpdi('P', 'mm', [210, 297]);
        $pdf->SetMargins(0, 0, 0);
        $pdf->SetAutoPageBreak(false, 0);
        $pdf->SetTextColor(0, 0, 0);

        // Page 1
        $pdf->AddPage();
        $pageCount = $pdf->setSourceFile($templateFile);
        $tpl1      = $pdf->importPage(1);
        $pdf->useTemplate($tpl1, 0, 0, 210, 297);

        $this->writePatientInfo($pdf, $prescription, $L);
        $nextY = $this->writeMedicines($pdf, $prescription->items, $L);

        // Notes: anchored to the bottom of the page (just above footer/address).
        // If medicines overflow past the anchor, notes go to page 2.
        $notes = trim($prescription->doctor_notes ?? '');
        if ($notes !== '') {
            $notesH = $this->estimateNotesHeight($notes);

            // Bottom-anchor: place notes just above the address line.
            // Fall back to right-after-medicines only if medicines already pushed past the anchor.
            $anchoredY = $L['notes_anchor_y'] - $notesH;
            $notesStart = max($nextY + 6, $anchoredY);

            if ($notesStart + $notesH <= $L['notes_max_y']) {
                $this->writeNotes($pdf, $notes, $notesStart, $L);
            } else {
                $pdf->AddPage();
                if ($pageCount > 1) {
                    $tpl2 = $pdf->importPage(2);
                    $pdf->useTemplate($tpl2, 0, 0, 210, 297);
                }
                $this->writeNotesPage2($pdf, $notes, $L);
            }
        }

        return $pdf;
    }

    /* ── Section writers ─────────────────────────────────────────────────── */

    private function writePatientInfo(Fpdi $pdf, Prescription $prescription, array $L): void
    {
        $name = $this->enc($prescription->patient->name ?? '');
        $dt   = $prescription->prescribed_at ?? now();

        $pdf->SetFont('Helvetica', 'B', 13);
        $pdf->SetTextColor(0, 0, 0);

        // Patient name on the "Name –" underline
        $pdf->SetXY($L['name_x'], $L['name_y']);
        $pdf->Cell($L['name_w'], self::LH_NAME, $name);

        // Day / Month / Year in the three template slots (separated by pre-printed slashes)
        $pdf->SetXY($L['date_day_x'], $L['date_y']);
        $pdf->Cell(8.0, self::LH_NAME, $dt->format('d'), 0, 0, 'C');

        $pdf->SetXY($L['date_mon_x'], $L['date_y']);
        $pdf->Cell(8.0, self::LH_NAME, $dt->format('m'), 0, 0, 'C');

        $pdf->SetXY($L['date_year_x'], $L['date_y']);
        $pdf->Cell(22.0, self::LH_NAME, $dt->format('Y'), 0, 0, 'C');
    }

    private function writeMedicines(Fpdi $pdf, $items, array $L): float
    {
        $x = $L['meds_x'];
        $w = $L['meds_w'];
        $y = $L['meds_start_y'];

        foreach ($items as $idx => $item) {
            // Number + name
            $pdf->SetFont('Helvetica', 'B', 13);
            $pdf->SetTextColor(0, 0, 0);
            $pdf->SetXY($x, $y);
            $pdf->Cell(6, self::LH_MED_NAME, ($idx + 1) . '.');

            $pdf->SetXY($x + 6, $y);
            $pdf->Cell($w - 6, self::LH_MED_NAME, $this->enc($item->medicine_name ?? ''));
            $y += self::LH_MED_NAME;

            // Dosage - frequency - duration
            $meta = implode('  –  ', array_filter([
                $item->dosage,
                $item->frequency,
                $item->duration,
            ]));
            if ($meta !== '') {
                $pdf->SetFont('Helvetica', '', 11);
                $pdf->SetXY($x + 6, $y);
                $pdf->Cell($w - 6, self::LH_MED_META, $this->enc($meta));
                $y += self::LH_MED_META;
            }

            // Instructions
            if (!empty($item->instructions)) {
                $pdf->SetFont('Helvetica', 'I', 10.5);
                $pdf->SetXY($x + 6, $y);
                $pdf->Cell($w - 6, self::LH_INSTRUCT, $this->enc($item->instructions));
                $y += self::LH_INSTRUCT;
            }

            $y += self::LH_MED_GAP;
        }

        return $y;
    }

    private function writeNotes(Fpdi $pdf, string $notes, float $startY, array $L): void
    {
        $x = $L['meds_x'];

        $pdf->SetFont('Helvetica', 'B', 11);
        $pdf->SetTextColor(80, 80, 80);
        $pdf->SetXY($x, $startY);
        $pdf->Cell(0, 6, 'NOTES');

        $pdf->SetFont('Helvetica', '', 12);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetXY($x, $startY + 7);
        $pdf->MultiCell($L['meds_w'] + 50, self::LH_NOTE, $this->enc($notes));
        $pdf->SetTextColor(0, 0, 0);
    }

    private function writeNotesPage2(Fpdi $pdf, string $notes, array $L): void
    {
        $x = $L['meds_x'];

        $pdf->SetFont('Helvetica', 'B', 11);
        $pdf->SetTextColor(80, 80, 80);
        $pdf->SetXY($x, self::PAGE2_Y);
        $pdf->Cell(0, 6, 'DOCTOR NOTES (continued)');

        $pdf->SetFont('Helvetica', '', 12);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetXY($x, self::PAGE2_Y + 8);
        $pdf->MultiCell(174, self::LH_NOTE, $this->enc($notes));
        $pdf->SetTextColor(0, 0, 0);
    }

    /* ── Helpers ─────────────────────────────────────────────────────────── */

    private function estimateNotesHeight(string $notes): float
    {
        $lines = max(1, (int) ceil(mb_strlen($notes) / 65));
        $lines += substr_count($notes, "\n");
        return 6 + ($lines * self::LH_NOTE);
    }

    /** Convert UTF-8 text to windows-1252 (FPDF default encoding) */
    private function enc(string $text): string
    {
        return iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', $text) ?: $text;
    }

    private function resolveTemplatePath(?ClinicSetting $settings, int $clinicId): ?string
    {
        if (!$settings || !$settings->prescription_template) {
            return null;
        }

        $filename = basename($settings->prescription_template);
        if (!preg_match('/\.pdf$/i', $filename)) {
            return null;
        }

        $path = storage_path("app/public/prescription_templates/{$clinicId}/{$filename}");

        return file_exists($path) ? $path : null;
    }
}
