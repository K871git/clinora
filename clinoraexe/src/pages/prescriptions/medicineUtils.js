// Module-level counter — unique keys across all MedicineEditor instances
let _keyCounter = 0

/** Create a new medicine item for the editor, optionally pre-filled from API data */
export function newMedicineItem(src = {}) {
  return {
    _key:          ++_keyCounter,
    medicine_name: src.medicine_name ?? '',
    dosage:        src.dosage        ?? '',
    frequency:     src.frequency     ?? '',
    duration:      src.duration      ?? '',
    instructions:  src.instructions  ?? '',
  }
}
