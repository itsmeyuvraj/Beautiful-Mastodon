use crate::models::*;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use web_sys::{Request, RequestInit, RequestMode, Response};

async fn fetch_json(url: &str, method: &str, body: Option<&str>) -> Result<JsValue, JsValue> {
    let window = web_sys::window().ok_or_else(|| JsValue::from_str("no window"))?;
    let opts = RequestInit::new();
    opts.set_method(method);
    opts.set_mode(RequestMode::Cors);

    if let Some(b) = body {
        opts.set_body(&JsValue::from_str(b));
    }

    let request = Request::new_with_str_and_init(url, &opts)?;
    if body.is_some() {
        request.headers().set("Content-Type", "application/json")?;
    }

    let resp_value = JsFuture::from(window.fetch_with_request(&request)).await?;
    let resp: Response = resp_value.dyn_into()?;

    if !resp.ok() {
        return Err(JsValue::from_str(&format!("HTTP Error: {}", resp.status())));
    }

    let json_promise = resp.json()?;
    JsFuture::from(json_promise).await
}

pub async fn check_auth_status() -> Result<(bool, Option<String>), JsValue> {
    let val = fetch_json("/api/auth/status", "GET", None).await?;
    #[derive(serde::Deserialize)]
    struct AuthStatus {
        authenticated: bool,
        instance: Option<String>,
    }
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    let status: AuthStatus = serde_json::from_str(&json_str)
        .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
    Ok((status.authenticated, status.instance))
}

pub async fn fetch_current_user() -> Result<Account, JsValue> {
    let val = fetch_json("/api/mastodon/v1/accounts/verify_credentials", "GET", None).await?;
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))
}

pub async fn fetch_timeline(endpoint: &str, max_id: Option<&str>, lang: Option<&str>, local: bool) -> Result<Vec<Status>, JsValue> {
    let mut url = format!("/api/mastodon/v1/{}?limit=20", endpoint);
    if let Some(id) = max_id {
        url.push_str(&format!("&max_id={}", id));
    }
    if let Some(l) = lang {
        url.push_str(&format!("&lang={}", l));
    }
    if local {
        url.push_str("&local=1");
    }

    let val = fetch_json(&url, "GET", None).await?;
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))
}

pub async fn fetch_trending(offset: usize) -> Result<Vec<Status>, JsValue> {
    let url = format!("/api/mastodon/v1/trends/statuses?offset={}&limit=20&_={}", offset, js_sys::Date::now());
    let val = fetch_json(&url, "GET", None).await?;
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))
}

pub async fn fetch_bookmarks() -> Result<Vec<Status>, JsValue> {
    let val = fetch_json("/api/mastodon/v1/bookmarks", "GET", None).await?;
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))
}

pub async fn fetch_notifications() -> Result<Vec<Notification>, JsValue> {
    let val = fetch_json("/api/mastodon/v1/notifications", "GET", None).await?;
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))
}

pub async fn fetch_status_detail(id: &str) -> Result<(Status, ContextData), JsValue> {
    let s_val = fetch_json(&format!("/api/mastodon/v1/statuses/{}", id), "GET", None).await?;
    let s_str = js_sys::JSON::stringify(&s_val)?.as_string().unwrap_or_default();
    let status: Status = serde_json::from_str(&s_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

    let c_val = fetch_json(&format!("/api/mastodon/v1/statuses/{}/context", id), "GET", None).await.unwrap_or(JsValue::NULL);
    let context: ContextData = if !c_val.is_null() && !c_val.is_undefined() {
        let c_str = js_sys::JSON::stringify(&c_val)?.as_string().unwrap_or_default();
        serde_json::from_str(&c_str).unwrap_or_default()
    } else {
        ContextData::default()
    };

    Ok((status, context))
}

pub async fn fetch_account_profile(account_id: &str) -> Result<(Account, Option<Relationship>), JsValue> {
    let a_val = fetch_json(&format!("/api/mastodon/v1/accounts/{}", account_id), "GET", None).await?;
    let a_str = js_sys::JSON::stringify(&a_val)?.as_string().unwrap_or_default();
    let account: Account = serde_json::from_str(&a_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

    let r_val = fetch_json(&format!("/api/mastodon/v1/accounts/relationships?id[]={}", account_id), "GET", None).await.unwrap_or(JsValue::NULL);
    let rel: Option<Relationship> = if !r_val.is_null() {
        let r_str = js_sys::JSON::stringify(&r_val)?.as_string().unwrap_or_default();
        let rels: Vec<Relationship> = serde_json::from_str(&r_str).unwrap_or_default();
        rels.into_iter().next()
    } else {
        None
    };

    Ok((account, rel))
}

pub async fn fetch_user_statuses(account_id: &str, tab: &str) -> Result<Vec<Status>, JsValue> {
    let mut url = format!("/api/mastodon/v1/accounts/{}/statuses?limit=40", account_id);
    if tab == "posts" {
        url.push_str("&exclude_replies=true");
    } else if tab == "media" {
        url.push_str("&only_media=true");
    }

    let val = fetch_json(&url, "GET", None).await?;
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))
}

pub async fn interact_status(id: &str, action: &str) -> Result<Status, JsValue> {
    let url = format!("/api/mastodon/v1/statuses/{}/{}", id, action);
    let val = fetch_json(&url, "POST", None).await?;
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))
}

pub async fn post_status(status_text: &str, in_reply_to_id: Option<&str>, media_ids: &[String]) -> Result<Status, JsValue> {
    let mut map = serde_json::Map::new();
    map.insert("status".into(), serde_json::Value::String(status_text.into()));
    if let Some(reply_id) = in_reply_to_id {
        map.insert("in_reply_to_id".into(), serde_json::Value::String(reply_id.into()));
    }
    if !media_ids.is_empty() {
        map.insert(
            "media_ids".into(),
            serde_json::Value::Array(media_ids.iter().map(|s| serde_json::Value::String(s.clone())).collect()),
        );
    }

    let body = serde_json::to_string(&map).unwrap_or_default();
    let val = fetch_json("/api/mastodon/v1/statuses", "POST", Some(&body)).await?;
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))
}

pub async fn follow_account(id: &str, follow: bool) -> Result<(), JsValue> {
    let action = if follow { "follow" } else { "unfollow" };
    let url = format!("/api/mastodon/v1/accounts/{}/{}", id, action);
    fetch_json(&url, "POST", None).await?;
    Ok(())
}

pub async fn delete_status(id: &str) -> Result<(), JsValue> {
    let url = format!("/api/mastodon/v1/statuses/{}", id);
    fetch_json(&url, "DELETE", None).await?;
    Ok(())
}

pub async fn report_status(id: &str, reason: &str) -> Result<(), JsValue> {
    let body = serde_json::json!({
        "status_ids": [id],
        "comment": reason
    }).to_string();
    fetch_json("/api/mastodon/v1/reports", "POST", Some(&body)).await?;
    Ok(())
}

pub async fn search_mastodon(query: &str) -> Result<SearchResults, JsValue> {
    let url = format!("/api/mastodon/v2/search?q={}", js_sys::encode_uri_component(query).as_string().unwrap_or_default());
    let val = fetch_json(&url, "GET", None).await?;
    let json_str = js_sys::JSON::stringify(&val)?.as_string().unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))
}

pub async fn register_and_get_oauth_url(instance: &str) -> Result<String, JsValue> {
    let clean_instance = instance
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split('/')
        .next()
        .unwrap_or(instance);

    let reg_body = serde_json::json!({ "instance": clean_instance }).to_string();
    let reg_val = fetch_json("/api/auth/register", "POST", Some(&reg_body)).await?;
    let reg_str = js_sys::JSON::stringify(&reg_val)?.as_string().unwrap_or_default();
    let reg_data: serde_json::Value = serde_json::from_str(&reg_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
    let client_id = reg_data["client_id"].as_str().unwrap_or("");

    let url_endpoint = format!("/api/auth/url?instance={}&client_id={}", clean_instance, client_id);
    let url_val = fetch_json(&url_endpoint, "GET", None).await?;
    let url_str = js_sys::JSON::stringify(&url_val)?.as_string().unwrap_or_default();
    let url_data: serde_json::Value = serde_json::from_str(&url_str).map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

    let auth_url = url_data["url"].as_str().unwrap_or("").to_string();
    Ok(auth_url)
}

pub async fn switch_session(token: &str, instance: &str) -> Result<(), JsValue> {
    let body = serde_json::json!({ "token": token, "instance": instance }).to_string();
    fetch_json("/api/auth/session", "POST", Some(&body)).await?;
    Ok(())
}

pub async fn logout() -> Result<(), JsValue> {
    fetch_json("/api/auth/logout", "POST", None).await?;
    Ok(())
}
