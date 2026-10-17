(function () {
  "use strict";
  var items = document.querySelectorAll(".faq-item");
  items.forEach(function (item) {
    item.addEventListener("toggle", function () {
      if (!item.open) return;
      items.forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

  function openFaqFromHash() {
    var item = document.getElementById(window.location.hash.slice(1));
    if (item && item.matches(".faq-item")) item.open = true;
  }

  document.querySelectorAll('a[href="#faq-level"]').forEach(function (link) {
    link.addEventListener("click", function () {
      var item = document.getElementById("faq-level");
      if (item) item.open = true;
    });
  });
  window.addEventListener("hashchange", openFaqFromHash);
  openFaqFromHash();
}());
