import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { ACTION_EVENT_TYPES } from "../src/contracts/actions.js";

it("WordPress preserves the same bounded action types and strips them in privacy mode", () => {
  const plugin = fileURLToPath(
    new URL(
      "../platforms/wordpress/internet-crafters-analytics/internet-crafters-analytics.php",
      import.meta.url,
    ),
  );
  const php = `
    define('ABSPATH', '/'); define('IC_ANALYTICS_ENABLED', 'false');
    function add_action() {} function add_filter() {} function register_activation_hook() {} function register_deactivation_hook() {}
    function wp_parse_url($value, $component = -1) { return parse_url($value, $component); }
    function home_url() { return 'https://example.test/'; } function get_current_blog_id() { return 1; }
    function wp_generate_uuid4() { return 'generated-id'; }
    require $argv[1];
    $results = [];
    foreach (['call', 'directions', 'form_submit_click', 'form_submit', 'email', 'download', 'outbound', 'private-person'] as $action) {
      $event = ic_analytics_normalize_browser_event(['event_type'=>'click', 'path'=>'/contact', 'target'=>['action'=>$action]]);
      $results[] = $event['properties']['action_type'] ?? null;
    }
    $_SERVER['HTTP_SEC_GPC'] = '1';
    $results[] = ic_analytics_normalize_browser_event(['event_type'=>'click', 'target'=>['action'=>'call']])['properties'];
    unset($_SERVER['HTTP_SEC_GPC']);
    foreach (json_decode($argv[2], true) as $action => $type) {
      $event = ic_analytics_normalize_browser_event(['event_type'=>$type, 'target'=>['action'=>'email']]);
      $results[] = [$event['event_type'], $event['properties']['action_type']];
    }
    echo json_encode($results);
  `;
  const result = JSON.parse(
    execFileSync("php", ["-r", php, plugin, JSON.stringify(ACTION_EVENT_TYPES)], {
      encoding: "utf8",
    }),
  );
  expect(result).toEqual([
    "call",
    "directions",
    "form_submit_click",
    "form_submit",
    "email",
    "download",
    "outbound",
    null,
    { collection_mode: "anonymous" },
    ...Object.entries(ACTION_EVENT_TYPES).map(([action, type]) => [type, action]),
  ]);
});
