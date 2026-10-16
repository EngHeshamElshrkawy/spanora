(function () {
  "use strict";

  var header = document.querySelector("[data-header]");
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.querySelector(".site-nav");
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  var sections = links.map(function (link) {
    return document.querySelector(link.getAttribute("href"));
  }).filter(Boolean);

  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    nav.classList.toggle("is-open", open);
  }

  toggle.addEventListener("click", function () {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });
  nav.addEventListener("click", function (event) {
    if (event.target.closest('a[href^="#"]')) setMenu(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      toggle.focus();
    }
  });

  window.addEventListener("scroll", function () {
    header.classList.toggle("is-scrolled", window.scrollY > 4);
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          if (link.getAttribute("href") === "#" + entry.target.id) {
            link.setAttribute("aria-current", "location");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      });
    }, { rootMargin: "-25% 0px -60% 0px", threshold: 0 });
    sections.forEach(function (section) { observer.observe(section); });

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      document.querySelectorAll(".section").forEach(function (section) {
        section.classList.add("will-reveal");
        revealObserver.observe(section);
      });
    }
  }
}());
