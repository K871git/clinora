use crate::error::AppResult;
use sha2::{Digest, Sha256};
use std::fs;
use tauri::State;
use crate::state::AppState;
use serde_json::{json, Value};

// SHA-256 hashes of the 50 valid license keys.
// Plaintext keys are in CLINORA-LICENSE-KEYS.txt (keep that file private).
const VALID_HASHES: &[&str] = &[
    "2db1b8070997ec821a1e9cccc2329a4eced5a671918b875148828ac6981f9154",
    "b20ddf13fd90b6ede478a31b50bc752148616f8d35a5037f2ea9792263b2cc0c",
    "dca6b7221c89136ede6f03cb8aed7f82cf5f4e0d6297b42959611918d3b8fabc",
    "06f0120bffef8fb3af099739334b49c289228c19edb7310f6a1447309a0a9596",
    "54d40dc5fb4c1646722ac54f981517f1e6ef45fb7afc78c5ad47d7b84c3849e0",
    "15f4fe7ef2459ce3fa8a984bc574116e30439644520190eec6ad545e92e75c20",
    "8d050eeb3619891713884d5b9d6d233d0b8e4a63931a948e1a1169d61cbfddfe",
    "ac31b563e388dd0c46985f85c0f36cacf54d71ee6705c45e1d2e2f7384aaed42",
    "1a54043f150142283d58e3cf7b96d883d98d103eeec17de4975da74b10736492",
    "ff24073ff1001e6b67b398877ef711467b975f5407bb9266a3b611e200597450",
    "bae9a8dd904d5fff861c85e181aaccea9e945c5157c97aaed141768a6c68a74f",
    "f1496e5e0432254e45eec48d773dbbb5aa15922583d3ef43ad8970c04a28dcb2",
    "2554487fbdf1ddb05bafa4d46f477227adf4d6cea928d89d5cf7bbe17444f690",
    "c39ab82db28d5520b9abcf0bbba90acc0f3171bd2884bf2ab0d914ab9cbbe030",
    "16b84d796a8b47e889fd27fbfad194a115ba2f8ff11141dca2f8f52917ee6562",
    "ab3217fc0ef414f411cae18c212470cf76f33f89b53b59132a8b96b1eb263b78",
    "a23e0828bdeec126959f9a2a0626d60b1411a16d6715836b3ae3e69b305c846d",
    "d13bd3710160a20679e56a3139a9b7cafc71bcaf3065af78ba20938ecc4e92bf",
    "fa6e38c04a9ec4fee3a3b1f82666f82b62fff95ec15dcad0de70d5a71662fd28",
    "adad91c7e86f2cd47052d287af29f0fd5f1f392089d9bef6be7d41e484bcf2ae",
    "9d166d30d19e91db7e283489a92f53ac98dcd28d8c135a921bda804813160cb6",
    "80272309d1273f4ff771a4e94b8ee08887f0e66efdbb101d8f65588f07d2d76d",
    "94b02b23898460ef747cfc028e2af2d81045a62dfcc0ddcf4eb2a4e1e0de6b2d",
    "4dd03dff197a74659321d78de006a2e90cae4907e34ba1348a487a60cb8e9540",
    "574c36c2c9d7e815743e4ce5e60d777f50f2203f040cbac847afc24da441af4a",
    "40248e82449b0d5e100a9bfdded33b655a96e36e5c1c2d08b328bee93e66d853",
    "9811fa9e4f27e79e5d6d5b19a7f42062f1fb4d3f820cc85d5b92b7e8ace7d025",
    "d03fdccb66b589d576a54111dc851a3e635da612266fbc775e006a8745f78c07",
    "cfb10eaf2976d7379a8dbbe1d51f16d53376a2ae658ede9d2ff68c846b82b2e4",
    "23e89de425d2d7c5bc379f45141b8daf015be7008814bc46b7575bffb3761a39",
    "ac5ca5a547176f26e1c55e0383ed442637f8f8792e4dafe2d1cf5a303ef7c3bd",
    "31f4c49a980d0d4a221692535b11358a96eeeffeeb88c212573aa3568a7111cb",
    "a3359645c3fc082d160a4864deb4a6a3d0a4ccf2d59c719415dee72ed01c1454",
    "5847994e39fcdb533e1787ee477330d0ba6aba5d8d826d72f7cb4dda12e6ee1b",
    "b2f4923093da6fe2144dab9346ca03c945a9416d7e4c919554ce4dab6545d678",
    "5efb53ae0bb42affe110846270907bab2f82acca76fe5d9fd4ecd814e3053e8c",
    "eac9f989106b057dce11b4786e886978ef8b83b684d4676138c7bf6d706fdb26",
    "c6b609bf9c85d510f4b3daf88e90bde348b2b383af5411fbb5997fbb0d4936bb",
    "02e2c395447e4f663828b69084b0deb02948c96a2223d5cf9f19b9e4dba7fba9",
    "5c6ae3f0d389fe72b14e37a42cbf098fb29dd9a3ed4f4e3d8a3ea749e35f16e0",
    "47ff53c3b61bf9fbe9f2f24f8d118a85aa8c9e70d9022d584090d96990a19d3c",
    "45661c6149e4fc908e0149cd83f5e61c04a97930d9c4e5965bf815f12642e633",
    "8b81112d0b2256afe4e371e23f6f30d689b2202d2aac24dc600cad19256a43b1",
    "65662d6bed0b78d40f3c970718e9a9fcda1393c94c1ffcaa16fcaac3abf2e2ca",
    "5f90e7bea8f02e112d4cc1cc85f903f4143be8e0dc6af722c715ffdbf68fb2aa",
    "a27a54ac4592452577e80a5d8d45072588aabe07a7b7378f0c62b255910bb547",
    "dcd998e61aae89f5b7b284f2e95b5e245a55e67f9b33099b26ede42166c34b7c",
    "a83ced2d12a9e0312cf41e9f281d5a717b4b6e6caa5779bde628e491173b2d52",
    "c2c122830a7b0567fdcfc675901440aad57f118222824d690bf1164dc85ebea4",
    "1355e13ed7aac4d45a628c6490230dde7ac916a8065ca4424678b06121549b43",
];

fn license_file_path() -> Option<std::path::PathBuf> {
    std::env::current_exe().ok()?.parent().map(|d| d.join("data").join("license.key"))
}

fn hash_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.trim().as_bytes());
    format!("{:x}", hasher.finalize())
}

fn is_valid_hash(hash: &str) -> bool {
    VALID_HASHES.contains(&hash)
}

#[tauri::command]
pub async fn get_license_status(_state: State<'_, AppState>) -> AppResult<Value> {
    let path = match license_file_path() {
        Some(p) => p,
        None => return Ok(json!({ "licensed": false })),
    };

    if let Ok(stored) = fs::read_to_string(&path) {
        let stored = stored.trim();
        if is_valid_hash(stored) {
            return Ok(json!({ "licensed": true }));
        }
    }

    Ok(json!({ "licensed": false }))
}

#[tauri::command]
pub async fn activate_license(key: String, _state: State<'_, AppState>) -> AppResult<Value> {
    let key = key.trim().to_uppercase();
    if key.is_empty() {
        return Err("Please enter a license key.".into());
    }

    let hash = hash_key(&key);
    if !is_valid_hash(&hash) {
        return Err("Invalid license key. Please check your key and try again.".into());
    }

    // Persist the hash (not the plaintext key) to disk
    let path = match license_file_path() {
        Some(p) => p,
        None => return Err("Cannot determine installation directory.".into()),
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| "Cannot create data directory.")?;
    }

    fs::write(&path, &hash).map_err(|_| "Cannot save license. Check folder permissions.")?;

    Ok(json!({ "licensed": true, "message": "Clinora activated successfully!" }))
}
