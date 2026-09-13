const SERVICE: &str = "com.flowbox.app";
const ITEM_NOT_FOUND: i32 = -25300;

fn account_for(key: &str) -> Result<&'static str, String> {
    match key {
        "ai.openai_api_key" => Ok("ai.openai_api_key"),
        "asr.volc_app_id" => Ok("asr.volc_app_id"),
        "asr.volc_access_token" => Ok("asr.volc_access_token"),
        _ => Err("unsupported secret key".into()),
    }
}

#[cfg(target_os = "macos")]
pub fn get(key: &str) -> Result<Option<String>, String> {
    use security_framework::passwords::get_generic_password;

    let account = account_for(key)?;
    match get_generic_password(SERVICE, account) {
        Ok(value) => String::from_utf8(value)
            .map(Some)
            .map_err(|_| "secure storage contained invalid data".into()),
        Err(error) if error.code() == ITEM_NOT_FOUND => Ok(None),
        Err(_) => Err("secure storage unavailable".into()),
    }
}

#[cfg(target_os = "macos")]
pub fn set(key: &str, value: &str) -> Result<(), String> {
    use security_framework::passwords::set_generic_password;

    set_generic_password(SERVICE, account_for(key)?, value.as_bytes())
        .map_err(|_| "secure storage unavailable".into())
}

#[cfg(not(target_os = "macos"))]
pub fn get(key: &str) -> Result<Option<String>, String> {
    account_for(key)?;
    Err("secure storage unavailable".into())
}

#[cfg(not(target_os = "macos"))]
pub fn set(key: &str, _value: &str) -> Result<(), String> {
    account_for(key)?;
    Err("secure storage unavailable".into())
}

#[cfg(test)]
mod tests {
    use super::account_for;

    #[test]
    fn only_allows_fixed_accounts() {
        assert_eq!(account_for("ai.openai_api_key"), Ok("ai.openai_api_key"));
        assert!(account_for("arbitrary.key").is_err());
    }
}
