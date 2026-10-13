use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Account {
    pub id: String,
    pub username: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub avatar: String,
    #[serde(default)]
    pub header: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub followers_count: u64,
    #[serde(default)]
    pub following_count: u64,
    #[serde(default)]
    pub statuses_count: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct MediaAttachment {
    pub id: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub preview_url: Option<String>,
    #[serde(default, rename = "type")]
    pub media_type: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Status {
    pub id: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub content: String,
    pub account: Account,
    #[serde(default)]
    pub reblog: Option<Box<Status>>,
    #[serde(default)]
    pub replies_count: u64,
    #[serde(default)]
    pub reblogs_count: u64,
    #[serde(default)]
    pub favourites_count: u64,
    #[serde(default)]
    pub media_attachments: Vec<MediaAttachment>,
    #[serde(default)]
    pub favourited: bool,
    #[serde(default)]
    pub reblogged: bool,
    #[serde(default)]
    pub bookmarked: bool,
    #[serde(default)]
    pub language: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Relationship {
    pub id: String,
    #[serde(default)]
    pub following: bool,
    #[serde(default)]
    pub followed_by: bool,
    #[serde(default)]
    pub blocking: bool,
    #[serde(default)]
    pub muting: bool,
    #[serde(default)]
    pub requested: bool,
    #[serde(default)]
    pub domain_blocking: bool,
    #[serde(default)]
    pub showing_reblogs: bool,
    #[serde(default)]
    pub endorsed: bool,
    #[serde(default)]
    pub notifying: bool,
    #[serde(default)]
    pub languages: Vec<String>,
    #[serde(default)]
    pub note: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Notification {
    pub id: String,
    #[serde(rename = "type")]
    pub notif_type: String,
    #[serde(default)]
    pub created_at: String,
    pub account: Account,
    #[serde(default)]
    pub status: Option<Status>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SavedAccount {
    pub account: Account,
    pub token: String,
    pub instance: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default, PartialEq)]
pub struct ContextData {
    #[serde(default)]
    pub ancestors: Vec<Status>,
    #[serde(default)]
    pub descendants: Vec<Status>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default, PartialEq)]
pub struct SearchResults {
    #[serde(default)]
    pub accounts: Vec<Account>,
    #[serde(default)]
    pub statuses: Vec<Status>,
    #[serde(default)]
    pub hashtags: Vec<Hashtag>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Hashtag {
    pub name: String,
    #[serde(default)]
    pub url: String,
}

pub struct CountryFilter {
    pub name: &'static str,
    pub code: Option<&'static str>,
    pub flag: &'static str,
}

pub const COUNTRIES: &[CountryFilter] = &[
    CountryFilter { name: "Global", code: None, flag: "🌐" },
    CountryFilter { name: "USA", code: Some("en"), flag: "🇺🇸" },
    CountryFilter { name: "UK", code: Some("en"), flag: "🇬🇧" },
    CountryFilter { name: "Japan", code: Some("ja"), flag: "🇯🇵" },
    CountryFilter { name: "France", code: Some("fr"), flag: "🇫🇷" },
    CountryFilter { name: "Germany", code: Some("de"), flag: "🇩🇪" },
    CountryFilter { name: "Spain", code: Some("es"), flag: "🇪🇸" },
    CountryFilter { name: "Brazil", code: Some("pt"), flag: "🇧🇷" },
    CountryFilter { name: "Italy", code: Some("it"), flag: "🇮🇹" },
    CountryFilter { name: "India", code: Some("hi"), flag: "🇮🇳" },
    CountryFilter { name: "Korea", code: Some("ko"), flag: "🇰🇷" },
    CountryFilter { name: "China", code: Some("zh"), flag: "🇨🇳" },
];
