use lru::LruCache;
use std::hash::Hash;
use std::num::NonZeroUsize;
use std::sync::{Arc, Mutex};

/// Thread-safe LRU Cache for decoded media or thumbnails.
#[derive(Clone)]
pub struct MediaLruCache<K: Hash + Eq + Clone, V: Clone> {
    inner: Arc<Mutex<LruCache<K, V>>>,
}

impl<K: Hash + Eq + Clone, V: Clone> MediaLruCache<K, V> {
    pub fn new(capacity: usize) -> Self {
        let cap = NonZeroUsize::new(capacity.max(1)).unwrap();
        Self {
            inner: Arc::new(Mutex::new(LruCache::new(cap))),
        }
    }

    pub fn get(&self, key: &K) -> Option<V> {
        let mut cache = self.inner.lock().unwrap();
        cache.get(key).cloned()
    }

    pub fn put(&self, key: K, value: V) {
        let mut cache = self.inner.lock().unwrap();
        cache.put(key, value);
    }

    pub fn contains(&self, key: &K) -> bool {
        let cache = self.inner.lock().unwrap();
        cache.contains(key)
    }

    pub fn clear(&self) {
        let mut cache = self.inner.lock().unwrap();
        cache.clear();
    }

    pub fn len(&self) -> usize {
        let cache = self.inner.lock().unwrap();
        cache.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lru_cache_operations() {
        let cache = MediaLruCache::new(2);
        cache.put("item1", 100);
        cache.put("item2", 200);

        assert_eq!(cache.get(&"item1"), Some(100));
        assert_eq!(cache.get(&"item2"), Some(200));

        // Inserting third item evicts oldest (item1 was recently accessed, so item2 or least recent)
        cache.put("item3", 300);
        assert_eq!(cache.get(&"item3"), Some(300));
        assert_eq!(cache.len(), 2);
    }
}
