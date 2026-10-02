// Expose the resolved harfrust/allsorts versions to the crate so the UI can
// show which engine versions it is running.
fn main() {
    let lock = std::fs::read_to_string("Cargo.lock").unwrap_or_default();
    for name in ["harfrust", "allsorts"] {
        let needle = format!("name = \"{name}\"\nversion = \"");
        let version = lock
            .find(&needle)
            .map(|i| &lock[i + needle.len()..])
            .and_then(|rest| rest.split('"').next())
            .unwrap_or("unknown");
        println!("cargo:rustc-env={}_VERSION={version}", name.to_uppercase());
    }
    println!("cargo:rerun-if-changed=Cargo.lock");
}
