use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct MedicinePayload {
    pub name: String,
    pub generic_name: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub quantity: Option<u32>,
    pub price: Option<f64>,
}

const MEDICINE_COLS: &str =
    "id, clinic_id, name, generic_name, category, unit, quantity, price * 1e0 as price";

fn medicine_row(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id": r.get::<u64, _>("id"),
        "name": r.get::<String, _>("name"),
        "generic_name": r.get::<Option<String>, _>("generic_name"),
        "category": r.get::<Option<String>, _>("category"),
        "unit": r.get::<Option<String>, _>("unit"),
        "quantity": r.get::<u32, _>("quantity"),
        "price": r.get::<Option<f64>, _>("price")
    })
}

#[tauri::command]
pub async fn list_medicines(q: Option<String>, per_page: Option<u32>, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let per_page = per_page.unwrap_or(500).min(1000);
    let has_q = q.as_ref().map(|q| !q.trim().is_empty()).unwrap_or(false);

    let sql = if has_q {
        format!("SELECT {} FROM medicines WHERE clinic_id=? AND (name LIKE ? OR generic_name LIKE ?) ORDER BY name ASC LIMIT {}", MEDICINE_COLS, per_page)
    } else {
        format!("SELECT {} FROM medicines WHERE clinic_id=? ORDER BY name ASC LIMIT {}", MEDICINE_COLS, per_page)
    };

    let mut query = sqlx::query(&sql).bind(session.clinic_id);
    if has_q {
        let like = format!("%{}%", q.unwrap().trim());
        query = query.bind(like.clone()).bind(like);
    }

    let rows = query.fetch_all(&state.db).await?;
    let data: Vec<Value> = rows.iter().map(medicine_row).collect();
    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn create_medicine(data: MedicinePayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let generic_name = data.generic_name.filter(|s| !s.trim().is_empty());
    let category     = data.category.filter(|s| !s.trim().is_empty());
    let unit         = data.unit.filter(|s| !s.trim().is_empty());
    let result = sqlx::query(
        "INSERT INTO medicines (clinic_id, name, generic_name, category, unit, quantity, price, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
    )
    .bind(session.clinic_id).bind(&data.name).bind(&generic_name)
    .bind(&category).bind(&unit).bind(data.quantity.unwrap_or(0)).bind(data.price)
    .execute(&state.db).await?;

    let row = sqlx::query(&format!("SELECT {} FROM medicines WHERE id=?", MEDICINE_COLS))
        .bind(result.last_insert_id()).fetch_one(&state.db).await?;
    Ok(medicine_row(&row))
}

#[tauri::command]
pub async fn update_medicine(id: u64, data: MedicinePayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let generic_name = data.generic_name.filter(|s| !s.trim().is_empty());
    let category     = data.category.filter(|s| !s.trim().is_empty());
    let unit         = data.unit.filter(|s| !s.trim().is_empty());
    sqlx::query(
        "UPDATE medicines SET name=?, generic_name=?, category=?, unit=?, quantity=?, price=?, updated_at=NOW()
         WHERE id=? AND clinic_id=?"
    )
    .bind(&data.name).bind(&generic_name).bind(&category)
    .bind(&unit).bind(data.quantity.unwrap_or(0)).bind(data.price)
    .bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;

    let row = sqlx::query(&format!("SELECT {} FROM medicines WHERE id=?", MEDICINE_COLS))
        .bind(id).fetch_one(&state.db).await?;
    Ok(medicine_row(&row))
}

#[tauri::command]
pub async fn delete_medicine(id: u64, state: State<'_, AppState>) -> AppResult<()> {
    let session = get_session(&state)?;
    sqlx::query("DELETE FROM medicines WHERE id=? AND clinic_id=?")
        .bind(id).bind(session.clinic_id).execute(&state.db).await?;
    Ok(())
}

#[derive(Deserialize)]
pub struct MedicineImportItem {
    pub name: String,
    pub generic_name: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub quantity: Option<u32>,
    pub price: Option<f64>,
}

#[tauri::command]
pub async fn import_medicines(items: Vec<MedicineImportItem>, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let mut imported = 0u32;
    let mut skipped = 0u32;

    let existing_rows = sqlx::query("SELECT LOWER(name) as lname FROM medicines WHERE clinic_id=?")
        .bind(session.clinic_id).fetch_all(&state.db).await?;
    let existing: std::collections::HashSet<String> = existing_rows.iter()
        .map(|r| r.get::<String, _>("lname")).collect();

    for item in &items {
        let name = item.name.trim();
        if name.is_empty() || existing.contains(&name.to_lowercase()) { skipped += 1; continue; }
        let generic_name = item.generic_name.as_deref().filter(|s| !s.trim().is_empty());
        let category     = item.category.as_deref().filter(|s| !s.trim().is_empty());
        let unit         = item.unit.as_deref().filter(|s| !s.trim().is_empty());
        sqlx::query(
            "INSERT INTO medicines (clinic_id, name, generic_name, category, unit, quantity, price, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
        )
        .bind(session.clinic_id).bind(name).bind(generic_name)
        .bind(category).bind(unit).bind(item.quantity.unwrap_or(0)).bind(item.price)
        .execute(&state.db).await?;
        imported += 1;
    }

    Ok(json!({ "imported": imported, "skipped": skipped }))
}

// ── Document parsing (PDF / DOCX) ────────────────────────────────────────────

#[tauri::command]
pub async fn parse_medicine_document(bytes: Vec<u8>, ext: String) -> AppResult<Vec<Vec<String>>> {
    match ext.to_lowercase().trim_matches('.') {
        "pdf"  => parse_pdf_rows(bytes),
        "docx" => parse_docx_rows(bytes),
        e      => Err(format!("Unsupported format: {}", e).into()),
    }
}

fn pdf_num_med(obj: &lopdf::Object) -> f64 {
    match obj {
        lopdf::Object::Integer(i) => *i as f64,
        lopdf::Object::Real(f)   => *f as f64,
        _                        => 0.0,
    }
}

fn pdf_text_med(op: &lopdf::content::Operation) -> String {
    op.operands.first().map(|o| match o {
        lopdf::Object::String(b, _) => String::from_utf8_lossy(b).into_owned(),
        lopdf::Object::Array(arr)   => arr.iter().filter_map(|item| {
            if let lopdf::Object::String(b, _) = item {
                Some(String::from_utf8_lossy(b).into_owned())
            } else { None }
        }).collect(),
        _ => String::new(),
    }).unwrap_or_default()
}

fn parse_pdf_rows(bytes: Vec<u8>) -> AppResult<Vec<Vec<String>>> {
    let doc = lopdf::Document::load_mem(&bytes).map_err(|e| format!("PDF error: {}", e))?;

    let mut tokens: Vec<(f64, f64, String)> = Vec::new();

    for (_num, page_id) in doc.get_pages() {
        let raw = match doc.get_page_content(page_id) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let content = match lopdf::content::Content::decode(&raw) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut cx = 0.0_f64;
        let mut cy = 0.0_f64;

        for op in &content.operations {
            match op.operator.as_str() {
                "Tm" if op.operands.len() == 6 => {
                    cx = pdf_num_med(&op.operands[4]);
                    cy = pdf_num_med(&op.operands[5]);
                }
                "Td" | "TD" if op.operands.len() >= 2 => {
                    cx += pdf_num_med(&op.operands[0]);
                    cy += pdf_num_med(&op.operands[1]);
                }
                "Tj" | "TJ" => {
                    let t = pdf_text_med(op);
                    let t = t.trim().to_string();
                    if !t.is_empty() { tokens.push((cx, cy, t)); }
                }
                _ => {}
            }
        }
    }

    if tokens.is_empty() { return Ok(vec![]); }

    // Group tokens by y-coordinate (tolerance ±4 pts), then sort each row left→right
    let mut rows: Vec<(f64, Vec<(f64, String)>)> = Vec::new();
    for (x, y, text) in tokens {
        let mut placed = false;
        for (row_y, cells) in &mut rows {
            if (*row_y - y).abs() < 4.0 {
                cells.push((x, text.clone()));
                placed = true;
                break;
            }
        }
        if !placed { rows.push((y, vec![(x, text)])); }
    }

    // Sort rows top→bottom (y descending in PDF coords), cells left→right
    rows.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    Ok(rows.into_iter().map(|(_, mut cells)| {
        cells.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        cells.into_iter().map(|(_, t)| t).collect()
    }).collect())
}

// ── DOCX helpers ─────────────────────────────────────────────────────────────

fn parse_docx_rows(bytes: Vec<u8>) -> AppResult<Vec<Vec<String>>> {
    use std::io::{Cursor, Read};
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| format!("DOCX open error: {}", e))?;
    let mut xml = String::new();
    archive.by_name("word/document.xml")
        .map_err(|_| "Invalid DOCX: missing document.xml")?
        .read_to_string(&mut xml)
        .map_err(|e| format!("DOCX read error: {}", e))?;

    if xml.contains("<w:tbl") {
        Ok(extract_docx_table_rows(&xml))
    } else {
        Ok(extract_docx_para_rows(&xml))
    }
}

fn next_tag(s: &str, from: usize, prefix: &str) -> Option<usize> {
    let mut pos = from;
    let plen = prefix.len();
    loop {
        let rel = s[pos..].find(prefix)?;
        let abs = pos + rel;
        let after = s.as_bytes().get(abs + plen).copied().unwrap_or(b'x');
        if after == b'>' || after == b' ' { return Some(abs); }
        pos = abs + plen;
    }
}

fn wt_text(fragment: &str) -> String {
    let mut out = String::new();
    let mut pos = 0;
    while let Some(rel) = fragment[pos..].find("<w:t") {
        let abs = pos + rel;
        let after = fragment.as_bytes().get(abs + 4).copied().unwrap_or(b'x');
        if after != b'>' && after != b' ' { pos = abs + 4; continue; }
        let rest = &fragment[abs..];
        if let Some(gt) = rest.find('>') {
            let ts = abs + gt + 1;
            if let Some(end) = fragment[ts..].find("</w:t>") {
                let text = &fragment[ts..ts + end];
                out.push_str(&text.replace("&amp;", "&").replace("&lt;", "<")
                    .replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'"));
                pos = ts + end + 6;
                continue;
            }
        }
        pos = abs + 4;
    }
    out.trim().to_string()
}

fn extract_docx_table_rows(xml: &str) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut from = 0;
    while let Some(tr) = next_tag(xml, from, "<w:tr") {
        let end = match xml[tr..].find("</w:tr>") { Some(e) => tr + e, None => break };
        let tr_frag = &xml[tr..end + 7];
        let mut cells = Vec::new();
        let mut cf = 0;
        while let Some(tc) = next_tag(tr_frag, cf, "<w:tc") {
            let tc_end = match tr_frag[tc..].find("</w:tc>") { Some(e) => tc + e, None => break };
            cells.push(wt_text(&tr_frag[tc..tc_end + 7]));
            cf = tc_end + 7;
        }
        if cells.iter().any(|c| !c.is_empty()) { rows.push(cells); }
        from = end + 7;
    }
    rows
}

fn extract_docx_para_rows(xml: &str) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut from = 0;
    while let Some(p) = next_tag(xml, from, "<w:p") {
        let end = match xml[p..].find("</w:p>") { Some(e) => p + e, None => break };
        let text = wt_text(&xml[p..end + 6]);
        if !text.is_empty() {
            let cells: Vec<String> = if text.contains('\t') {
                text.split('\t').map(|s| s.trim().to_string()).collect()
            } else if text.matches(',').count() >= 2 {
                text.split(',').map(|s| s.trim().to_string()).collect()
            } else {
                vec![text]
            };
            if cells.iter().any(|c| !c.is_empty()) { rows.push(cells); }
        }
        from = end + 6;
    }
    rows
}
