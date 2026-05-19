// 版本檢查器 — 強制清除舊 cache
(function() {
  const BUILD_TIME = '20260519-2100';
  const stored = localStorage.getItem('app_build');
  if (stored !== BUILD_TIME) {
    localStorage.setItem('app_build', BUILD_TIME);
    // 清除所有 cache
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    // 強制 reload
    window.location.reload(true);
  }
})();
