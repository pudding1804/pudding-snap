use chrono::{NaiveDateTime, NaiveDate, NaiveTime, TimeZone, Local};

pub fn parse_filename_timestamp(filename: &str) -> Option<i64> {
    let patterns = [
        r"^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})",
        r"^(\d{4})-(\d{2})-(\d{2})[ _](\d{2})-(\d{2})-(\d{2})",
        r"^(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})",
        r"^(\d{4})\.(\d{2})\.(\d{2})[ _](\d{2})\.(\d{2})\.(\d{2})",
        r"^Screenshot[_\s](\d{4})-(\d{2})-(\d{2})[ _](\d{2})-(\d{2})-(\d{2})",
        r"^Screenshot[_\s](\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})",
    ];
    
    for pattern in &patterns {
        if let Some(timestamp) = try_parse_with_pattern(filename, pattern) {
            return Some(timestamp);
        }
    }
    
    None
}

fn try_parse_with_pattern(filename: &str, pattern: &str) -> Option<i64> {
    let re = regex::Regex::new(pattern).ok()?;
    let caps = re.captures(filename)?;
    
    let year: i32 = caps.get(1)?.as_str().parse().ok()?;
    let month: u32 = caps.get(2)?.as_str().parse().ok()?;
    let day: u32 = caps.get(3)?.as_str().parse().ok()?;
    let hour: u32 = caps.get(4)?.as_str().parse().ok()?;
    let minute: u32 = caps.get(5)?.as_str().parse().ok()?;
    let second: u32 = caps.get(6)?.as_str().parse().ok()?;
    
    if month < 1 || month > 12 || day < 1 || day > 31 
       || hour > 23 || minute > 59 || second > 59 {
        return None;
    }
    
    let naive_dt = NaiveDateTime::new(
        NaiveDate::from_ymd_opt(year, month, day)?,
        NaiveTime::from_hms_opt(hour, minute, second)?
    );
    
    let local_dt = Local.from_local_datetime(&naive_dt).single()?;
    
    Some(local_dt.timestamp())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_yyyymmddhhmmss() {
        assert!(parse_filename_timestamp("20240115143052.png").is_some());
        assert!(parse_filename_timestamp("20240115143052_screenshot.jpg").is_some());
    }
    
    #[test]
    fn test_parse_with_dashes() {
        assert!(parse_filename_timestamp("2024-01-15_14-30-52.png").is_some());
        assert!(parse_filename_timestamp("2024-01-15 14-30-52.png").is_some());
    }
    
    #[test]
    fn test_parse_with_underscores() {
        assert!(parse_filename_timestamp("2024_01_15_14_30_52.png").is_some());
    }
    
    #[test]
    fn test_parse_screenshot_prefix() {
        assert!(parse_filename_timestamp("Screenshot_2024-01-15_14-30-52.png").is_some());
        assert!(parse_filename_timestamp("Screenshot 2024-01-15 14-30-52.png").is_some());
    }
    
    #[test]
    fn test_invalid_date() {
        assert!(parse_filename_timestamp("20241315143052.png").is_none());
        assert!(parse_filename_timestamp("20240132253052.png").is_none());
    }
    
    #[test]
    fn test_no_match() {
        assert!(parse_filename_timestamp("random_filename.png").is_none());
        assert!(parse_filename_timestamp("image.png").is_none());
    }
}
