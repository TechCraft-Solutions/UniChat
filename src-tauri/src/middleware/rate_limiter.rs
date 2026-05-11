use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::time::{interval, Duration as TokioDuration};

pub struct RateLimiter {
    requests: Arc<RwLock<HashMap<String, Vec<Instant>>>>,
    max_requests: usize,
    window_duration: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_duration_secs: u64) -> Self {
        Self {
            requests: Arc::new(RwLock::new(HashMap::new())),
            max_requests,
            window_duration: Duration::from_secs(window_duration_secs),
        }
    }

    pub async fn is_allowed(&self, client_id: &str) -> bool {
        let now = Instant::now();
        let mut requests = self.requests.write().await;

        let timestamps = requests.entry(client_id.to_string()).or_insert_with(Vec::new);

        timestamps.retain(|t| now.duration_since(*t) < self.window_duration);

        if timestamps.is_empty() {
            drop(timestamps);
            requests.remove(client_id);
        } else if timestamps.len() >= self.max_requests {
            return false;
        } else {
            timestamps.push(now);
        }
        true
    }

    pub async fn cleanup(&self) {
        let now = Instant::now();
        let mut requests = self.requests.write().await;
        requests.retain(|_, timestamps| {
            timestamps.retain(|t| now.duration_since(*t) < self.window_duration);
            !timestamps.is_empty()
        });
    }
}

pub type SharedRateLimiter = Arc<RateLimiter>;

pub fn create_rate_limiter(max_requests: usize, window_secs: u64) -> SharedRateLimiter {
    Arc::new(RateLimiter::new(max_requests, window_secs))
}

pub fn start_cleanup_task(rate_limiter: SharedRateLimiter) {
    tokio::spawn(async move {
        let mut ticker = interval(TokioDuration::from_secs(60));
        loop {
            ticker.tick().await;
            rate_limiter.cleanup().await;
        }
    });
}