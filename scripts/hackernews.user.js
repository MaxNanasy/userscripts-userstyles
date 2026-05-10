// ==UserScript==
// @name         Hacker News Scripts
// @namespace    https://github.com/MaxNanasy/userscripts-userstyles
// @version      0.0.0
// @match        https://news.ycombinator.com/*
// @grant        GM.xmlHttpRequest
// @connect      hacker-news.firebaseio.com
// ==/UserScript==

(() => {
  "use strict";

  const ZERO_CLASS = "hn-no-comments";
  const HAS_CLASS = "hn-has-comments";

  function classifyCommentLinks() {
    const links = document.querySelectorAll('a[href^="item?id="]');

    for (const link of links) {
      const text = link.textContent.trim().toLowerCase();

      const isCommentLink =
        text === "discuss" ||
        /^\d+\s+comments?$/.test(text);

      if (!isCommentLink) continue;

      link.classList.remove(ZERO_CLASS, HAS_CLASS);

      const hasZeroComments =
        text === "discuss" ||
        text === "0 comments";

      link.classList.add(hasZeroComments ? ZERO_CLASS : HAS_CLASS);
    }
  }

  classifyCommentLinks();
})();

(() => {
  "use strict";

  const MIN_SWIPE_PX = 60;
  const MAX_VERTICAL_DRIFT_PX = 80;
  const MAX_SCAN = 500;
  const BATCH_SIZE = 20;

  const currentId = Number(new URL(location.href).searchParams.get("id"));
  if (!Number.isInteger(currentId)) return;

  let startX = 0;
  let startY = 0;

  async function fetchItem(id) {
    const response = await GM.xmlHttpRequest({
      method: "GET",
      url: `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
      responseType: "json",
    });

    return response.response;
  }

  function isNavigableItem(item) {
    return item &&
      !item.deleted &&
      !item.dead &&
      (
        item.type === "story" ||
        item.type === "job" ||
        item.type === "poll"
      );
  }

  async function findAdjacentItemId(delta) {
    for (let offset = 1; offset <= MAX_SCAN; offset += BATCH_SIZE) {
      const ids = [];

      for (let i = offset; i < offset + BATCH_SIZE && i <= MAX_SCAN; i++) {
        const id = currentId + delta * i;
        if (id > 0) ids.push(id);
      }

      if (ids.length === 0) return null;

      const items = await Promise.all(
        ids.map(async id => ({
          id,
          item: await fetchItem(id)
        }))
      );

      const match = items.find(({ item }) => isNavigableItem(item));
      if (match) return match.id;
    }

    return null;
  }

  // Start fetching both directions as soon as the userscript loads.
  const nextItemIdPromise = findAdjacentItemId(1);
  const previousItemIdPromise = findAdjacentItemId(-1);

  async function go(delta) {
    const id = await (delta > 0 ? nextItemIdPromise : previousItemIdPromise);

    if (id) {
      location.href = `https://news.ycombinator.com/item?id=${id}`;
    }
  }

  document.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return;

    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchend", event => {
    const touch = event.changedTouches[0];

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (Math.abs(dx) < MIN_SWIPE_PX) return;
    if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX) return;

    // Swipe left: next lower/older story/job/poll ID
    if (dx < 0) go(-1);

    // Swipe right: previous higher/newer story/job/poll ID
    else go(1);
  }, { passive: true });
})();
