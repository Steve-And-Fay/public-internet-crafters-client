# WordPress installation

Build or install the Git dependency, then copy the plugin:

```sh
npm install --save-dev "github:Steve-And-Fay/public-internet-crafters-client#v0.2.4"
npx ic-client install wordpress --target ./wp-content/plugins
```

Alternatively, zip `dist/wordpress/internet-crafters-analytics/` after `npm run build:portable` and
install it in WordPress Admin.

Define configuration in `wp-config.php` before WordPress finishes loading:

```php
define('IC_ANALYTICS_ENABLED', true);
define('IC_ANALYTICS_INGEST_URL', 'https://my.internetcrafters.com/ingest/v1/events');
define('IC_ANALYTICS_INGEST_TOKEN', 'replace-with-the-site-installation-token');
define('IC_ANALYTICS_RELEASE', 'customer-site-release-id');
```

Environment variables with the same names are also accepted. Constants take precedence. Activate
the plugin once so WordPress flushes its rewrite rules for `/__ic/analytics/v1/events`.

The plugin:

- enqueues the generated browser tracker without printing the token
- normalizes browser events at the fixed same-origin route
- observes crawler HTML responses using the user agent
- reports fatal PHP shutdown errors without messages
- exposes `internet_crafters_capture_exception($exception)` for caught exceptions

Example explicit capture:

```php
try {
    run_customer_checkout();
} catch (Throwable $failure) {
    internet_crafters_capture_exception($failure, 'checkout');
    throw $failure;
}
```

Tracking sends use WordPress's HTTP API and do not block the page response. Crawler user agents can
be spoofed, so the report is observation rather than identity proof.

## Check this document against

- `platforms/wordpress/internet-crafters-analytics/internet-crafters-analytics.php`
- `src/browser/tracker.ts`
- `scripts/build-portable.mjs`
