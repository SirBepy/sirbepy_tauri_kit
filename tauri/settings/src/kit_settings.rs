//! Kit-reserved settings keys. Apps flatten this into their own settings struct.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KitSettings {
    #[serde(rename = "__kit_theme", default = "default_theme")]
    pub theme: String,

    #[serde(rename = "__kit_auto_update", default = "default_auto_update")]
    pub auto_update: String,
}

fn default_theme() -> String { "system".into() }
fn default_auto_update() -> String { "onStartup".into() }

impl Default for KitSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            auto_update: default_auto_update(),
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
    }

    #[test]
    fn flatten_round_trips_with_app_struct() {
        let s = AppSettings {
            work_minutes: 25,
            kit: KitSettings {
                theme: "dark".into(),
                auto_update: "immediate".into(),
            },
        };
        let json = serde_json::to_string(&s).unwrap();
        // Should contain underscored keys at top level (proves flatten works)
        assert!(json.contains("\"__kit_theme\":\"dark\""));
        assert!(json.contains("\"__kit_auto_update\":\"immediate\""));
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
    }
}
