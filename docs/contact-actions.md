# Dedicated contact and website actions

These are first-party event names, independent of GA4 or another destination. A classified action
emits ONE event, not both a generic click and another conversion event. Every event includes a
timestamp, page path and delivery ID; ordinary collection also preserves sanitized campaign labels.

| Event | Action dimension | Trigger / meaning |
| --- | --- | --- |
| `phone_click` | `call` | A phone link/button was clicked; not a connected call. |
| `email_click` | `email` | An email link was clicked; not an email sent. |
| `directions_click` | `directions` | Known map/directions link, or explicitly marked button. |
| `form_submit_click` | `form_submit_click` | Submit button clicked; validation may still fail. |
| `form_submit` | `form_submit` | Form submission attempt, including keyboard and AJAX forms. |
| `generate_lead` | `form_success` | Site success handler confirms an accepted contact-form POST. |
| `file_download` | `download` | A link with the download attribute was clicked. |
| `outbound_click` | `outbound` | Other external website link was clicked. |

Unclassified interactions remain `click`. `properties.action_type` is a bounded registry value,
never arbitrary text. Netlify and WordPress normalize the same registry. The public TypeScript
contract is also available to AWS/custom adapters. Downstream destinations can map these names
without replacing the tracker. GA4 key-event registration is a separate configuration step; this
package does not inject GA4, bypass consent, or claim to populate GA4 reports.

## Successful forms

After an application's POST returns a successful response, dispatch from the original form BEFORE
removing it or navigating away:

```js
if (response.ok) {
  form.dispatchEvent(new CustomEvent("ic:form-success", { bubbles: true }));
  // Show success or navigate after dispatching.
}
```

In React capture `const form = event.currentTarget` before awaiting the request. Give the form a
static identifier such as `data-ic-track="contact"`, never a customer's name or field value.
The tracker requires a preceding submit event and accepts only one confirmation per observed
attempt. A failed POST, validation failure, submit-button click, or a thank-you page visit alone
does not confirm a form. The signal proves the site reported acceptance, not inbox delivery or a
verified human lead. Never emit it for a search box or another non-contact utility form.
Native full-page forms need a success integration or a progressively enhanced POST handler.
Third-party iframe forms need the vendor's documented success callback; the parent tracker cannot
see their submissions. Do not guess success from visible text or URL changes.

For a vendor iframe, validate the message origin, source window, configured form ID, and documented
success event in the site integration. Then dispatch on `document`:

```js
document.dispatchEvent(new CustomEvent("ic:lead-success", {
  detail: { name: "contact", id: confirmedSubmissionId }
}));
```

The submission ID deduplicates callbacks only in memory (up to 100 confirmations per page); it is
never sent, persisted or used as an event/session ID. Pass a fixed tracking name, not the vendor's
user-editable form title. Never forward the callback's answers or respondent identifier.

Phone, email and known map links work automatically. Use `data-ic-action="call"`, `"email"`, or
`"directions"` for scripted buttons. Click attributes cannot force `form_success`.

## Totals and privacy

Contact actions = `phone_click` + `generate_lead` + `email_click`. It is a derived total, NOT an
additional event, and NOT unique people. Directions, submission attempts and submit-button clicks
stay separate to avoid triple-counting one form. Delivery retries use the original event ID.

DNT/GPC keeps only generic page-view/click counts: no contact categories, form confirmations,
session IDs or campaign attribution. Phone numbers, email addresses, map queries, field names,
field values and DOM text never enter analytics. Detailed history is available only from the
instrumentation date; expired generic aggregates cannot be retroactively split into categories.

## Release order

Deploy a compatible ingest schema and reporting registry first, then deploy client v0.3.0 to each
website. Netlify builds using GitHub main pick it up on their next deploy. Run the installation
doctor and inspect ordinary delivery; test form success with mocked responses, never real customer
messages or synthetic error notifications.
