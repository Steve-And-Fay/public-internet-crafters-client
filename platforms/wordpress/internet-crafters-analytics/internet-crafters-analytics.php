<?php
/**
 * Plugin Name: Internet Crafters Analytics
 * Description: Privacy-minimized traffic, crawler, campaign, click, and error telemetry for the Internet Crafters portal.
 * Version: 0.3.0
 * Requires PHP: 7.4
 * Author: Internet Crafters
 * License: GPL-2.0-or-later
 */

if (! defined('ABSPATH')) {
    exit;
}

define('IC_ANALYTICS_PLUGIN_VERSION', '0.3.0');
define('IC_ANALYTICS_BROWSER_ROUTE', '/__ic/analytics/v1/events');

function ic_analytics_setting($constant, $environment, $default = '')
{
    if (defined($constant)) {
        return (string) constant($constant);
    }

    $value = getenv($environment);

    return $value === false ? $default : (string) $value;
}

function ic_analytics_enabled()
{
    return filter_var(ic_analytics_setting('IC_ANALYTICS_ENABLED', 'IC_ANALYTICS_ENABLED', 'false'), FILTER_VALIDATE_BOOLEAN);
}

function ic_analytics_path($value)
{
    if (! is_string($value) || $value === '') {
        return '/';
    }

    $path = wp_parse_url($value, PHP_URL_PATH);
    $path = is_string($path) && $path !== '' ? $path : '/';

    return substr($path[0] === '/' ? $path : '/'.$path, 0, 2048);
}

function ic_analytics_identifier($value, $fallback, $maximum = 128)
{
    if (! is_string($value)) {
        return $fallback;
    }

    $safe = preg_replace('/[^a-zA-Z0-9._:\/\\-]/', '', $value);
    $safe = is_string($safe) ? substr($safe, 0, $maximum) : '';

    return $safe !== '' ? $safe : $fallback;
}

function ic_analytics_campaign_label($value)
{
    if (! is_string($value) || strpos($value, '@') !== false || preg_match('/(?:https?:\/\/|\d{7,})/i', $value)) {
        return null;
    }

    $safe = preg_replace('/[^\p{L}\p{N} ._:\/-]/u', '', $value);
    $safe = is_string($safe) ? preg_replace('/\s+/u', ' ', trim($safe)) : '';

    if ($safe === '') {
        return null;
    }

    return function_exists('mb_substr') ? mb_substr($safe, 0, 128) : substr($safe, 0, 128);
}

function ic_analytics_site()
{
    $host = wp_parse_url(home_url('/'), PHP_URL_HOST);

    return array(
        'hostname' => is_string($host) ? strtolower($host) : 'unknown',
        'platform' => 'wordpress',
        'platform_site_id' => ic_analytics_identifier((string) get_current_blog_id(), 'wordpress', 200),
    );
}

function ic_analytics_release()
{
    return ic_analytics_identifier(
        ic_analytics_setting('IC_ANALYTICS_RELEASE', 'IC_ANALYTICS_RELEASE', IC_ANALYTICS_PLUGIN_VERSION),
        IC_ANALYTICS_PLUGIN_VERSION,
        128
    );
}

function ic_analytics_send($event)
{
    if (! ic_analytics_enabled()) {
        return false;
    }

    $url = ic_analytics_setting('IC_ANALYTICS_INGEST_URL', 'IC_ANALYTICS_INGEST_URL');
    $token = ic_analytics_setting('IC_ANALYTICS_INGEST_TOKEN', 'IC_ANALYTICS_INGEST_TOKEN');
    if ($url === '' || $token === '' || strpos($url, 'https://') !== 0) {
        return false;
    }

    wp_remote_post($url, array(
        'blocking' => false,
        'body' => wp_json_encode($event),
        'headers' => array(
            'Authorization' => 'Bearer '.$token,
            'Content-Type' => 'application/json',
        ),
        'redirection' => 0,
        'timeout' => 2,
    ));

    return true;
}

function ic_analytics_timestamp($value)
{
    if (is_string($value) && strtotime($value) !== false) {
        return gmdate('Y-m-d\TH:i:s.000\Z', strtotime($value));
    }

    return gmdate('Y-m-d\TH:i:s.000\Z');
}

function ic_analytics_normalize_attribution($input)
{
    if (! is_array($input)) {
        return null;
    }

    $output = array();
    foreach (array('campaign', 'content', 'medium', 'source', 'term') as $key) {
        $label = ic_analytics_campaign_label(isset($input[$key]) ? $input[$key] : null);
        if ($label !== null) {
            $output[$key] = $label;
        }
    }

    if (isset($input['paid_click_present']) && $input['paid_click_present'] === true) {
        $provider = ic_analytics_identifier(isset($input['paid_click_provider']) ? $input['paid_click_provider'] : null, '', 40);
        if ($provider !== '') {
            $output['paid_click_present'] = true;
            $output['paid_click_provider'] = $provider;
        }
    }

    return count($output) > 0 ? $output : null;
}

function ic_analytics_normalize_error_frame($frame)
{
    if (! is_array($frame) || ! isset($frame['module']) || ! is_string($frame['module'])) {
        return null;
    }

    $module = substr($frame['module'], 0, 500);
    if ($module === '' || strpos($module, '?') !== false || strpos($module, '#') !== false || strpos($module, '..') !== false || ! preg_match('/^[a-zA-Z0-9_.\/@:\\-]+$/', $module)) {
        return null;
    }

    $output = array('module' => $module);
    if (isset($frame['function'])) {
        $function = ic_analytics_identifier($frame['function'], '', 191);
        if ($function !== '') {
            $output['function'] = $function;
        }
    }
    foreach (array('line', 'column') as $key) {
        $number = isset($frame[$key]) ? filter_var($frame[$key], FILTER_VALIDATE_INT) : false;
        if ($number !== false && $number >= 1 && $number <= 10000000) {
            $output[$key] = $number;
        }
    }

    return $output;
}

function ic_analytics_normalize_browser_event($input)
{
    $actions = array('phone_click'=>'call', 'directions_click'=>'directions', 'form_submit_click'=>'form_submit_click', 'form_submit'=>'form_submit', 'generate_lead'=>'form_success', 'email_click'=>'email', 'file_download'=>'download', 'outbound_click'=>'outbound');
    if (! is_array($input) || ! isset($input['event_type']) || (! isset($actions[$input['event_type']]) && ! in_array($input['event_type'], array('page_view', 'click', 'error'), true))) {
        return null;
    }

    $type = $input['event_type'];
    $anonymous = (isset($input['collection_mode']) && $input['collection_mode'] === 'anonymous')
        || (isset($_SERVER['HTTP_DNT']) && $_SERVER['HTTP_DNT'] === '1')
        || (isset($_SERVER['HTTP_SEC_GPC']) && $_SERVER['HTTP_SEC_GPC'] === '1');
    if ($anonymous && $type === 'error') {
        return null;
    }
    if ($anonymous && isset($actions[$type])) $type = 'click';
    $event = array(
        'schema_version' => 1,
        'event_id' => ic_analytics_identifier(isset($input['event_id']) ? $input['event_id'] : null, wp_generate_uuid4()),
        'event_type' => $type,
        'occurred_at' => ic_analytics_timestamp(isset($input['occurred_at']) ? $input['occurred_at'] : null),
        'source' => 'browser',
        'site' => ic_analytics_site(),
        'page' => array('path' => ic_analytics_path(isset($input['path']) ? $input['path'] : '/')),
    );

    if ($anonymous) {
        $event['properties'] = array('collection_mode' => 'anonymous');
        $event['occurred_at'] = gmdate('Y-m-d\TH:i:00\Z', strtotime($event['occurred_at']));
    } elseif ($type !== 'error') {
        $properties = array(
            'session_id' => ic_analytics_identifier(isset($input['session_id']) ? $input['session_id'] : null, wp_generate_uuid4()),
        );
        if ($type === 'click' || isset($actions[$type])) {
            $target = isset($input['target']) && is_array($input['target']) ? $input['target'] : array();
            if (isset($actions[$type])) {
                $properties['action_type'] = $actions[$type];
            } elseif (isset($target['action']) && in_array($target['action'], $actions, true)) {
                $properties['action_type'] = $target['action'];
            }
            $kind = ic_analytics_identifier(isset($target['kind']) ? $target['kind'] : null, '', 128);
            $name = ic_analytics_identifier(isset($target['name']) ? $target['name'] : null, '', 128);
            if ($kind !== '') {
                $properties['target_kind'] = $kind;
            }
            if ($name !== '') {
                $properties['target_name'] = $name;
            }
            if (isset($target['destination']) && is_string($target['destination'])) {
                $destination = wp_parse_url($target['destination']);
                if (is_array($destination) && isset($destination['scheme']) && in_array($destination['scheme'], array('tel', 'mailto'), true)) {
                    $properties['target_destination'] = $destination['scheme'].':';
                } elseif (is_array($destination) && isset($destination['host']) && strtolower($destination['host']) !== $event['site']['hostname']) {
                    $scheme = isset($destination['scheme']) && in_array($destination['scheme'], array('http', 'https'), true) ? $destination['scheme'] : 'https';
                    $properties['target_destination'] = $scheme.'://'.strtolower($destination['host']);
                } else {
                    $properties['target_destination'] = ic_analytics_path($target['destination']);
                }
            }
        }
        $event['properties'] = $properties;
        $attribution = ic_analytics_normalize_attribution(isset($input['attribution']) ? $input['attribution'] : null);
        if ($attribution !== null) {
            $event['attribution'] = $attribution;
        }
    } else {
        if (! isset($input['error']) || ! is_array($input['error']) || (isset($input['error']['runtime']) && $input['error']['runtime'] !== 'browser')) {
            return null;
        }
        $raw = $input['error'];
        $frames = array();
        foreach (isset($raw['frames']) && is_array($raw['frames']) ? array_slice($raw['frames'], 0, 20) : array() as $frame) {
            $normalized = ic_analytics_normalize_error_frame($frame);
            if ($normalized !== null) {
                $frames[] = $normalized;
            }
        }
        $error = array(
            'type' => ic_analytics_identifier(isset($raw['type']) ? $raw['type'] : null, 'BrowserError', 191),
            'mechanism' => ic_analytics_identifier(isset($raw['mechanism']) ? $raw['mechanism'] : null, 'window.error', 80),
            'release' => ic_analytics_identifier(isset($raw['release']) ? $raw['release'] : null, ic_analytics_release(), 128),
            'runtime' => 'browser',
            'frames' => $frames,
        );
        if (isset($raw['environment']) && is_array($raw['environment'])) {
            $environment = array();
            foreach (array('browser_family', 'os_family', 'runtime_version') as $key) {
                $value = ic_analytics_identifier(isset($raw['environment'][$key]) ? $raw['environment'][$key] : null, '', 128);
                if ($value !== '') {
                    $environment[$key] = $value;
                }
            }
            if (count($environment) > 0) {
                $error['environment'] = $environment;
            }
        }
        $event['error'] = $error;
    }

    return $event;
}

function ic_analytics_register_route()
{
    add_rewrite_rule('^__ic/analytics/v1/events/?$', 'index.php?ic_analytics_browser_events=1', 'top');
}

function ic_analytics_query_vars($vars)
{
    $vars[] = 'ic_analytics_browser_events';

    return $vars;
}

function ic_analytics_handle_browser_event()
{
    if ((string) get_query_var('ic_analytics_browser_events') !== '1') {
        return;
    }

    if (! ic_analytics_enabled() || strtoupper(isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '') !== 'POST') {
        status_header(404);
        exit;
    }

    $origin = isset($_SERVER['HTTP_ORIGIN']) ? wp_parse_url(wp_unslash($_SERVER['HTTP_ORIGIN']), PHP_URL_HOST) : null;
    if (is_string($origin) && strtolower($origin) !== ic_analytics_site()['hostname']) {
        status_header(403);
        exit;
    }

    $length = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($length > 8192) {
        status_header(413);
        exit;
    }

    $body = file_get_contents('php://input');
    $input = is_string($body) ? json_decode($body, true) : null;
    $event = ic_analytics_normalize_browser_event($input);
    if ($event === null) {
        status_header(422);
        exit;
    }

    ic_analytics_send($event);
    status_header(202);
    header('Cache-Control: no-store');
    exit;
}

function ic_analytics_enqueue_browser_tracker()
{
    if (! ic_analytics_enabled() || is_admin()) {
        return;
    }

    wp_enqueue_script(
        'internet-crafters-analytics',
        plugin_dir_url(__FILE__).'assets/tracker.js',
        array(),
        IC_ANALYTICS_PLUGIN_VERSION,
        true
    );
}

function ic_analytics_release_meta()
{
    if (ic_analytics_enabled() && ! is_admin()) {
        echo '<meta name="ic-release" content="'.esc_attr(ic_analytics_release()).'">'."\n";
    }
}

function ic_analytics_server_frame($file, $function, $line, $column = null)
{
    $module = is_string($file) ? str_replace(array(ABSPATH, WP_CONTENT_DIR.'/'), array('', 'wp-content/'), $file) : '';
    $frame = ic_analytics_normalize_error_frame(array(
        'module' => $module,
        'function' => $function,
        'line' => $line,
        'column' => $column,
    ));

    return $frame;
}

function internet_crafters_capture_exception($exception, $mechanism = 'wordpress.exception')
{
    if (! ($exception instanceof Throwable)) {
        return false;
    }

    $frames = array();
    $first = ic_analytics_server_frame($exception->getFile(), '', $exception->getLine());
    if ($first !== null) {
        $frames[] = $first;
    }
    foreach (array_slice($exception->getTrace(), 0, 19) as $trace) {
        $frame = ic_analytics_server_frame(
            isset($trace['file']) ? $trace['file'] : '',
            isset($trace['function']) ? $trace['function'] : '',
            isset($trace['line']) ? $trace['line'] : null
        );
        if ($frame !== null) {
            $frames[] = $frame;
        }
    }

    return ic_analytics_send(array(
        'schema_version' => 1,
        'event_id' => wp_generate_uuid4(),
        'event_type' => 'error',
        'occurred_at' => ic_analytics_timestamp(null),
        'source' => 'wordpress',
        'site' => ic_analytics_site(),
        'page' => array('path' => ic_analytics_path(isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/')),
        'error' => array(
            'type' => ic_analytics_identifier(get_class($exception), 'WordPressError', 191),
            'mechanism' => ic_analytics_identifier($mechanism, 'wordpress.exception', 80),
            'release' => ic_analytics_release(),
            'runtime' => 'wordpress',
            'frames' => $frames,
        ),
    ));
}

function ic_analytics_capture_fatal_error()
{
    $last = error_get_last();
    if (! is_array($last) || ! in_array($last['type'], array(E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR), true)) {
        return;
    }

    $frame = ic_analytics_server_frame($last['file'], '', $last['line']);
    ic_analytics_send(array(
        'schema_version' => 1,
        'event_id' => wp_generate_uuid4(),
        'event_type' => 'error',
        'occurred_at' => ic_analytics_timestamp(null),
        'source' => 'wordpress',
        'site' => ic_analytics_site(),
        'page' => array('path' => ic_analytics_path(isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/')),
        'error' => array(
            'type' => 'PHPFatalError',
            'mechanism' => 'shutdown',
            'release' => ic_analytics_release(),
            'runtime' => 'wordpress',
            'frames' => $frame === null ? array() : array($frame),
        ),
    ));
}

function ic_analytics_capture_crawler()
{
    if (! ic_analytics_enabled() || is_admin() || (string) get_query_var('ic_analytics_browser_events') === '1') {
        return;
    }

    $method = strtoupper(isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET');
    $agent = isset($_SERVER['HTTP_USER_AGENT']) ? substr(wp_unslash($_SERVER['HTTP_USER_AGENT']), 0, 1024) : '';
    $is_html = true;
    foreach (headers_list() as $header) {
        if (stripos($header, 'Content-Type:') === 0) {
            $is_html = stripos($header, 'text/html') !== false || stripos($header, 'application/xhtml+xml') !== false;
        }
    }
    if (! $is_html || ! in_array($method, array('GET', 'HEAD'), true) || ! preg_match('/(?:bot\b|crawler|spider|slurp|GPTBot|ChatGPT-User|OAI-SearchBot|Claude|Perplexity|Applebot|DuckDuckBot)/i', $agent)) {
        return;
    }

    $status = http_response_code();
    ic_analytics_send(array(
        'schema_version' => 1,
        'event_id' => wp_generate_uuid4(),
        'event_type' => 'crawler_page_view',
        'occurred_at' => ic_analytics_timestamp(null),
        'source' => 'wordpress',
        'site' => ic_analytics_site(),
        'page' => array('path' => ic_analytics_path(isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/')),
        'request' => array(
            'agent_category' => 'crawler;wordpress-user-agent',
            'client_ip' => isset($_SERVER['REMOTE_ADDR']) ? substr(wp_unslash($_SERVER['REMOTE_ADDR']), 0, 64) : 'unknown',
            'method' => $method,
            'status_code' => is_int($status) && $status >= 100 && $status <= 599 ? $status : 200,
            'user_agent' => $agent,
        ),
    ));
}

function ic_analytics_shutdown()
{
    ic_analytics_capture_fatal_error();
    ic_analytics_capture_crawler();
}

function ic_analytics_activate()
{
    ic_analytics_register_route();
    flush_rewrite_rules();
}

add_action('init', 'ic_analytics_register_route');
add_filter('query_vars', 'ic_analytics_query_vars');
add_action('template_redirect', 'ic_analytics_handle_browser_event', 0);
add_action('wp_enqueue_scripts', 'ic_analytics_enqueue_browser_tracker');
add_action('wp_head', 'ic_analytics_release_meta', 1);
register_activation_hook(__FILE__, 'ic_analytics_activate');
register_deactivation_hook(__FILE__, 'flush_rewrite_rules');
register_shutdown_function('ic_analytics_shutdown');
