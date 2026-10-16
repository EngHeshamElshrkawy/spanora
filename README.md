# Spanora

A single-page portfolio for an online Spanish tutoring institution. Built with plain HTML, CSS and classic JavaScript; there is no build step, framework, package manager or third-party network request.

## Preview

Open `index.html` directly, or serve this directory over HTTP:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`. Add `?dev` to the URL to see the teacher, testimonial and fee placeholders highlighted.

## Editing the site

- **Programs, fees, FAQs, teacher details, testimonials, intro translation, contact email/WhatsApp number and placeholder settings:** edit `js/content.js`. Store the WhatsApp number as international digits without `+` or spaces. Page structure, section headings and layout live in `index.html`.
- **Teacher details:** replace the name, bio and photo in `js/content.js`, set `teacher.placeholder` to `false`, and put the final image in `assets/`.
- **Fees:** update each fee's `price` and set its `placeholder` to `false`; confirm `config.currency` and set `config.currencyPlaceholder` to `false`.
- **Testimonials:** add real, approved quotations to `testimonials`, or set `config.showTestimonialPlaceholders` to `false` until they are available.
- **Brand mark:** replace `assets/logo.svg` with the new logo, keeping the same filename. The site header, footer and SVG favicon use that shared asset; regenerate `favicon-32.png`, `apple-touch-icon.png` and `og-image.png` from their SVG sources when the artwork changes.
- **Colors and layout:** edit `css/tokens.css` for brand colors, then the relevant CSS component file.
- **Lens behavior:** edit `config.lensStyle` (`magnifier` or `torch`) and `config.revealThreshold` in `js/content.js`; its implementation is in `js/intro-lens.js`. Scratching reveals English beneath while masking away the Spanish text in the same area.

## Before launch

- Supply the teacher's name, portrait and personal bio, and clear the corresponding placeholder flag.
- Confirm all prices and the currency.
- Replace testimonial placeholders with real approved testimonials, or turn off `showTestimonialPlaceholders`.
- Replace the branded Open Graph preview with the final approved social-sharing image if needed.
- Have the teacher review the draft English intro translation and confirm the FAQ wording.
- DNS for `spanora.info` must point to GitHub Pages, and HTTPS must be enabled in repository Pages settings.

## GitHub Pages

The root directory is ready to publish from the `main` branch in the repository's Pages settings. `.nojekyll` keeps the static asset directories available as-is. `CNAME`, canonical metadata, Open Graph URLs, `robots.txt`, and `sitemap.xml` are configured for `spanora.info`. Point the domain's DNS to GitHub Pages and enable HTTPS in repository Pages settings. There are no external fonts, scripts, images or libraries.
