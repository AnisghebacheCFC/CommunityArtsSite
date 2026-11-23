window.CAJournalUrl = (() => {
  let mapPromise;

  const load = () => {
    if (!mapPromise) {
      mapPromise = fetch("/journal/redirects.json")
        .then((response) => (response.ok ? response.json() : {}))
        .catch(() => ({}));
    }
    return mapPromise;
  };

  return async (id, fallback) => {
    const map = await load();
    return map[id] || fallback;
  };
})();
