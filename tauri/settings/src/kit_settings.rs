//! Kit-reserved settings keys. Apps flatten this into their own settings struct.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KitSettings {
    #[serde(rename = "__kit_theme", default = "default_theme")]
    pub theme: String,

    #[serde(rename = "__kit_auto_update", default = "default_auto_update")]
    pub auto_update: String,

    // Active palette id, written by the frontend palette picker.
    // None = user never picked one (app falls back to its own default).
    // Absent from serialized JSON when None so the file stays clean.
    #[serde(rename = "__kit_palette", default, skip_serializing_if = "Option::is_none")]
    pub palette: Option<String>,
}

fn default_theme() -> String { "system".into() }
fn default_auto_update() -> String { "onStartup".into() }

impl Default for KitSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            auto_update: default_auto_update(),
            palette: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize, Default, Debug, PartialEq)]
    struct AppSettings {
        work_minutes: u32,
        #[serde(flatten)]
        kit: KitSettings,
    }

    #[test]
    fn defaults_are_system_and_on_startup() {
        let k = KitSettings::default();
        assert_eq!(k.theme, "system");
        assert_eq!(k.auto_update, "onStartup");
        assert_eq!(k.palette, None);
    }

    #[test]
    fn flatten_round_trips_with_app_struct() {
        let s = AppSettings {
            work_minutes: 25,
            kit: KitSettings {
                theme: "dark".into(),
                auto_update: "immediate".into(),
                palette: Some("void".into()),
            },
        };
        let json = serde_json::to_string(&s).unwrap();
        // Should contain underscored keys at top level (proves flatten works)
        assert!(json.contains("\"__kit_theme\":\"dark\""));
        assert!(json.contains("\"__kit_auto_update\":\"immediate\""));
        assert!(json.contains("\"__kit_palette\":\"void\""));
        assert!(json.contains("\"work_minutes\":25"));

        let parsed: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, s);
    }

    #[test]
    fn unknown_kit_keys_in_app_json_use_defaults() {
        let json = r#"{"work_minutes":25}"#;
        let parsed: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.kit.theme, "system");
        assert_eq!(parsed.kit.auto_update, "onStartup");
        assert_eq!(parsed.kit.palette, None);
    }

    #[test]
    fn palette_none_is_omitted_from_serialized_json() {
        let s = AppSettings {
            work_minutes: 5,
            kit: KitSettings::default(),
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(!json.contains("__kit_palette"), "palette=None must not appear in JSON");
    }

    #[test]
    fn palette_round_trips_when_set() {
        let json = r#"{"work_minutes":5,"__kit_theme":"system","__kit_auto_update":"onStartup","__kit_palette":"glacier"}"#;
        let parsed: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.kit.palette, Some("glacier".into()));
    }
}
