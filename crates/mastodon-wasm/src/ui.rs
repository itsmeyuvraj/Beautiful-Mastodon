use crate::models::*;
use crate::state::{AppState, View};

pub fn render_icons() -> &'static str {
    r#"<svg style="display:none;">
      <defs>
        <g id="icon-home"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></g>
        <g id="icon-trending"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></g>
        <g id="icon-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></g>
        <g id="icon-globe"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></g>
        <g id="icon-bookmark"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></g>
        <g id="icon-bell"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></g>
        <g id="icon-search"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></g>
        <g id="icon-settings"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>
        <g id="icon-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></g>
        <g id="icon-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></g>
        <g id="icon-repeat"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></g>
        <g id="icon-message"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></g>
        <g id="icon-refresh"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></g>
        <g id="icon-arrow-left"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></g>
        <g id="icon-trash"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></g>
        <g id="icon-flag"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></g>
        <g id="icon-send"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></g>
        <g id="icon-logout"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></g>
        <g id="icon-plus"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></g>
        <g id="icon-menu"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></g>
        <g id="icon-x"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></g>
      </defs>
    </svg>"#
}

pub fn render_svg(id: &str, size: u32, extra_class: &str) -> String {
    format!(
        r##"<svg class="icon {}" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-{}"/></svg>"##,
        extra_class, size, size, id
    )
}

pub fn render_toot(status: &Status, current_user_id: Option<&str>, is_detail: bool) -> String {
    let effective = status.reblog.as_deref().unwrap_or(status);
    let is_reblog = status.reblog.is_some();
    let is_owner = current_user_id.map_or(false, |uid| uid == effective.account.id);

    let reblog_header = if is_reblog {
        format!(
            r#"<div class="toot-reblog-header">
                {} <span>Boosted by <strong>{}</strong></span>
            </div>"#,
            render_svg("repeat", 14, "text-muted"),
            escape_html(&status.account.display_name)
        )
    } else {
        String::new()
    };

    let media_html = if !effective.media_attachments.is_empty() {
        let mut items = String::new();
        for media in &effective.media_attachments {
            let img_src = media.preview_url.as_deref().unwrap_or(&media.url);
            items.push_str(&format!(
                r#"<a href="{}" target="_blank" rel="noopener noreferrer" class="media-thumb"><img src="{}" alt="{}" loading="lazy"/></a>"#,
                escape_html(&media.url),
                escape_html(img_src),
                escape_html(media.description.as_deref().unwrap_or("Attachment"))
            ));
        }
        format!(r#"<div class="media-grid media-grid-{}">{}</div>"#, effective.media_attachments.len().min(4), items)
    } else {
        String::new()
    };

    let fav_class = if effective.favourited { "action-btn active-like" } else { "action-btn" };
    let boost_class = if effective.reblogged { "action-btn active-boost" } else { "action-btn" };
    let bm_class = if status.bookmarked { "action-btn active-bookmark" } else { "action-btn" };

    let owner_delete_btn = if is_owner {
        format!(
            r#"<button class="action-btn delete-btn" data-action="delete" data-id="{}">{}</button>"#,
            status.id,
            render_svg("trash", 16, "text-muted hover:text-red-400")
        )
    } else {
        format!(
            r#"<button class="action-btn report-btn" data-action="report" data-id="{}">{}</button>"#,
            status.id,
            render_svg("flag", 16, "text-muted hover:text-amber-400")
        )
    };

    format!(
        r#"<article class="toot-card {}" data-status-id="{}">
            {}
            <div class="toot-header">
                <img src="{}" class="avatar account-link" data-account-id="{}" alt=""/>
                <div class="toot-author-meta">
                    <div class="author-name-row">
                        <span class="display-name account-link" data-account-id="{}">{}</span>
                        <span class="username">@{}</span>
                    </div>
                    <span class="toot-time">{}</span>
                </div>
            </div>
            <div class="toot-content markdown-content" data-action="view-thread" data-id="{}">
                {}
            </div>
            {}
            <div class="toot-actions">
                <button class="action-btn reply-btn" data-action="reply" data-id="{}">
                    {} <span>{}</span>
                </button>
                <button class="{}" data-action="reblog" data-id="{}">
                    {} <span>{}</span>
                </button>
                <button class="{}" data-action="favourite" data-id="{}">
                    {} <span>{}</span>
                </button>
                <button class="{}" data-action="bookmark" data-id="{}">
                    {}
                </button>
                {}
            </div>
        </article>"#,
        if is_detail { "toot-detail" } else { "" },
        status.id,
        reblog_header,
        escape_html(&effective.account.avatar),
        effective.account.id,
        effective.account.id,
        escape_html(if effective.account.display_name.is_empty() { &effective.account.username } else { &effective.account.display_name }),
        escape_html(&effective.account.username),
        format_time(&status.created_at),
        status.id,
        effective.content, // HTML generated safely by Mastodon API
        media_html,
        status.id,
        render_svg("message", 16, ""),
        effective.replies_count,
        boost_class,
        status.id,
        render_svg("repeat", 16, ""),
        effective.reblogs_count,
        fav_class,
        status.id,
        render_svg("heart", 16, ""),
        effective.favourites_count,
        bm_class,
        status.id,
        render_svg("bookmark", 16, ""),
        owner_delete_btn
    )
}

pub fn render_sidebar(state: &AppState) -> String {
    let current_id = state.current_user.as_ref().map(|u| u.id.as_str()).unwrap_or("");
    let is_exp = state.sidebar_expanded;
    let sidebar_w = if is_exp { "sidebar-expanded" } else { "sidebar-collapsed" };

    let nav_items = [
        (View::Home, "home", "Home"),
        (View::Trending, "trending", "Trending"),
        (View::Local, "users", "Local"),
        (View::Federated, "globe", "Federated"),
        (View::Bookmarks, "bookmark", "Bookmarks"),
        (View::Notifications, "bell", "Alerts"),
        (View::Search, "search", "Search"),
        (View::Settings, "settings", "Settings"),
        (View::Profile, "user", "Profile"),
    ];

    let mut nav_html = String::new();
    for (v, icon, label) in nav_items {
        let active = state.view == v;
        let act_class = if active { "nav-item active" } else { "nav-item" };
        let view_name = format!("{:?}", v).to_lowercase();
        nav_html.push_str(&format!(
            r#"<button class="{}" data-nav="{}">
                {} {}
            </button>"#,
            act_class,
            view_name,
            render_svg(icon, 22, ""),
            if is_exp { format!(r#"<span class="nav-label">{}</span>"#, label) } else { String::new() }
        ));
    }

    let user_avatar = state.current_user.as_ref().map(|u| u.avatar.as_str()).unwrap_or("");
    let user_name = state.current_user.as_ref().map(|u| if u.display_name.is_empty() { u.username.as_str() } else { u.display_name.as_str() }).unwrap_or("Connected Node");

    let accounts_popup = if state.profile_menu_open {
        let mut acc_list = String::new();
        for sa in &state.saved_accounts {
            let is_cur = sa.account.id == current_id;
            acc_list.push_str(&format!(
                r#"<button class="account-item-btn {}" data-action="switch-account" data-id="{}" data-instance="{}">
                    <img src="{}" class="avatar-small" alt=""/>
                    <div class="account-item-info">
                        <p class="account-item-name">{}</p>
                        <p class="account-item-inst">{}</p>
                    </div>
                    {}
                </button>"#,
                if is_cur { "active-acc" } else { "" },
                sa.account.id,
                escape_html(&sa.instance),
                escape_html(&sa.account.avatar),
                escape_html(&sa.account.display_name),
                escape_html(&sa.instance),
                if is_cur { r#"<span class="status-indicator"></span>"# } else { "" }
            ));
        }

        format!(
            r#"<div class="profile-menu-modal">
                <div class="profile-menu-header">My Accounts</div>
                <div class="profile-menu-list">{}</div>
                <div class="profile-menu-actions">
                    <button class="menu-action-btn" data-action="add-account">{} <span>Add another account</span></button>
                    <button class="menu-action-btn" data-action="open-settings">{} <span>System Configuration</span></button>
                    <button class="menu-action-btn logout-action" data-action="logout">{} <span>Decommission connection</span></button>
                </div>
            </div>"#,
            acc_list,
            render_svg("plus", 16, ""),
            render_svg("settings", 16, ""),
            render_svg("logout", 16, "")
        )
    } else {
        String::new()
    };

    format!(
        r#"<nav class="sidebar {}">
            <div class="sidebar-top">
                <div class="sidebar-brand">
                    <div class="brand-logo">M</div>
                    {}
                </div>
                <button class="sidebar-toggle" data-action="toggle-sidebar">
                    {}
                </button>
            </div>
            <div class="sidebar-nav">
                {}
            </div>
            <div class="sidebar-footer">
                {}
                <div class="profile-pill" data-action="toggle-profile-menu">
                    <img src="{}" class="avatar-small" alt=""/>
                    {}
                </div>
            </div>
        </nav>"#,
        sidebar_w,
        if is_exp { r#"<span class="brand-title">Beautiful</span>"# } else { "" },
        render_svg("menu", 18, ""),
        nav_html,
        accounts_popup,
        escape_html(user_avatar),
        if is_exp {
            format!(
                r#"<div class="profile-meta"><p class="profile-name">{}</p><p class="profile-sub">Account Options</p></div><span class="chevron">{}</span>"#,
                escape_html(user_name),
                render_svg("settings", 14, "text-muted")
            )
        } else {
            String::new()
        }
    )
}

pub fn render_country_selector(selected: Option<&str>) -> String {
    let mut options = String::new();
    for c in COUNTRIES {
        let is_sel = c.code == selected;
        options.push_str(&format!(
            r#"<button class="flag-chip {}" data-lang="{}"><span>{}</span> <span>{}</span></button>"#,
            if is_sel { "flag-active" } else { "" },
            c.code.unwrap_or(""),
            c.flag,
            c.name
        ));
    }
    format!(r#"<div class="flag-bar">{}</div>"#, options)
}

pub fn render_feed(statuses: &[Status], current_user_id: Option<&str>, is_refreshing: bool) -> String {
    if statuses.is_empty() {
        return format!(
            r#"<div class="empty-feed">
                <p>No posts available at this moment.</p>
                {}
            </div>"#,
            if is_refreshing { r#"<div class="spinner"></div>"# } else { "" }
        );
    }

    let mut html = String::new();
    for s in statuses {
        html.push_str(&render_toot(s, current_user_id, false));
    }
    format!(r#"<div class="feed-container">{}</div>"#, html)
}

pub fn render_notifications(notifications: &[Notification]) -> String {
    if notifications.is_empty() {
        return r#"<div class="empty-feed"><p>No alerts or notifications.</p></div>"#.into();
    }

    let mut html = String::new();
    for n in notifications {
        let (icon, label, color) = match n.notif_type.as_str() {
            "favourite" => ("heart", "favourited your post", "color-pink"),
            "reblog" => ("repeat", "boosted your post", "color-green"),
            "follow" => ("user", "followed you", "color-brand"),
            "mention" => ("message", "mentioned you", "color-blue"),
            _ => ("bell", "interacted with you", "color-muted"),
        };

        let status_preview = if let Some(s) = &n.status {
            format!(r#"<div class="notif-status-preview">{}</div>"#, s.content)
        } else {
            String::new()
        };

        html.push_str(&format!(
            r#"<div class="notif-card">
                <div class="notif-icon {}">{}</div>
                <div class="notif-body">
                    <div class="notif-header">
                        <img src="{}" class="avatar-small account-link" data-account-id="{}" alt=""/>
                        <div class="notif-text">
                            <strong>{}</strong> <span>{}</span>
                        </div>
                    </div>
                    {}
                </div>
            </div>"#,
            color,
            render_svg(icon, 18, ""),
            escape_html(&n.account.avatar),
            n.account.id,
            escape_html(if n.account.display_name.is_empty() { &n.account.username } else { &n.account.display_name }),
            label,
            status_preview
        ));
    }
    format!(r#"<div class="notifs-container">{}</div>"#, html)
}

pub fn render_profile(account: &Account, relationship: Option<&Relationship>, tab: &str, statuses: &[Status], current_user_id: Option<&str>) -> String {
    let is_self = current_user_id.map_or(false, |uid| uid == account.id);
    let is_following = relationship.map_or(false, |r| r.following);

    let follow_btn = if is_self {
        r#"<button class="btn btn-secondary" data-action="edit-profile-btn">Edit Identity</button>"#.to_string()
    } else {
        format!(
            r#"<button class="btn {}" data-action="toggle-follow" data-id="{}" data-following="{}">{}</button>"#,
            if is_following { "btn-secondary" } else { "btn-primary" },
            account.id,
            is_following,
            if is_following { "Following" } else { "Follow" }
        )
    };

    let header_bg = if !account.header.is_empty() {
        format!(r#"style="background-image: url('{}');""#, escape_html(&account.header))
    } else {
        String::new()
    };

    let tabs = [("posts", "Posts"), ("replies", "Replies"), ("media", "Media")];
    let mut tabs_html = String::new();
    for (t, label) in tabs {
        let active = tab == t;
        tabs_html.push_str(&format!(
            r#"<button class="profile-tab-btn {}" data-profile-tab="{}">{}</button>"#,
            if active { "active" } else { "" },
            t,
            label
        ));
    }

    let feed_html = render_feed(statuses, current_user_id, false);

    format!(
        r#"<div class="profile-container">
            <div class="profile-banner" {}></div>
            <div class="profile-content">
                <div class="profile-top-row">
                    <img src="{}" class="profile-avatar" alt=""/>
                    {}
                </div>
                <h2 class="profile-display-name">{}</h2>
                <p class="profile-handle">@{}</p>
                <div class="profile-note markdown-content">{}</div>
                <div class="profile-stats">
                    <div class="stat-item"><strong>{}</strong> <span>Following</span></div>
                    <div class="stat-item"><strong>{}</strong> <span>Followers</span></div>
                    <div class="stat-item"><strong>{}</strong> <span>Posts</span></div>
                </div>
            </div>
            <div class="profile-tabs">{}</div>
            <div class="profile-feed">{}</div>
        </div>"#,
        header_bg,
        escape_html(&account.avatar),
        follow_btn,
        escape_html(if account.display_name.is_empty() { &account.username } else { &account.display_name }),
        escape_html(&account.username),
        account.note,
        account.following_count,
        account.followers_count,
        account.statuses_count,
        tabs_html,
        feed_html
    )
}

pub fn render_search(state: &AppState) -> String {
    let mut accounts_html = String::new();
    for acc in &state.search_results.accounts {
        let is_following = state.search_relationships.get(&acc.id).map_or(false, |r| r.following);
        accounts_html.push_str(&format!(
            r#"<div class="search-account-card">
                <img src="{}" class="avatar account-link" data-account-id="{}" alt=""/>
                <div class="search-account-meta">
                    <p class="search-account-name account-link" data-account-id="{}">{}</p>
                    <p class="search-account-handle">@{}</p>
                </div>
                <button class="btn btn-sm {}" data-action="toggle-follow" data-id="{}" data-following="{}">
                    {}
                </button>
            </div>"#,
            escape_html(&acc.avatar),
            acc.id,
            acc.id,
            escape_html(if acc.display_name.is_empty() { &acc.username } else { &acc.display_name }),
            escape_html(&acc.username),
            if is_following { "btn-secondary" } else { "btn-primary" },
            acc.id,
            is_following,
            if is_following { "Following" } else { "Follow" }
        ));
    }

    let statuses_html = render_feed(&state.search_results.statuses, state.current_user.as_ref().map(|u| u.id.as_str()), false);

    format!(
        r#"<div class="search-page">
            <div class="search-bar-wrap">
                {}
                <input type="text" id="search-input" class="search-input" placeholder="Search people, posts, hashtags..." value="{}"/>
            </div>
            <div class="search-results-section">
                {}
                {}
            </div>
        </div>"#,
        render_svg("search", 20, "search-icon"),
        escape_html(&state.search_query),
        if !accounts_html.is_empty() { format!(r#"<div class="search-group"><h3 class="group-title">Accounts</h3><div class="accounts-grid">{}</div></div>"#, accounts_html) } else { String::new() },
        if !state.search_results.statuses.is_empty() { format!(r#"<div class="search-group"><h3 class="group-title">Posts</h3>{}</div>"#, statuses_html) } else { String::new() }
    )
}

pub fn render_settings(state: &AppState) -> String {
    format!(
        r#"<div class="settings-page">
            <div class="settings-card">
                <h3 class="card-title">Theme & Appearance</h3>
                <div class="theme-picker">
                    <button class="theme-btn {}" data-theme="dark">Dark Theme</button>
                    <button class="theme-btn {}" data-theme="light">Light Theme</button>
                    <button class="theme-btn {}" data-theme="system">System Default</button>
                </div>
            </div>
            <div class="settings-card">
                <h3 class="card-title">Timeline Automation</h3>
                <label class="toggle-row">
                    <span>Auto-refresh timelines every 60 seconds</span>
                    <input type="checkbox" id="auto-refresh-toggle" {}/>
                </label>
            </div>
            <div class="settings-card">
                <h3 class="card-title">WebAssembly Runtime & Core</h3>
                <div class="tech-stack-info">
                    <div class="tech-badge"><span>Architecture:</span> <strong>WebAssembly (wasm32-unknown-unknown)</strong></div>
                    <div class="tech-badge"><span>Source:</span> <strong>Pure Rust Engine</strong></div>
                    <div class="tech-badge"><span>Instance:</span> <strong>{}</strong></div>
                    <div class="tech-badge"><span>Status:</span> <strong class="color-green">Active • Optimistic Sync</strong></div>
                </div>
            </div>
            <div class="settings-card danger-card">
                <h3 class="card-title">Session Management</h3>
                <p class="danger-desc">Disconnect this browser session from the current Mastodon instance.</p>
                <button class="btn btn-danger" data-action="logout">Decommission Connection</button>
            </div>
        </div>"#,
        if state.theme == "dark" { "theme-active" } else { "" },
        if state.theme == "light" { "theme-active" } else { "" },
        if state.theme == "system" { "theme-active" } else { "" },
        if state.auto_refresh { "checked" } else { "" },
        escape_html(&state.instance)
    )
}

pub fn render_details(status: &Status, context: &ContextData, current_user_id: Option<&str>) -> String {
    let mut ancestors_html = String::new();
    for a in &context.ancestors {
        ancestors_html.push_str(&render_toot(a, current_user_id, false));
    }

    let main_toot = render_toot(status, current_user_id, true);

    let mut descendants_html = String::new();
    for d in &context.descendants {
        descendants_html.push_str(&render_toot(d, current_user_id, false));
    }

    format!(
        r#"<div class="thread-container">
            <button class="back-btn" data-action="go-back">{} <span>Back</span></button>
            <div class="thread-ancestors">{}</div>
            <div class="thread-focus">{}</div>
            <div class="thread-descendants">{}</div>
        </div>"#,
        render_svg("arrow-left", 18, ""),
        ancestors_html,
        main_toot,
        descendants_html
    )
}

pub fn render_composer_modal(state: &AppState) -> String {
    if !state.compose_open {
        return String::new();
    }

    let reply_banner = if let Some(un) = &state.reply_to_username {
        format!(r#"<div class="reply-banner">Replying to <strong>@{}</strong></div>"#, escape_html(un))
    } else {
        String::new()
    };

    format!(
        r#"<div class="modal-backdrop" data-action="close-compose">
            <div class="modal-card" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Create New Toot</h3>
                    <button class="modal-close-btn" data-action="close-compose">{}</button>
                </div>
                {}
                <div class="modal-body">
                    <textarea id="compose-textarea" placeholder="What's happening on the Fediverse?" rows="5">{}</textarea>
                </div>
                <div class="modal-footer">
                    <span class="char-count">500</span>
                    <button class="btn btn-primary" id="compose-submit-btn" {}>
                        {} <span>Publish Toot</span>
                    </button>
                </div>
            </div>
        </div>"#,
        render_svg("x", 20, ""),
        reply_banner,
        escape_html(&state.compose_text),
        if state.is_uploading { "disabled" } else { "" },
        if state.is_uploading { render_svg("refresh", 16, "spin") } else { render_svg("send", 16, "") }
    )
}

pub fn render_login_view(instance_val: &str) -> String {
    format!(
        r#"<div class="login-page">
            <div class="login-card">
                <div class="login-brand">
                    <h1 class="login-title">Beautiful</h1>
                    <p class="login-sub">Minimal Federated Client • WebAssembly Core</p>
                </div>
                <form id="login-form" class="login-form">
                    <div class="input-group">
                        <input type="text" id="instance-input" placeholder="mastodon.social" value="{}" required />
                        <p class="input-hint">Enter your instance URL or domain to begin</p>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">
                        Initialize Node {}
                    </button>
                </form>
                <div class="login-footer-icons">
                    <span>#</span>
                    <span>@</span>
                    <span>&bull;</span>
                </div>
            </div>
        </div>"#,
        escape_html(instance_val),
        render_svg("send", 18, "")
    )
}

pub fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

pub fn format_time(date_str: &str) -> String {
    // Basic date formatter for ISO strings
    if date_str.len() >= 10 {
        date_str[0..10].to_string()
    } else {
        date_str.to_string()
    }
}
