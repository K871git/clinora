/// Overlay prescription data onto a PDF template using lopdf.
/// Called after create_prescription / update_prescription.

use lopdf::{Dictionary, Document, Object, ObjectId, Stream};
use std::fmt::Write as _;
use std::path::Path;

const MM2PT: f64 = 72.0 / 25.4;
const A4_H_PT: f64 = 841.89;

pub struct RxData {
    pub patient_name: String,
    pub date_dd: u32,
    pub date_mm: u32,
    pub date_yyyy: i32,
    pub medicines: Vec<MedItem>,
    pub doctor_notes: Option<String>,
    pub doctor_name: String,
}

pub struct MedItem {
    pub num: usize,
    pub name: String,
    /// stored as "1-1-1 Before Meal" or similar
    pub dosage: Option<String>,
    pub duration: Option<String>,
    pub instructions: Option<String>,
}

pub struct Layout {
    pub name_x_mm: f64,
    pub name_y_mm: f64,
    pub date_x_mm: f64,
    pub date_y_mm: f64,
    pub date_slot_w: f64,
    pub meds_x_mm: f64,
    pub meds_start_y_mm: f64,
    pub page_h_pt: f64,
}

impl Layout {
    pub fn from_scan(v: &serde_json::Value) -> Self {
        let f = |k: &str, def: f64| v.get(k).and_then(|x| x.as_f64()).unwrap_or(def);
        Layout {
            name_x_mm:       f("name_x",      38.0),
            name_y_mm:       f("name_y",      68.0),
            date_x_mm:       f("date_x",     155.0),
            date_y_mm:       f("date_y",      68.0),
            date_slot_w:     f("date_slot_w", 10.5),
            meds_x_mm:       f("meds_x",      18.0),
            meds_start_y_mm: f("meds_start_y", 96.0),
            page_h_pt: A4_H_PT,
        }
    }
}

/// Build raw PDF content stream bytes for the text overlay.
fn build_stream(layout: &Layout, rx: &RxData) -> String {
    let ph = layout.page_h_pt;
    let x = |mm: f64| mm * MM2PT;
    let y = |mm: f64| ph - mm * MM2PT;

    let mut b = String::new();

    let _ = writeln!(b, "q");
    let _ = writeln!(b, "0 0 0 rg");

    // ── Patient name ─────────────────────────────────────────────────
    let _ = writeln!(b, "BT");
    let _ = writeln!(b, "/ClinHB 11 Tf");
    let _ = writeln!(b, "{:.2} {:.2} Td", x(layout.name_x_mm), y(layout.name_y_mm));
    let _ = writeln!(b, "({}) Tj", ps(&rx.patient_name));
    let _ = writeln!(b, "ET");

    // ── Date — three spans: DD  MM  YYYY (template already has "/" chars) ──
    let dy = y(layout.date_y_mm);
    let slot = layout.date_slot_w * MM2PT;

    let _ = writeln!(b, "BT /ClinH 10 Tf {:.2} {:.2} Td ({:02}) Tj ET",
        x(layout.date_x_mm), dy, rx.date_dd);
    let _ = writeln!(b, "BT /ClinH 10 Tf {:.2} {:.2} Td ({:02}) Tj ET",
        x(layout.date_x_mm) + slot, dy, rx.date_mm);
    let _ = writeln!(b, "BT /ClinH 10 Tf {:.2} {:.2} Td ({}) Tj ET",
        x(layout.date_x_mm) + slot * 2.0, dy, rx.date_yyyy);

    // ── Medicines ─────────────────────────────────────────────────────
    let line_mm  = 5.5_f64; // height per sub-line
    let indent   = 4.5_f64; // mm indent for meta/notes after number+name

    let mut cur = layout.meds_start_y_mm;

    for med in &rx.medicines {
        // Number + medicine name (bold)
        let name_line = format!("{}. {}", med.num, med.name);
        let _ = writeln!(b, "BT /ClinHB 10 Tf {:.2} {:.2} Td ({}) Tj ET",
            x(layout.meds_x_mm), y(cur), ps(&name_line));
        cur += line_mm;

        // Timing / duration / qty on indented next line (regular)
        let mut meta: Vec<String> = Vec::new();
        if let Some(ref dos) = med.dosage {
            let parts: Vec<&str> = dos.splitn(2, ' ').collect();
            let timing = parse_timing(parts[0]);
            if !timing.is_empty() { meta.push(timing); }
            if let Some(meal) = parts.get(1) {
                if !meal.trim().is_empty() { meta.push(meal.trim().to_string()); }
            }
        }
        if let Some(ref dur) = med.duration {
            meta.push(dur.trim().to_string());
        }
        let meta_str = meta.join("  |  ");
        if !meta_str.is_empty() {
            let _ = writeln!(b, "BT /ClinH 8.5 Tf {:.2} {:.2} Td ({}) Tj ET",
                x(layout.meds_x_mm + indent), y(cur), ps(&meta_str));
            cur += line_mm;
        }

        // Instructions / notes
        if let Some(ref inst) = med.instructions {
            let t = inst.trim();
            if !t.is_empty() {
                let note = format!("Note: {}", t);
                let _ = writeln!(b, "BT /ClinH 8 Tf {:.2} {:.2} Td ({}) Tj ET",
                    x(layout.meds_x_mm + indent), y(cur), ps(&note));
                cur += line_mm;
            }
        }

        cur += 2.0; // gap between medicines
    }

    // ── Doctor notes ──────────────────────────────────────────────────
    if let Some(ref notes) = rx.doctor_notes {
        let t = notes.trim();
        if !t.is_empty() {
            cur += 3.0;
            let note = format!("Notes: {}", t);
            let _ = writeln!(b, "BT /ClinH 9 Tf {:.2} {:.2} Td ({}) Tj ET",
                x(layout.meds_x_mm), y(cur), ps(&note));
        }
    }

    // ── Signature (bottom-right, ~20mm from bottom) ───────────────────
    let sig_y_mm = (ph - 52.0) / MM2PT;   // 52pt from bottom
    let sig_x_mm = 140.0_f64;
    let sig = format!("Dr. {}", rx.doctor_name);
    let _ = writeln!(b, "BT /ClinHB 9 Tf {:.2} {:.2} Td ({}) Tj ET",
        x(sig_x_mm), y(sig_y_mm), ps(&sig));

    let _ = writeln!(b, "Q");
    b
}

/// Escape PDF string content (ASCII only; non-ASCII becomes '?').
fn ps(s: &str) -> String {
    s.chars().map(|c| match c {
        '(' => "\\(".to_string(),
        ')' => "\\)".to_string(),
        '\\' => "\\\\".to_string(),
        c if c.is_ascii() && !c.is_ascii_control() => c.to_string(),
        _ => "?".to_string(),
    }).collect()
}

/// "1-1-1" → "Morning - Afternoon - Evening", "1-0-1" → "Morning - Evening"
fn parse_timing(raw: &str) -> String {
    let parts: Vec<&str> = raw.split('-').collect();
    if parts.len() != 3 { return raw.to_string(); }
    let labels = ["Morning", "Afternoon", "Evening"];
    parts.iter().zip(labels.iter())
        .filter(|(p, _)| **p == "1")
        .map(|(_, l)| *l)
        .collect::<Vec<_>>()
        .join(" - ")
}

/// Add a Type1 font (Helvetica or Helvetica-Bold) to the document.
fn add_font(doc: &mut Document, base: &[u8]) -> ObjectId {
    let mut d = Dictionary::new();
    d.set("Type",     Object::Name(b"Font".to_vec()));
    d.set("Subtype",  Object::Name(b"Type1".to_vec()));
    d.set("BaseFont", Object::Name(base.to_vec()));
    d.set("Encoding", Object::Name(b"WinAnsiEncoding".to_vec()));
    doc.add_object(Object::Dictionary(d))
}

/// Merge ClinH/ClinHB into an existing Font dict.
fn patch_font_dict(fd: &mut Dictionary, helv: ObjectId, helv_b: ObjectId) {
    fd.set("ClinH",  Object::Reference(helv));
    fd.set("ClinHB", Object::Reference(helv_b));
}

/// Add font resources to the page, handling both inline and indirect Resources.
fn add_fonts_to_page(
    doc: &mut Document,
    page_id: ObjectId,
    helv: ObjectId,
    helv_b: ObjectId,
) {
    // First, determine if Resources is an indirect ref (clone to avoid borrow issues)
    let res_ref: Option<ObjectId> = doc
        .get_dictionary(page_id)
        .ok()
        .and_then(|d| d.get(b"Resources").ok())
        .and_then(|o| if let Object::Reference(r) = o { Some(*r) } else { None });

    if let Some(res_id) = res_ref {
        // Resources is indirect — patch that dict
        if let Ok(Object::Dictionary(ref mut rd)) = doc.get_object_mut(res_id) {
            match rd.get_mut(b"Font") {
                Ok(Object::Dictionary(ref mut fd)) => patch_font_dict(fd, helv, helv_b),
                _ => {
                    let mut fd = Dictionary::new();
                    patch_font_dict(&mut fd, helv, helv_b);
                    rd.set("Font", Object::Dictionary(fd));
                }
            }
        }
    } else {
        // Resources is inline or absent — patch page dict directly
        if let Ok(Object::Dictionary(ref mut pd)) = doc.get_object_mut(page_id) {
            match pd.get_mut(b"Resources") {
                Ok(Object::Dictionary(ref mut rd)) => {
                    match rd.get_mut(b"Font") {
                        Ok(Object::Dictionary(ref mut fd)) => patch_font_dict(fd, helv, helv_b),
                        _ => {
                            let mut fd = Dictionary::new();
                            patch_font_dict(&mut fd, helv, helv_b);
                            rd.set("Font", Object::Dictionary(fd));
                        }
                    }
                }
                _ => {
                    let mut fd = Dictionary::new();
                    patch_font_dict(&mut fd, helv, helv_b);
                    let mut rd = Dictionary::new();
                    rd.set("Font", Object::Dictionary(fd));
                    pd.set("Resources", Object::Dictionary(rd));
                }
            }
        }
    }
}

/// Generate a filled prescription PDF from a template and save it to `output_path`.
pub fn generate(
    template_path: &str,
    output_path: &str,
    layout: &Layout,
    rx: &RxData,
) -> Result<(), String> {
    let mut doc = Document::load(template_path)
        .map_err(|e| format!("Cannot load template: {}", e))?;

    let page_id = *doc.get_pages().get(&1)
        .ok_or("Template PDF has no pages")?;

    // Build and add overlay content stream
    let content_bytes = build_stream(layout, rx).into_bytes();
    let mut sd = Dictionary::new();
    sd.set("Length", Object::Integer(content_bytes.len() as i64));
    let overlay_id = doc.add_object(Object::Stream(Stream::new(sd, content_bytes)));

    // Add font objects to document
    let helv   = add_font(&mut doc, b"Helvetica");
    let helv_b = add_font(&mut doc, b"Helvetica-Bold");

    // Append overlay stream to page Contents
    {
        let old_contents: Option<Object> = doc
            .get_dictionary(page_id).ok()
            .and_then(|d| d.get(b"Contents").ok().cloned());

        if let Ok(Object::Dictionary(ref mut pd)) = doc.get_object_mut(page_id) {
            let new_arr = match old_contents {
                Some(Object::Array(mut arr)) => {
                    arr.push(Object::Reference(overlay_id));
                    arr
                }
                Some(r @ Object::Reference(_)) => vec![r, Object::Reference(overlay_id)],
                _ => vec![Object::Reference(overlay_id)],
            };
            pd.set("Contents", Object::Array(new_arr));
        }
    }

    // Add fonts to page Resources
    add_fonts_to_page(&mut doc, page_id, helv, helv_b);

    // Ensure output directory exists
    if let Some(parent) = Path::new(output_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }

    doc.save(output_path).map_err(|e| format!("Cannot save PDF: {}", e))?;
    Ok(())
}
