<?php

namespace App\Services\Prescription;

use Smalot\PdfParser\Parser;

/**
 * Scans a prescription PDF template to detect exact positions of key elements.
 * All values returned are in mm from the top-left corner (FPDF coordinate space).
 */
class TemplateLayoutScanner
{
    private const A4_H_PT = 841.89;
    private const PT_MM   = 25.4 / 72;

    // FPDF Cell() places text baseline ~5 mm below the cell's top Y.
    // The pdfparser gives us the baseline, so we subtract this offset
    // to get the correct Cell Y that aligns text with the template label.
    private const BASELINE_OFFSET = 5.0;

    // Offset from the detected "Name -" label start to where the patient value goes
    private const NAME_LABEL_W = 20.0;

    // Offset from the detected "Date :" label start to the first slot (day)
    private const DATE_LABEL_W  = 14.0;
    // Width of each date slot (day / month / year)
    private const DATE_SLOT_W   = 9.0;

    public function scan(string $pdfPath): array
    {
        try {
            $parser = new Parser();
            $pdf    = $parser->parseFile($pdfPath);
            $pages  = $pdf->getPages();

            if (empty($pages)) {
                return $this->defaults();
            }

            $items = $pages[0]->getDataTm();

            $nameLabelX = null;
            $nameBaseY  = null;
            $dateLabelX = null;
            $dateBaseY  = null;
            $rxBaseY    = null;
            $footerY    = null; // topmost footer/address line

            foreach ($items as [$tm, $text]) {
                $t    = trim($text);
                $tLow = strtolower($t);
                if ($t === '') {
                    continue;
                }

                $xMm = (float) $tm[4] * self::PT_MM;
                $yMm = (self::A4_H_PT - (float) $tm[5]) * self::PT_MM;

                if ($nameBaseY === null && str_contains($tLow, 'name')) {
                    $nameLabelX = $xMm;
                    $nameBaseY  = $yMm;
                }

                if ($dateBaseY === null && str_contains($tLow, 'date')) {
                    $dateLabelX = $xMm;
                    $dateBaseY  = $yMm;
                }

                if ($rxBaseY === null && (
                    $tLow === 'rx' || str_contains($t, 'Rx') || str_contains($t, 'ℝ')
                )) {
                    $rxBaseY = $yMm;
                }

                // Footer: lines in the bottom 25% of the A4 page (y > 220 mm)
                if ($yMm > 220 && ($footerY === null || $yMm < $footerY)) {
                    $footerY = $yMm;
                }
            }

            // Convert detected baselines to FPDF Cell top-Y
            $nameY = ($nameBaseY ?? 68.0) - self::BASELINE_OFFSET;
            $dateY = ($dateBaseY ?? $nameBaseY ?? 68.0) - self::BASELINE_OFFSET;

            // Medicines start below the Rx symbol (or estimated from name row)
            $medsY = $rxBaseY
                ? ($rxBaseY - self::BASELINE_OFFSET + 14.0)
                : ($nameY + 30.0);

            // Notes anchor: place notes just above the footer address line
            $notesAnchorY = $footerY ? ($footerY - 12.0) : 268.0;

            // Name field starts after the "Name -" label
            $nameX  = ($nameLabelX ?? 18.0) + self::NAME_LABEL_W;

            // Date slots
            $dayX  = ($dateLabelX ?? 151.0) + self::DATE_LABEL_W;
            $monX  = $dayX + self::DATE_SLOT_W;
            $yearX = $monX + self::DATE_SLOT_W;

            return [
                'name_x'        => $nameX,
                'name_y'        => $nameY,
                'name_w'        => 100.0,
                'date_day_x'    => $dayX,
                'date_mon_x'    => $monX,
                'date_year_x'   => $yearX,
                'date_y'        => $dateY,
                'meds_x'        => ($nameLabelX ?? 18.0),
                'meds_start_y'  => $medsY,
                'meds_w'        => 130.0,
                'notes_anchor_y'=> $notesAnchorY,
                'notes_max_y'   => $notesAnchorY + 5.0,
            ];

        } catch (\Throwable $e) {
            return $this->defaults();
        }
    }

    private function defaults(): array
    {
        return [
            'name_x'        => 38.0,
            'name_y'        => 63.0,
            'name_w'        => 100.0,
            'date_day_x'    => 165.0,
            'date_mon_x'    => 174.0,
            'date_year_x'   => 183.0,
            'date_y'        => 63.0,
            'meds_x'        => 18.0,
            'meds_start_y'  => 96.0,
            'meds_w'        => 130.0,
            'notes_anchor_y'=> 268.0,
            'notes_max_y'   => 273.0,
        ];
    }
}
