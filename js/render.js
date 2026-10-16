(function () {
  "use strict";

  var data = window.SPANORA;
  var email = data.config.email;
  var whatsappNumber = data.config.whatsapp.replace(/\D/g, "");
  var params = new URLSearchParams(window.location.search);
  if (params.has("dev")) document.body.classList.add("is-dev");

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function mailto(subject, body) {
    return "mailto:" + email +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  }

  function whatsappLink(message) {
    return "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(message);
  }

  var genericLink = mailto("Spanora enquiry", "Hello Spanora,\n\nI'd like to know more about your courses.");
  var placementLink = mailto(
    "Spanora placement test request",
    "Hello Spanora,\n\nI'd like to request a placement test.\n\nMy name:\nMy goals for learning Spanish:\nMy previous Spanish study:"
  );
  var genericWhatsAppLink = whatsappLink("Hello Spanora, I'd like to know more about your courses.");
  var placementWhatsAppLink = whatsappLink("Hello Spanora, I'd like to request a placement test. My name is: My goals for learning Spanish: My previous Spanish study:");

  document.querySelectorAll('[data-mailto="generic"]').forEach(function (link) {
    link.href = genericLink;
  });
  document.querySelectorAll('[data-mailto="placement"]').forEach(function (link) {
    link.href = placementLink;
  });
  document.querySelectorAll('[data-whatsapp="generic"]').forEach(function (link) {
    link.href = genericWhatsAppLink;
  });
  document.querySelectorAll('[data-whatsapp="placement"]').forEach(function (link) {
    link.href = placementWhatsAppLink;
  });

  document.querySelector("[data-intro-es]").innerHTML = data.intro.paragraphs.map(function (paragraph) {
    return "<p>" + escapeHtml(paragraph.es) + "</p>";
  }).join("");
  document.querySelector("[data-intro-en]").innerHTML = data.intro.paragraphs.map(function (paragraph) {
    return "<p>" + escapeHtml(paragraph.en) + "</p>";
  }).join("");
  document.querySelector("[data-intro-done]").textContent = data.intro.completion;

  var teacher = data.teacher;
  var credentials = teacher.credentials.map(function (item) {
    return '<div class="credential"><span class="credential__mark" aria-hidden="true">✳</span><div><strong>' +
      escapeHtml(item.label) + "</strong><span>" + escapeHtml(item.value) + "</span></div></div>";
  }).join("");
  document.querySelector("[data-teacher]").innerHTML =
    '<figure class="teacher-portrait' + (teacher.placeholder ? " is-placeholder" : "") + '">' +
    '<img src="' + escapeHtml(teacher.photo) + '" alt="Portrait of ' + escapeHtml(teacher.name) + '" loading="lazy">' +
    "</figure><div class=\"teacher-copy" + (teacher.placeholder ? " is-placeholder" : "") + '">' +
    "<h3>" + escapeHtml(teacher.name) + "</h3><p class=\"teacher-bio\">" + escapeHtml(teacher.bio) +
    '</p><h3 class="visually-hidden">Credentials</h3><div class="credentials">' + credentials + "</div></div>";

  document.querySelector("[data-programs]").innerHTML = data.programs.map(function (program) {
    var fees = program.fees.map(function (fee) {
      var level = fee.label || fee.level;
      var price = new Intl.NumberFormat("en").format(fee.price) + " " + escapeHtml(data.config.currency);
      var subject = "Spanora enquiry: " + program.name + (fee.level ? " " + fee.level : "");
      var body = "Hello Spanora,\n\nI'm interested in " + program.name +
        (fee.level ? " (" + fee.level + ")" : "") +
        ".\nMy name:\nMy current Spanish level (if known):\nPreferred schedule:";
      return "<tr" + (fee.placeholder || data.config.currencyPlaceholder ? ' class="is-placeholder"' : "") +
        '><th scope="row">' + escapeHtml(level) +
        (fee.parts ? '<span class="fee-placeholder">(' + escapeHtml(fee.parts) + ")</span>" : "") +
        (fee.placeholder || data.config.currencyPlaceholder ? '<span class="fee-placeholder">placeholder</span>' : "") +
        "</th><td>" + price + '</td><td><a aria-label="Ask about ' + escapeHtml(program.name) +
        (fee.level ? " " + escapeHtml(fee.level) : "") +
        '" href="' + escapeHtml(mailto(subject, body)) + '">Ask</a></td></tr>';
    }).join("");
    return '<article class="program-card"><p class="program-card__label">' + escapeHtml(program.label) +
      '</p><h3>' + escapeHtml(program.name) + (program.acronym ? ' <span>(' + escapeHtml(program.acronym) + ")</span>" : "") +
      '</h3><p class="program-card__subtitle">' + escapeHtml(program.acronym ? "Language Core Program" : program.label) +
      '</p><span class="format-badge">' + escapeHtml(program.format) + "</span>" +
      program.description.map(function (paragraph) { return '<p class="program-card__description">' + escapeHtml(paragraph) + "</p>"; }).join("") +
      (program.aside ? '<p class="program-card__aside">' + escapeHtml(program.aside) + "</p>" : "") +
      '<table class="fee-table"><caption>Fees per ' + (program.fees.length === 1 ? "program" : "level") +
      '</caption><thead><tr><th scope="col">Level</th><th scope="col">Fee</th><th scope="col"><span class="visually-hidden">Enquire</span></th></tr></thead><tbody>' +
      fees + "</tbody></table><a class=\"button button--secondary\" href=\"" +
      escapeHtml(mailto("Spanora enquiry: " + program.name, "Hello Spanora,\n\nI'm interested in " + program.name +
        ".\nMy name:\nMy current Spanish level (if known):\nPreferred schedule:")) +
      '">Enroll / ask about this program by email</a><a class="button" href="' +
      escapeHtml(whatsappLink("Hello Spanora, I'm interested in " + program.name + ". My name is: My current Spanish level (if known): My preferred schedule:")) +
      '">Ask about this program on WhatsApp</a></article>';
  }).join("");

  var testimonialRegion = document.querySelector("[data-testimonials]");
  if (data.config.showTestimonialPlaceholders) {
    testimonialRegion.innerHTML = data.testimonials.map(function (item) {
      return '<article class="testimonial is-placeholder"><span class="placeholder-tag">Placeholder — real testimonial coming soon</span>' +
        "<blockquote>“" + escapeHtml(item.quote) + "”</blockquote><p class=\"testimonial__name\">" +
        escapeHtml(item.name) + '</p><p class="testimonial__program">' + escapeHtml(item.program) + "</p></article>";
    }).join("");
  } else {
    document.getElementById("testimonials").hidden = true;
  }

  document.querySelector("[data-faq]").innerHTML = data.faqs.map(function (item, index) {
    return '<details class="faq-item"><summary>' + escapeHtml(item.question) +
      '</summary><div class="faq-item__answer"><p>' + escapeHtml(item.answer) +
      (index === 2 ? ' <a href="' + escapeHtml(placementLink) + '">Request it by email</a> or <a href="' +
        escapeHtml(placementWhatsAppLink) + '">WhatsApp us</a>.' : "") +
      "</p></div></details>";
  }).join("");

  document.querySelector("[data-year]").textContent = new Date().getFullYear();
  document.querySelector("[data-copy-email]").addEventListener("click", function () {
    var status = document.querySelector("[data-copy-status]");
    function fallbackCopy() {
      var range = document.createRange();
      var address = document.querySelector(".email-copy a");
      range.selectNodeContents(address);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "Email selected — copy it with Ctrl+C or ⌘C.";
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(email).then(function () {
        status.textContent = "Email copied.";
      }).catch(function () {
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }
  });
}());
