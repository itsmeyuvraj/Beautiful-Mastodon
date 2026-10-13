use crate::models::*;
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq)]
pub enum View {
    Home,
    Trending,
    Local,
    Federated,
    Bookmarks,
    Notifications,
    Search,
    Profile,
    Details,
    Settings,
    EditProfile,
}

impl View {
    pub fn title(&self) -> &'static str {
        match self {
            View::Home => "Home",
            View::Trending => "Trending",
            View::Local => "Local Timeline",
            View::Federated => "Federated Timeline",
            View::Bookmarks => "Bookmarks",
            View::Notifications => "Alerts",
            View::Search => "Search",
            View::Profile => "Profile",
            View::Details => "Conversation",
            View::Settings => "Instance Settings",
            View::EditProfile => "Identity",
        }
    }
}

pub struct AppState {
    pub authenticated: Option<bool>,
    pub current_user: Option<Account>,
    pub instance: String,
    pub view: View,
    pub history: Vec<View>,

    pub statuses: Vec<Status>,
    pub trending: Vec<Status>,
    pub local_statuses: Vec<Status>,
    pub federated_statuses: Vec<Status>,
    pub bookmarks: Vec<Status>,
    pub notifications: Vec<Notification>,
    pub user_statuses: Vec<Status>,
    pub profile_tab: String,

    pub target_account: Option<Account>,
    pub target_relationship: Option<Relationship>,
    pub selected_status: Option<Status>,
    pub context: ContextData,

    pub saved_accounts: Vec<SavedAccount>,
    pub search_query: String,
    pub search_results: SearchResults,
    pub search_relationships: HashMap<String, Relationship>,

    pub compose_open: bool,
    pub compose_text: String,
    pub reply_to_id: Option<String>,
    pub reply_to_username: Option<String>,
    pub is_uploading: bool,
    pub is_refreshing: bool,

    pub sidebar_expanded: bool,
    pub profile_menu_open: bool,
    pub theme: String,
    pub auto_refresh: bool,
    pub selected_language: Option<String>,

    pub edit_display_name: String,
    pub edit_note: String,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            authenticated: None,
            current_user: None,
            instance: String::new(),
            view: View::Home,
            history: Vec::new(),

            statuses: Vec::new(),
            trending: Vec::new(),
            local_statuses: Vec::new(),
            federated_statuses: Vec::new(),
            bookmarks: Vec::new(),
            notifications: Vec::new(),
            user_statuses: Vec::new(),
            profile_tab: "posts".into(),

            target_account: None,
            target_relationship: None,
            selected_status: None,
            context: ContextData::default(),

            saved_accounts: Vec::new(),
            search_query: String::new(),
            search_results: SearchResults::default(),
            search_relationships: HashMap::new(),

            compose_open: false,
            compose_text: String::new(),
            reply_to_id: None,
            reply_to_username: None,
            is_uploading: false,
            is_refreshing: false,

            sidebar_expanded: true,
            profile_menu_open: false,
            theme: "system".into(),
            auto_refresh: true,
            selected_language: None,

            edit_display_name: String::new(),
            edit_note: String::new(),
        }
    }
}
