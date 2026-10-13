mod api;
mod models;
mod state;
mod ui;

use api::*;
use models::*;
use state::{AppState, View};
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;
use web_sys::{HtmlInputElement, HtmlTextAreaElement};

type AppRef = Rc<RefCell<AppState>>;

#[wasm_bindgen]
pub fn start_app() -> Result<(), JsValue> {
    let window = web_sys::window().expect("global window");

    let state = Rc::new(RefCell::new(AppState::default()));

    // Load saved preferences from localStorage
    if let Ok(Some(storage)) = window.local_storage() {
        if let Ok(Some(theme)) = storage.get_item("app-theme") {
            state.borrow_mut().theme = theme;
        }
        if let Ok(Some(accounts_str)) = storage.get_item("mastodon_accounts") {
            if let Ok(saved) = serde_json::from_str::<Vec<SavedAccount>>(&accounts_str) {
                state.borrow_mut().saved_accounts = saved;
            }
        }
        if let Ok(Some(ar)) = storage.get_item("auto-refresh") {
            state.borrow_mut().auto_refresh = ar != "false";
        }
    }

    apply_theme(&state.borrow().theme);

    // Initial render
    render_app(state.clone());

    // Listen for OAuth messages from popup window
    setup_oauth_listener(state.clone());

    // Check Auth Status on load
    {
        let state_clone = state.clone();
        spawn_local(async move {
            match check_auth_status().await {
                Ok((authed, inst)) => {
                    {
                        let mut s = state_clone.borrow_mut();
                        s.authenticated = Some(authed);
                        if let Some(i) = inst {
                            s.instance = i;
                        }
                    }

                    if authed {
                        // Fetch current user and home feed
                        if let Ok(user) = fetch_current_user().await {
                            state_clone.borrow_mut().current_user = Some(user.clone());
                            // Save to account history if not present
                            save_account_to_local(&state_clone, &user);
                        }
                        if let Ok(timeline) = fetch_timeline("timelines/home", None, None, false).await {
                            state_clone.borrow_mut().statuses = timeline;
                        }
                    }
                    render_app(state_clone);
                }
                Err(_) => {
                    state_clone.borrow_mut().authenticated = Some(false);
                    render_app(state_clone);
                }
            }
        });
    }

    // Auto-refresh interval (every 60s)
    {
        let state_clone = state.clone();
        let cb = Closure::wrap(Box::new(move || {
            let s = state_clone.borrow();
            if s.auto_refresh && s.authenticated == Some(true) {
                drop(s);
                refresh_current_view(state_clone.clone());
            }
        }) as Box<dyn FnMut()>);
        window.set_interval_with_callback_and_timeout_and_arguments_0(cb.as_ref().unchecked_ref(), 60000)?;
        cb.forget();
    }

    Ok(())
}

fn apply_theme(theme: &str) {
    if let Some(window) = web_sys::window() {
        if let Some(doc) = window.document() {
            if let Some(root) = doc.document_element() {
                let effective = if theme == "system" {
                    if let Ok(Some(mql)) = window.match_media("(prefers-color-scheme: dark)") {
                        if mql.matches() { "dark" } else { "light" }
                    } else {
                        "dark"
                    }
                } else {
                    theme
                };
                let _ = root.set_attribute("data-theme", effective);
            }
        }
    }
}

fn save_account_to_local(state: &AppRef, user: &Account) {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };
    let storage = match window.local_storage() {
        Ok(Some(s)) => s,
        _ => return,
    };

    let mut s = state.borrow_mut();
    let instance = s.instance.clone();
    if !s.saved_accounts.iter().any(|sa| sa.account.id == user.id && sa.instance == instance) {
        s.saved_accounts.push(SavedAccount {
            account: user.clone(),
            token: String::new(),
            instance,
        });
        if let Ok(json) = serde_json::to_string(&s.saved_accounts) {
            let _ = storage.set_item("mastodon_accounts", &json);
        }
    }
}

fn setup_oauth_listener(state: AppRef) {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };

    let cb = Closure::wrap(Box::new(move |evt: web_sys::MessageEvent| {
        let data = evt.data();
        if let Ok(msg_type) = js_sys::Reflect::get(&data, &JsValue::from_str("type")) {
            if msg_type.as_string().as_deref() == Some("OAUTH_AUTH_SUCCESS") {
                let inst = js_sys::Reflect::get(&data, &JsValue::from_str("instance"))
                    .ok()
                    .and_then(|v| v.as_string())
                    .unwrap_or_default();
                let token = js_sys::Reflect::get(&data, &JsValue::from_str("token"))
                    .ok()
                    .and_then(|v| v.as_string())
                    .unwrap_or_default();

                let state_clone = state.clone();
                spawn_local(async move {
                    if let Ok(user) = fetch_current_user().await {
                        {
                            let mut s = state_clone.borrow_mut();
                            s.authenticated = Some(true);
                            s.instance = inst.clone();
                            s.current_user = Some(user.clone());

                            if !s.saved_accounts.iter().any(|sa| sa.account.id == user.id && sa.instance == inst) {
                                s.saved_accounts.push(SavedAccount {
                                    account: user,
                                    token,
                                    instance: inst,
                                });
                                if let Some(w) = web_sys::window() {
                                    if let Ok(Some(storage)) = w.local_storage() {
                                        if let Ok(json) = serde_json::to_string(&s.saved_accounts) {
                                            let _ = storage.set_item("mastodon_accounts", &json);
                                        }
                                    }
                                }
                            }
                        }
                        if let Ok(timeline) = fetch_timeline("timelines/home", None, None, false).await {
                            state_clone.borrow_mut().statuses = timeline;
                        }
                        render_app(state_clone);
                    }
                });
            }
        }
    }) as Box<dyn FnMut(web_sys::MessageEvent)>);

    window.add_event_listener_with_callback("message", cb.as_ref().unchecked_ref()).unwrap();
    cb.forget();
}

fn refresh_current_view(state: AppRef) {
    let view = state.borrow().view.clone();
    state.borrow_mut().is_refreshing = true;
    render_app(state.clone());

    let state_clone = state.clone();
    spawn_local(async move {
        match view {
            View::Home => {
                if let Ok(tl) = fetch_timeline("timelines/home", None, None, false).await {
                    state_clone.borrow_mut().statuses = tl;
                }
            }
            View::Trending => {
                if let Ok(tr) = fetch_trending(0).await {
                    state_clone.borrow_mut().trending = tr;
                }
            }
            View::Local => {
                let lang = state_clone.borrow().selected_language.clone();
                if let Ok(loc) = fetch_timeline("timelines/public", None, lang.as_deref(), true).await {
                    state_clone.borrow_mut().local_statuses = loc;
                }
            }
            View::Federated => {
                let lang = state_clone.borrow().selected_language.clone();
                if let Ok(fed) = fetch_timeline("timelines/public", None, lang.as_deref(), false).await {
                    state_clone.borrow_mut().federated_statuses = fed;
                }
            }
            View::Bookmarks => {
                if let Ok(bm) = fetch_bookmarks().await {
                    state_clone.borrow_mut().bookmarks = bm;
                }
            }
            View::Notifications => {
                if let Ok(n) = fetch_notifications().await {
                    state_clone.borrow_mut().notifications = n;
                }
            }
            _ => {}
        }
        state_clone.borrow_mut().is_refreshing = false;
        render_app(state_clone);
    });
}

fn render_app(state: AppRef) {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };
    let document = match window.document() {
        Some(d) => d,
        None => return,
    };
    let root = match document.get_element_by_id("root") {
        Some(r) => r,
        None => return,
    };

    let s = state.borrow();

    // Check if not authenticated
    if s.authenticated == Some(false) {
        let html = format!(
            "{}{}",
            ui::render_icons(),
            ui::render_login_view(&s.instance)
        );
        root.set_inner_html(&html);
        attach_login_events(state.clone(), &document);
        return;
    }

    if s.authenticated.is_none() {
        root.set_inner_html(r#"<div class="app-loading"><div class="spinner"></div><p>Initializing WebAssembly Node...</p></div>"#);
        return;
    }

    // Main App Shell
    let icons = ui::render_icons();
    let sidebar = ui::render_sidebar(&s);
    let current_uid = s.current_user.as_ref().map(|u| u.id.as_str());

    let header_title = s.view.title();
    let main_content = match &s.view {
        View::Home => ui::render_feed(&s.statuses, current_uid, s.is_refreshing),
        View::Trending => ui::render_feed(&s.trending, current_uid, s.is_refreshing),
        View::Local => {
            let filter = ui::render_country_selector(s.selected_language.as_deref());
            let feed = ui::render_feed(&s.local_statuses, current_uid, s.is_refreshing);
            format!("{}{}", filter, feed)
        }
        View::Federated => {
            let filter = ui::render_country_selector(s.selected_language.as_deref());
            let feed = ui::render_feed(&s.federated_statuses, current_uid, s.is_refreshing);
            format!("{}{}", filter, feed)
        }
        View::Bookmarks => ui::render_feed(&s.bookmarks, current_uid, s.is_refreshing),
        View::Notifications => ui::render_notifications(&s.notifications),
        View::Search => ui::render_search(&s),
        View::Settings => ui::render_settings(&s),
        View::Profile => {
            let target_acc = s.target_account.as_ref().or(s.current_user.as_ref());
            if let Some(acc) = target_acc {
                ui::render_profile(acc, s.target_relationship.as_ref(), &s.profile_tab, &s.user_statuses, current_uid)
            } else {
                r#"<div class="empty-feed"><p>Profile not loaded.</p></div>"#.into()
            }
        }
        View::Details => {
            if let Some(st) = &s.selected_status {
                ui::render_details(st, &s.context, current_uid)
            } else {
                r#"<div class="empty-feed"><p>Conversation not loaded.</p></div>"#.into()
            }
        }
        View::EditProfile => {
            format!(
                r#"<div class="edit-profile-card">
                    <h3>Edit Identity</h3>
                    <div class="form-group">
                        <label>Display Name</label>
                        <input type="text" id="edit-display-name" value="{}" />
                    </div>
                    <div class="form-group">
                        <label>Bio / Note</label>
                        <textarea id="edit-note" rows="4">{}</textarea>
                    </div>
                    <button class="btn btn-primary" id="save-profile-btn">Save Changes</button>
                </div>"#,
                ui::escape_html(&s.edit_display_name),
                ui::escape_html(&s.edit_note)
            )
        }
    };

    let fab = if s.view != View::Settings && s.view != View::EditProfile {
        format!(
            r#"<button class="compose-fab" id="compose-fab" data-action="open-compose">{}</button>"#,
            ui::render_svg("message", 24, "")
        )
    } else {
        String::new()
    };

    let modal = ui::render_composer_modal(&s);

    let html = format!(
        r#"{icons}
        <div class="app-layout">
            <div class="noise"></div>
            {sidebar}
            <main class="main-content">
                <header class="top-header glass">
                    <h2 class="header-title">{header_title}</h2>
                    <button class="refresh-header-btn" data-action="refresh">
                        {refresh_icon}
                    </button>
                </header>
                <div class="feed-wrapper">
                    {main_content}
                </div>
            </main>
            {fab}
            {modal}
        </div>"#,
        icons = icons,
        sidebar = sidebar,
        header_title = header_title,
        refresh_icon = ui::render_svg("refresh", 18, if s.is_refreshing { "spin" } else { "" }),
        main_content = main_content,
        fab = fab,
        modal = modal
    );

    drop(s);
    root.set_inner_html(&html);
    attach_main_events(state, &document);
}

fn attach_login_events(state: AppRef, document: &web_sys::Document) {
    if let Some(form) = document.get_element_by_id("login-form") {
        let state_clone = state.clone();
        let cb = Closure::wrap(Box::new(move |evt: web_sys::Event| {
            evt.prevent_default();
            let window = match web_sys::window() {
                Some(w) => w,
                None => return,
            };
            let doc = match window.document() {
                Some(d) => d,
                None => return,
            };
            if let Some(input) = doc.get_element_by_id("instance-input") {
                if let Ok(input_elem) = input.dyn_into::<HtmlInputElement>() {
                    let instance = input_elem.value().trim().to_string();
                    if !instance.is_empty() {
                        state_clone.borrow_mut().instance = instance.clone();
                        spawn_local(async move {
                            match register_and_get_oauth_url(&instance).await {
                                Ok(url) => {
                                    if let Some(w) = web_sys::window() {
                                        let _ = w.open_with_url_and_target_and_features(&url, "mastodon_oauth", "width=600,height=700");
                                    }
                                }
                                Err(e) => {
                                    if let Some(w) = web_sys::window() {
                                        let _ = w.alert_with_message(&format!("Failed to connect to instance: {:?}", e));
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }) as Box<dyn FnMut(web_sys::Event)>);

        let _ = form.add_event_listener_with_callback("submit", cb.as_ref().unchecked_ref());
        cb.forget();
    }
}

fn attach_main_events(state: AppRef, document: &web_sys::Document) {
    let state_clone = state.clone();

    // Event delegation on root
    if let Some(root) = document.get_element_by_id("root") {
        let cb = Closure::wrap(Box::new(move |evt: web_sys::MouseEvent| {
            let target = match evt.target() {
                Some(t) => t,
                None => return,
            };
            let elem: Option<web_sys::Element> = target.dyn_into().ok();
            if let Some(el) = elem {
                // Find closest element with data-* attribute
                if let Ok(Some(action_el)) = el.closest("[data-action]") {
                    if let Some(action) = action_el.get_attribute("data-action") {
                        handle_action(state_clone.clone(), &action, &action_el);
                        return;
                    }
                }

                if let Ok(Some(nav_el)) = el.closest("[data-nav]") {
                    if let Some(nav_target) = nav_el.get_attribute("data-nav") {
                        handle_navigation(state_clone.clone(), &nav_target);
                        return;
                    }
                }

                if let Ok(Some(acc_el)) = el.closest("[data-account-id]") {
                    if let Some(acc_id) = acc_el.get_attribute("data-account-id") {
                        handle_view_account(state_clone.clone(), &acc_id);
                        return;
                    }
                }

                if let Ok(Some(tab_el)) = el.closest("[data-profile-tab]") {
                    if let Some(tab) = tab_el.get_attribute("data-profile-tab") {
                        handle_profile_tab(state_clone.clone(), &tab);
                        return;
                    }
                }

                if let Ok(Some(lang_el)) = el.closest("[data-lang]") {
                    let lang = lang_el.get_attribute("data-lang");
                    handle_lang_filter(state_clone.clone(), lang);
                    return;
                }

                if let Ok(Some(theme_el)) = el.closest("[data-theme]") {
                    if let Some(theme) = theme_el.get_attribute("data-theme") {
                        handle_theme_change(state_clone.clone(), &theme);
                        return;
                    }
                }
            }
        }) as Box<dyn FnMut(web_sys::MouseEvent)>);

        let _ = root.add_event_listener_with_callback("click", cb.as_ref().unchecked_ref());
        cb.forget();
    }

    // Attach search input listener if search input present
    if let Some(search_input) = document.get_element_by_id("search-input") {
        let state_clone = state.clone();
        let cb = Closure::wrap(Box::new(move |evt: web_sys::InputEvent| {
            if let Some(target) = evt.target() {
                if let Ok(input) = target.dyn_into::<HtmlInputElement>() {
                    let query = input.value();
                    state_clone.borrow_mut().search_query = query.clone();
                    if query.len() >= 2 {
                        let sc = state_clone.clone();
                        spawn_local(async move {
                            if let Ok(results) = search_mastodon(&query).await {
                                sc.borrow_mut().search_results = results;
                                render_app(sc);
                            }
                        });
                    }
                }
            }
        }) as Box<dyn FnMut(web_sys::InputEvent)>);
        let _ = search_input.add_event_listener_with_callback("input", cb.as_ref().unchecked_ref());
        cb.forget();
    }

    // Attach compose submit listener
    if let Some(submit_btn) = document.get_element_by_id("compose-submit-btn") {
        let state_clone = state.clone();
        let cb = Closure::wrap(Box::new(move |_evt: web_sys::MouseEvent| {
            let window = match web_sys::window() {
                Some(w) => w,
                None => return,
            };
            let doc = match window.document() {
                Some(d) => d,
                None => return,
            };
            if let Some(ta) = doc.get_element_by_id("compose-textarea") {
                if let Ok(ta_elem) = ta.dyn_into::<HtmlTextAreaElement>() {
                    let text = ta_elem.value().trim().to_string();
                    if !text.is_empty() {
                        let sc = state_clone.clone();
                        let reply_id = sc.borrow().reply_to_id.clone();
                        sc.borrow_mut().is_uploading = true;
                        render_app(sc.clone());

                        spawn_local(async move {
                            match post_status(&text, reply_id.as_deref(), &[]).await {
                                Ok(new_status) => {
                                    {
                                        let mut s = sc.borrow_mut();
                                        s.statuses.insert(0, new_status);
                                        s.compose_open = false;
                                        s.compose_text = String::new();
                                        s.reply_to_id = None;
                                        s.reply_to_username = None;
                                        s.is_uploading = false;
                                    }
                                    render_app(sc);
                                }
                                Err(e) => {
                                    sc.borrow_mut().is_uploading = false;
                                    if let Some(w) = web_sys::window() {
                                        let _ = w.alert_with_message(&format!("Failed to post toot: {:?}", e));
                                    }
                                    render_app(sc);
                                }
                            }
                        });
                    }
                }
            }
        }) as Box<dyn FnMut(web_sys::MouseEvent)>);
        let _ = submit_btn.add_event_listener_with_callback("click", cb.as_ref().unchecked_ref());
        cb.forget();
    }
}

fn handle_action(state: AppRef, action: &str, el: &web_sys::Element) {
    let id = el.get_attribute("data-id").unwrap_or_default();

    match action {
        "toggle-sidebar" => {
            let exp = state.borrow().sidebar_expanded;
            state.borrow_mut().sidebar_expanded = !exp;
            render_app(state);
        }
        "toggle-profile-menu" => {
            let menu = state.borrow().profile_menu_open;
            state.borrow_mut().profile_menu_open = !menu;
            render_app(state);
        }
        "refresh" => {
            refresh_current_view(state);
        }
        "open-compose" => {
            let mut s = state.borrow_mut();
            s.compose_open = true;
            s.reply_to_id = None;
            s.reply_to_username = None;
            s.compose_text = String::new();
            drop(s);
            render_app(state);
        }
        "close-compose" => {
            state.borrow_mut().compose_open = false;
            render_app(state);
        }
        "reply" => {
            if let Some(st) = find_status(&state, &id) {
                let eff = st.reblog.as_deref().unwrap_or(&st);
                let mut s = state.borrow_mut();
                s.compose_open = true;
                s.reply_to_id = Some(eff.id.clone());
                s.reply_to_username = Some(eff.account.username.clone());
                s.compose_text = format!("@{} ", eff.account.username);
                drop(s);
                render_app(state);
            }
        }
        "favourite" => {
            optimistic_interaction(state, &id, "favourite");
        }
        "reblog" => {
            optimistic_interaction(state, &id, "reblog");
        }
        "bookmark" => {
            optimistic_interaction(state, &id, "bookmark");
        }
        "delete" => {
            if let Some(w) = web_sys::window() {
                if w.confirm_with_message("Are you sure you want to delete this post?").unwrap_or(false) {
                    let sc = state.clone();
                    let st_id = id.clone();
                    spawn_local(async move {
                        if let Ok(()) = delete_status(&st_id).await {
                            remove_status_everywhere(&sc, &st_id);
                            render_app(sc);
                        }
                    });
                }
            }
        }
        "report" => {
            if let Some(w) = web_sys::window() {
                if let Ok(Some(reason)) = w.prompt_with_message("Please describe why you are reporting this post:") {
                    if !reason.trim().is_empty() {
                        let st_id = id.clone();
                        spawn_local(async move {
                            if let Ok(()) = report_status(&st_id, &reason).await {
                                if let Some(w) = web_sys::window() {
                                    let _ = w.alert_with_message("Report submitted. Thank you for keeping the community safe.");
                                }
                            }
                        });
                    }
                }
            }
        }
        "view-thread" => {
            let sc = state.clone();
            let st_id = id.clone();
            spawn_local(async move {
                if let Ok((status, ctx)) = fetch_status_detail(&st_id).await {
                    let mut s = sc.borrow_mut();
                    let cur_view = s.view.clone();
                    s.history.push(cur_view);
                    s.view = View::Details;
                    s.selected_status = Some(status);
                    s.context = ctx;
                    drop(s);
                    render_app(sc);
                }
            });
        }
        "go-back" => {
            let mut s = state.borrow_mut();
            if let Some(last) = s.history.pop() {
                s.view = last;
            } else {
                s.view = View::Home;
            }
            drop(s);
            render_app(state);
        }
        "toggle-follow" => {
            let is_following = el.get_attribute("data-following").map_or(false, |f| f == "true");
            let sc = state.clone();
            let acc_id = id.clone();
            spawn_local(async move {
                if let Ok(()) = follow_account(&acc_id, !is_following).await {
                    if let Some(rel) = &mut sc.borrow_mut().target_relationship {
                        rel.following = !is_following;
                    }
                    render_app(sc);
                }
            });
        }
        "edit-profile-btn" => {
            let mut s = state.borrow_mut();
            if let Some(u) = s.current_user.clone() {
                s.edit_display_name = u.display_name;
                s.edit_note = u.note;
                s.view = View::EditProfile;
            }
            drop(s);
            render_app(state);
        }
        "switch-account" => {
            let instance = el.get_attribute("data-instance").unwrap_or_default();
            if let Some(sa) = state.borrow().saved_accounts.iter().find(|a| a.account.id == id && a.instance == instance).cloned() {
                state.borrow_mut().profile_menu_open = false;
                spawn_local(async move {
                    if let Ok(()) = switch_session(&sa.token, &sa.instance).await {
                        if let Some(w) = web_sys::window() {
                            let _ = w.location().reload();
                        }
                    }
                });
            }
        }
        "add-account" => {
            state.borrow_mut().profile_menu_open = false;
            state.borrow_mut().authenticated = Some(false);
            render_app(state);
        }
        "open-settings" => {
            state.borrow_mut().profile_menu_open = false;
            state.borrow_mut().view = View::Settings;
            render_app(state);
        }
        "logout" => {
            spawn_local(async move {
                let _ = logout().await;
                if let Some(w) = web_sys::window() {
                    let _ = w.location().reload();
                }
            });
        }
        _ => {}
    }
}

fn handle_navigation(state: AppRef, nav: &str) {
    let new_view = match nav {
        "home" => View::Home,
        "trending" => View::Trending,
        "local" => View::Local,
        "federated" => View::Federated,
        "bookmarks" => View::Bookmarks,
        "notifications" => View::Notifications,
        "search" => View::Search,
        "settings" => View::Settings,
        "profile" => View::Profile,
        _ => View::Home,
    };

    let sc = state.clone();
    {
        let mut s = sc.borrow_mut();
        s.history.clear();
        s.view = new_view.clone();
        if new_view == View::Profile {
            s.target_account = None;
        }
    }
    render_app(sc.clone());

    // Fetch view specific data
    spawn_local(async move {
        match new_view {
            View::Home => {
                if let Ok(tl) = fetch_timeline("timelines/home", None, None, false).await {
                    sc.borrow_mut().statuses = tl;
                }
            }
            View::Trending => {
                if let Ok(tr) = fetch_trending(0).await {
                    sc.borrow_mut().trending = tr;
                }
            }
            View::Local => {
                let lang = sc.borrow().selected_language.clone();
                if let Ok(loc) = fetch_timeline("timelines/public", None, lang.as_deref(), true).await {
                    sc.borrow_mut().local_statuses = loc;
                }
            }
            View::Federated => {
                let lang = sc.borrow().selected_language.clone();
                if let Ok(fed) = fetch_timeline("timelines/public", None, lang.as_deref(), false).await {
                    sc.borrow_mut().federated_statuses = fed;
                }
            }
            View::Bookmarks => {
                if let Ok(bm) = fetch_bookmarks().await {
                    sc.borrow_mut().bookmarks = bm;
                }
            }
            View::Notifications => {
                if let Ok(n) = fetch_notifications().await {
                    sc.borrow_mut().notifications = n;
                }
            }
            View::Profile => {
                let uid = sc.borrow().current_user.as_ref().map(|u| u.id.clone());
                if let Some(id) = uid {
                    if let Ok(statuses) = fetch_user_statuses(&id, "posts").await {
                        sc.borrow_mut().user_statuses = statuses;
                    }
                }
            }
            _ => {}
        }
        render_app(sc);
    });
}

fn handle_view_account(state: AppRef, account_id: &str) {
    let sc = state.clone();
    let acc_id = account_id.to_string();
    spawn_local(async move {
        if let Ok((account, rel)) = fetch_account_profile(&acc_id).await {
            let statuses = fetch_user_statuses(&acc_id, "posts").await.unwrap_or_default();
            let mut s = sc.borrow_mut();
            let cur_view = s.view.clone();
            s.history.push(cur_view);
            s.view = View::Profile;
            s.target_account = Some(account);
            s.target_relationship = rel;
            s.user_statuses = statuses;
            drop(s);
            render_app(sc);
        }
    });
}

fn handle_profile_tab(state: AppRef, tab: &str) {
    state.borrow_mut().profile_tab = tab.to_string();
    let account_id = {
        let s = state.borrow();
        s.target_account.as_ref().or(s.current_user.as_ref()).map(|a| a.id.clone())
    };

    if let Some(id) = account_id {
        let sc = state.clone();
        let t = tab.to_string();
        spawn_local(async move {
            if let Ok(statuses) = fetch_user_statuses(&id, &t).await {
                sc.borrow_mut().user_statuses = statuses;
                render_app(sc);
            }
        });
    } else {
        render_app(state);
    }
}

fn handle_lang_filter(state: AppRef, lang: Option<String>) {
    state.borrow_mut().selected_language = lang.clone();
    let is_local = state.borrow().view == View::Local;
    let sc = state.clone();
    spawn_local(async move {
        let l = lang.as_deref().filter(|s| !s.is_empty());
        if let Ok(tl) = fetch_timeline("timelines/public", None, l, is_local).await {
            if is_local {
                sc.borrow_mut().local_statuses = tl;
            } else {
                sc.borrow_mut().federated_statuses = tl;
            }
            render_app(sc);
        }
    });
}

fn handle_theme_change(state: AppRef, theme: &str) {
    state.borrow_mut().theme = theme.to_string();
    apply_theme(theme);
    if let Some(w) = web_sys::window() {
        if let Ok(Some(storage)) = w.local_storage() {
            let _ = storage.set_item("app-theme", theme);
        }
    }
    render_app(state);
}

fn find_status(state: &AppRef, id: &str) -> Option<Status> {
    let s = state.borrow();
    s.statuses.iter()
        .chain(s.trending.iter())
        .chain(s.local_statuses.iter())
        .chain(s.federated_statuses.iter())
        .chain(s.bookmarks.iter())
        .chain(s.user_statuses.iter())
        .chain(s.selected_status.iter())
        .find(|st| st.id == id)
        .cloned()
}

fn optimistic_interaction(state: AppRef, id: &str, action: &str) {
    let original = match find_status(&state, id) {
        Some(s) => s,
        None => return,
    };

    let mut updated = original.clone();
    let endpoint = match action {
        "favourite" => {
            let eff: &mut Status = if let Some(rb) = updated.reblog.as_deref_mut() {
                rb
            } else {
                &mut updated
            };
            eff.favourited = !eff.favourited;
            if eff.favourited {
                eff.favourites_count += 1;
                "favourite"
            } else {
                eff.favourites_count = eff.favourites_count.saturating_sub(1);
                "unfavourite"
            }
        }
        "reblog" => {
            let eff: &mut Status = if let Some(rb) = updated.reblog.as_deref_mut() {
                rb
            } else {
                &mut updated
            };
            eff.reblogged = !eff.reblogged;
            if eff.reblogged {
                eff.reblogs_count += 1;
                "reblog"
            } else {
                eff.reblogs_count = eff.reblogs_count.saturating_sub(1);
                "unreblog"
            }
        }
        "bookmark" => {
            updated.bookmarked = !updated.bookmarked;
            if updated.bookmarked { "bookmark" } else { "unbookmark" }
        }
        _ => return,
    };

    replace_status_everywhere(&state, &updated);
    render_app(state.clone());

    let sc = state.clone();
    let st_id = id.to_string();
    let ep = endpoint.to_string();
    spawn_local(async move {
        match interact_status(&st_id, &ep).await {
            Ok(server_status) => {
                replace_status_everywhere(&sc, &server_status);
                render_app(sc);
            }
            Err(_) => {
                // Rollback on failure
                replace_status_everywhere(&sc, &original);
                render_app(sc);
            }
        }
    });
}

fn replace_status_everywhere(state: &AppRef, status: &Status) {
    let mut s = state.borrow_mut();
    let id = &status.id;
    let update = |list: &mut Vec<Status>| {
        for item in list.iter_mut() {
            if item.id == *id {
                *item = status.clone();
            }
        }
    };
    update(&mut s.statuses);
    update(&mut s.trending);
    update(&mut s.local_statuses);
    update(&mut s.federated_statuses);
    update(&mut s.bookmarks);
    update(&mut s.user_statuses);
    if let Some(sel) = &mut s.selected_status {
        if sel.id == *id {
            *sel = status.clone();
        }
    }
}

fn remove_status_everywhere(state: &AppRef, id: &str) {
    let mut s = state.borrow_mut();
    s.statuses.retain(|st| st.id != id);
    s.trending.retain(|st| st.id != id);
    s.local_statuses.retain(|st| st.id != id);
    s.federated_statuses.retain(|st| st.id != id);
    s.bookmarks.retain(|st| st.id != id);
    s.user_statuses.retain(|st| st.id != id);
    if let Some(sel) = &s.selected_status {
        if sel.id == id {
            s.selected_status = None;
            s.view = View::Home;
        }
    }
}
