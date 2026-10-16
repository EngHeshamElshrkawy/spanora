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
}());
