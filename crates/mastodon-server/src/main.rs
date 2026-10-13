use axum::{
    body::Bytes,
    extract::{Multipart, Path, Query, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{any, get, patch, post},
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use rand::{distributions::Alphanumeric, Rng};
use reqwest::multipart::Part;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, RwLock},
};
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};

#[derive(Clone)]
struct AppState {
    http_client: reqwest::Client,
    app_registry: Arc<RwLock<HashMap<String, AppCredentials>>>,
    oauth_states: Arc<RwLock<HashMap<String, String>>>,
    app_url: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct AppCredentials {
    client_id: String,
    client_secret: String,
}

#[derive(Deserialize)]
struct RegisterRequest {
    instance: String,
}

#[derive(Deserialize)]
struct AuthUrlQuery {
    instance: String,
    client_id: String,
}

#[derive(Deserialize)]
struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
}

#[derive(Deserialize)]
struct SessionRequest {
    token: String,
    instance: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "mastodon_server=info,tower_http=info".into()),
        )
        .init();

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);

    let app_url = std::env::var("APP_URL").unwrap_or_else(|_| format!("http://localhost:{}", port));

    let state = AppState {
        http_client: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap(),
        app_registry: Arc::new(RwLock::new(HashMap::new())),
        oauth_states: Arc::new(RwLock::new(HashMap::new())),
        app_url,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let static_dir = if std::path::Path::new("static").exists() {
        "static"
    } else if std::path::Path::new("dist").exists() {
        "dist"
    } else {
        "public"
    };

    let app = Router::new()
        .route("/api/auth/register", post(register_app))
        .route("/api/auth/url", get(get_auth_url))
        .route("/auth/callback", get(handle_callback))
        .route("/auth/callback/", get(handle_callback))
        .route("/api/auth/session", post(set_session))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/logout_full", post(logout))
        .route("/api/auth/status", get(get_auth_status))
        .route("/api/mastodon/v1/media", post(proxy_media_upload))
        .route(
            "/api/mastodon/v1/accounts/update_credentials",
            patch(proxy_update_credentials),
        )
        .route("/api/mastodon/{*path}", any(proxy_mastodon_api))
        .fallback_service(
            ServeDir::new(static_dir)
                .append_index_html_on_directories(true)
                .fallback(ServeDir::new(static_dir)),
        )
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Server running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn register_app(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let instance = payload.instance.trim().to_string();
    if instance.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Instance required" })),
        ));
    }

    {
        let registry = state.app_registry.read().unwrap();
        if let Some(creds) = registry.get(&instance) {
            return Ok(Json(serde_json::json!({ "client_id": creds.client_id })));
        }
    }

    let redirect_uri = format!("{}/auth/callback", state.app_url);
    let register_url = format!("https://{}/api/v1/apps", instance);

    let resp = state
        .http_client
        .post(&register_url)
        .json(&serde_json::json!({
            "client_name": "Beautiful Mastodon",
            "redirect_uris": redirect_uri,
            "scopes": "read write follow",
            "website": state.app_url
        }))
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        })?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": err_text })),
        ));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    let client_id = data["client_id"].as_str().unwrap_or("").to_string();
    let client_secret = data["client_secret"].as_str().unwrap_or("").to_string();

    {
        let mut registry = state.app_registry.write().unwrap();
        registry.insert(
            instance,
            AppCredentials {
                client_id: client_id.clone(),
                client_secret,
            },
        );
    }

    Ok(Json(serde_json::json!({ "client_id": client_id })))
}

async fn get_auth_url(
    State(state): State<AppState>,
    Query(query): Query<AuthUrlQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if query.instance.is_empty() || query.client_id.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Missing params" })),
        ));
    }

    let state_token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();

    {
        let mut states = state.oauth_states.write().unwrap();
        states.insert(state_token.clone(), query.instance.clone());
    }

    let redirect_uri = format!("{}/auth/callback", state.app_url);
    let params = vec![
        ("client_id", query.client_id.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("response_type", "code"),
        ("scope", "read write follow"),
        ("state", state_token.as_str()),
    ];

    let query_string = serde_urlencoded::to_string(&params).unwrap_or_default();
    let auth_url = format!("https://{}/oauth/authorize?{}", query.instance, query_string);

    Ok(Json(serde_json::json!({ "url": auth_url })))
}

async fn handle_callback(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(query): Query<CallbackQuery>,
) -> impl IntoResponse {
    let (code, state_token) = match (query.code, query.state) {
        (Some(c), Some(s)) => (c, s),
        _ => return (StatusCode::BAD_REQUEST, Html("Invalid state or code".to_string())).into_response(),
    };

    let instance = {
        let mut states = state.oauth_states.write().unwrap();
        match states.remove(&state_token) {
            Some(inst) => inst,
            None => {
                return (
                    StatusCode::BAD_REQUEST,
                    Html("State token not found or expired".to_string()),
                )
                    .into_response()
            }
        }
    };

    let creds = {
        let registry = state.app_registry.read().unwrap();
        match registry.get(&instance) {
            Some(c) => c.clone(),
            None => {
                return (
                    StatusCode::BAD_REQUEST,
                    Html("Instance app registration not found".to_string()),
                )
                    .into_response()
            }
        }
    };

    let redirect_uri = format!("{}/auth/callback", state.app_url);
    let token_url = format!("https://{}/oauth/token", instance);

    let token_resp = state
        .http_client
        .post(&token_url)
        .json(&serde_json::json!({
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code": code
        }))
        .send()
        .await;

    let token_data: serde_json::Value = match token_resp {
        Ok(r) if r.status().is_success() => match r.json().await {
            Ok(v) => v,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Html("Invalid token response")).into_response(),
        },
        _ => return (StatusCode::BAD_GATEWAY, Html("Failed to exchange code for token")).into_response(),
    };

    let access_token = match token_data["access_token"].as_str() {
        Some(t) => t.to_string(),
        None => return (StatusCode::BAD_GATEWAY, Html("Missing access_token in response")).into_response(),
    };

    let max_age = time::Duration::days(30);

    let cookie_token = Cookie::build(("m_token", access_token.clone()))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::None)
        .max_age(max_age)
        .build();

    let cookie_instance = Cookie::build(("m_instance", instance.clone()))
        .path("/")
        .http_only(false)
        .secure(true)
        .same_site(SameSite::None)
        .max_age(max_age)
        .build();

    let jar = jar.add(cookie_token).add(cookie_instance);

    let html = format!(
        r#"<!doctype html>
<html>
  <head><title>Authenticated</title></head>
  <body style="background:#020617;color:#e2e8f0;font-family:sans-serif;padding:2rem;text-align:center;">
    <script>
      if (window.opener) {{
        window.opener.postMessage({{
          type: 'OAUTH_AUTH_SUCCESS',
          instance: '{instance}',
          token: '{access_token}'
        }}, '*');
        window.close();
      }} else {{
        window.location.href = '/';
      }}
    </script>
    <p>Authentication successful. You can close this window.</p>
  </body>
</html>"#
    );

    (jar, Html(html)).into_response()
}

async fn set_session(
    jar: CookieJar,
    Json(payload): Json<SessionRequest>,
) -> impl IntoResponse {
    let max_age = time::Duration::days(30);

    let cookie_token = Cookie::build(("m_token", payload.token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::None)
        .max_age(max_age)
        .build();

    let cookie_instance = Cookie::build(("m_instance", payload.instance))
        .path("/")
        .http_only(false)
        .secure(true)
        .same_site(SameSite::None)
        .max_age(max_age)
        .build();

    let jar = jar.add(cookie_token).add(cookie_instance);
    (jar, Json(serde_json::json!({ "success": true })))
}

async fn logout(jar: CookieJar) -> impl IntoResponse {
    let cookie_token = Cookie::build(("m_token", ""))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::None)
        .max_age(time::Duration::ZERO)
        .build();

    let cookie_instance = Cookie::build(("m_instance", ""))
        .path("/")
        .http_only(false)
        .secure(true)
        .same_site(SameSite::None)
        .max_age(time::Duration::ZERO)
        .build();

    let jar = jar.add(cookie_token).add(cookie_instance);
    (jar, Json(serde_json::json!({ "success": true })))
}

async fn get_auth_status(jar: CookieJar) -> impl IntoResponse {
    let token = jar.get("m_token").map(|c| c.value().to_string());
    let instance = jar.get("m_instance").map(|c| c.value().to_string());

    let authenticated = token.is_some() && !token.as_ref().unwrap().is_empty();
    Json(serde_json::json!({
        "authenticated": authenticated,
        "instance": instance
    }))
}

async fn proxy_media_upload(
    State(state): State<AppState>,
    jar: CookieJar,
    mut multipart: Multipart,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let token = match jar.get("m_token") {
        Some(c) if !c.value().is_empty() => c.value().to_string(),
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthenticated" })),
            ))
        }
    };
    let instance = match jar.get("m_instance") {
        Some(c) if !c.value().is_empty() => c.value().to_string(),
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthenticated" })),
            ))
        }
    };

    let mut form = reqwest::multipart::Form::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            let file_name = field.file_name().unwrap_or("upload.jpg").to_string();
            let content_type = field
                .content_type()
                .unwrap_or("application/octet-stream")
                .to_string();
            let data = field.bytes().await.map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": e.to_string() })),
                )
            })?;
            let part = Part::bytes(data.to_vec())
                .file_name(file_name)
                .mime_str(&content_type)
                .map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({ "error": e.to_string() })),
                    )
                })?;
            form = form.part("file", part);
        } else if name == "description" {
            let text = field.text().await.unwrap_or_default();
            form = form.text("description", text);
        }
    }

    let url = format!("https://{}/api/v1/media", instance);
    let resp = state
        .http_client
        .post(&url)
        .bearer_auth(token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        })?;

    let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let bytes = resp.bytes().await.unwrap_or_default();

    let mut response = Response::new(axum::body::Body::from(bytes));
    *response.status_mut() = status;
    response
        .headers_mut()
        .insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
    Ok(response)
}

async fn proxy_update_credentials(
    State(state): State<AppState>,
    jar: CookieJar,
    mut multipart: Multipart,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let token = match jar.get("m_token") {
        Some(c) if !c.value().is_empty() => c.value().to_string(),
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthenticated" })),
            ))
        }
    };
    let instance = match jar.get("m_instance") {
        Some(c) if !c.value().is_empty() => c.value().to_string(),
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthenticated" })),
            ))
        }
    };

    let mut form = reqwest::multipart::Form::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "avatar" || name == "header" {
            let file_name = field.file_name().unwrap_or("image.jpg").to_string();
            let content_type = field
                .content_type()
                .unwrap_or("image/jpeg")
                .to_string();
            let data = field.bytes().await.map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": e.to_string() })),
                )
            })?;
            let part = Part::bytes(data.to_vec())
                .file_name(file_name)
                .mime_str(&content_type)
                .map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({ "error": e.to_string() })),
                    )
                })?;
            form = form.part(name, part);
        } else {
            let text = field.text().await.unwrap_or_default();
            form = form.text(name, text);
        }
    }

    let url = format!("https://{}/api/v1/accounts/update_credentials", instance);
    let resp = state
        .http_client
        .patch(&url)
        .bearer_auth(token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        })?;

    let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let bytes = resp.bytes().await.unwrap_or_default();

    let mut response = Response::new(axum::body::Body::from(bytes));
    *response.status_mut() = status;
    response
        .headers_mut()
        .insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
    Ok(response)
}

async fn proxy_mastodon_api(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(path): Path<String>,
    method: Method,
    headers: HeaderMap,
    Query(query_params): Query<HashMap<String, String>>,
    body: Bytes,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let token = match jar.get("m_token") {
        Some(c) if !c.value().is_empty() => c.value().to_string(),
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthenticated" })),
            ))
        }
    };
    let instance = match jar.get("m_instance") {
        Some(c) if !c.value().is_empty() => c.value().to_string(),
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthenticated" })),
            ))
        }
    };

    let target_url = format!("https://{}/api/{}", instance, path);

    let mut req = state
        .http_client
        .request(method.clone(), &target_url)
        .bearer_auth(token)
        .query(&query_params);

    if method != Method::GET && method != Method::HEAD {
        if let Some(content_type) = headers.get(header::CONTENT_TYPE) {
            if let Ok(ct_str) = content_type.to_str() {
                req = req.header(header::CONTENT_TYPE, ct_str);
            }
        } else {
            req = req.header(header::CONTENT_TYPE, "application/json");
        }
        req = req.body(body);
    }

    let resp = req.send().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let resp_headers = resp.headers().clone();
    let bytes = resp.bytes().await.unwrap_or_default();

    let mut response = Response::new(axum::body::Body::from(bytes));
    *response.status_mut() = status;

    if let Some(ct) = resp_headers.get(header::CONTENT_TYPE) {
        response.headers_mut().insert(header::CONTENT_TYPE, ct.clone());
    }

    Ok(response)
}
