#include "server.h"
#include "headlights.h"
#include "sensor.h"
#include "indicators.h"
#include "database.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#include <windows.h>
#include <direct.h>
#else
#include <unistd.h>
#endif

static struct mg_mgr s_mgr;
static char s_static_dir[512] = "frontend";

static const char *JSON_HEADERS =
    "Content-Type: application/json\r\n"
    "Access-Control-Allow-Origin: *\r\n"
    "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
    "Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With\r\n"
    "Cache-Control: no-cache, no-store, must-revalidate\r\n";

static void ev_handler(struct mg_connection *c, int ev, void *ev_data) {
    if (ev == MG_EV_HTTP_MSG) {
        struct mg_http_message *hm = (struct mg_http_message *)ev_data;

        /* Handle CORS OPTIONS Preflight */
        if (mg_strcmp(hm->method, mg_str("OPTIONS")) == 0) {
            mg_http_reply(c, 204,
                "Access-Control-Allow-Origin: *\r\n"
                "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
                "Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With\r\n"
                "Access-Control-Max-Age: 86400\r\n", "");
            return;
        }

        /* 1. Route: GET /api/status */
        if (mg_match(hm->uri, mg_str("/api/status"), NULL) && mg_strcmp(hm->method, mg_str("GET")) == 0) {
            char *json = headlights_get_status_json();
            mg_http_reply(c, 200, JSON_HEADERS, "%s", json);
            free(json);
            return;
        }

        /* 2. Route: POST /api/headlights/power */
        if (mg_match(hm->uri, mg_str("/api/headlights/power"), NULL) && mg_strcmp(hm->method, mg_str("POST")) == 0) {
            double pwr = 1.0;
            if (mg_json_get_num(hm->body, "$.power", &pwr)) {
                headlights_set_power((int)pwr);
                char *json = headlights_get_status_json();
                mg_http_reply(c, 200, JSON_HEADERS, "%s", json);
                free(json);
            } else {
                mg_http_reply(c, 400, JSON_HEADERS, "{\"success\":false,\"error\":\"Missing 'power' parameter\"}");
            }
            return;
        }

        /* 3. Route: POST /api/headlights/mode */
        if (mg_match(hm->uri, mg_str("/api/headlights/mode"), NULL) && mg_strcmp(hm->method, mg_str("POST")) == 0) {
            char *mode = mg_json_get_str(hm->body, "$.mode");
            if (mode) {
                if (headlights_set_mode(mode)) {
                    char *json = headlights_get_status_json();
                    mg_http_reply(c, 200, JSON_HEADERS, "%s", json);
                    free(json);
                } else {
                    mg_http_reply(c, 400, JSON_HEADERS, "{\"success\":false,\"error\":\"Invalid mode. Must be OFF, PARKING, LOW_BEAM, or HIGH_BEAM\"}");
                }
                free(mode);
            } else {
                mg_http_reply(c, 400, JSON_HEADERS, "{\"success\":false,\"error\":\"Missing 'mode' parameter\"}");
            }
            return;
        }

        /* 4. Route: POST /api/headlights/automatic */
        if (mg_match(hm->uri, mg_str("/api/headlights/automatic"), NULL) && mg_strcmp(hm->method, mg_str("POST")) == 0) {
            double auto_val = 1.0;
            double thresh = -1.0;
            mg_json_get_num(hm->body, "$.auto_mode", &auto_val);
            if (mg_json_get_num(hm->body, "$.threshold", &thresh) && thresh >= 0.0) {
                sensor_set_threshold(thresh);
            }
            headlights_set_auto((int)auto_val);
            char *json = headlights_get_status_json();
            mg_http_reply(c, 200, JSON_HEADERS, "%s", json);
            free(json);
            return;
        }

        /* 5. Route: POST /api/sensor/light */
        if (mg_match(hm->uri, mg_str("/api/sensor/light"), NULL) && mg_strcmp(hm->method, mg_str("POST")) == 0) {
            double lux = 50.0;
            if (mg_json_get_num(hm->body, "$.ambient_light", &lux)) {
                sensor_set_light_level(lux);
                char *json = headlights_get_status_json();
                mg_http_reply(c, 200, JSON_HEADERS, "%s", json);
                free(json);
            } else {
                mg_http_reply(c, 400, JSON_HEADERS, "{\"success\":false,\"error\":\"Missing 'ambient_light' parameter\"}");
            }
            return;
        }

        /* 6. Route: POST /api/indicators */
        if (mg_match(hm->uri, mg_str("/api/indicators"), NULL) && mg_strcmp(hm->method, mg_str("POST")) == 0) {
            char *type = mg_json_get_str(hm->body, "$.type");
            double state_val = 1.0;
            mg_json_get_num(hm->body, "$.state", &state_val);

            if (type) {
                if (indicators_set(type, (int)state_val)) {
                    char *json = headlights_get_status_json();
                    mg_http_reply(c, 200, JSON_HEADERS, "%s", json);
                    free(json);
                } else {
                    mg_http_reply(c, 400, JSON_HEADERS, "{\"success\":false,\"error\":\"Invalid indicator type\"}");
                }
                free(type);
            } else {
                mg_http_reply(c, 400, JSON_HEADERS, "{\"success\":false,\"error\":\"Missing 'type' parameter\"}");
            }
            return;
        }

        /* 7. Route: POST /api/environment */
        if (mg_match(hm->uri, mg_str("/api/environment"), NULL) && mg_strcmp(hm->method, mg_str("POST")) == 0) {
            char *env = mg_json_get_str(hm->body, "$.environment");
            if (env) {
                if (headlights_set_environment(env)) {
                    char *json = headlights_get_status_json();
                    mg_http_reply(c, 200, JSON_HEADERS, "%s", json);
                    free(json);
                } else {
                    mg_http_reply(c, 400, JSON_HEADERS, "{\"success\":false,\"error\":\"Invalid environment type\"}");
                }
                free(env);
            } else {
                mg_http_reply(c, 400, JSON_HEADERS, "{\"success\":false,\"error\":\"Missing 'environment' parameter\"}");
            }
            return;
        }

        /* 8. Route: GET /api/history */
        if (mg_match(hm->uri, mg_str("/api/history"), NULL) && mg_strcmp(hm->method, mg_str("GET")) == 0) {
            char *json = headlights_get_history_json(50);
            mg_http_reply(c, 200, JSON_HEADERS, "%s", json);
            free(json);
            return;
        }

        /* 9. Route: POST /api/simulation/tick */
        if (mg_match(hm->uri, mg_str("/api/simulation/tick"), NULL)) {
            sensor_simulation_tick();
            sensor_process_auto_logic();
            char *json = headlights_get_status_json();
            mg_http_reply(c, 200, JSON_HEADERS, "%s", json);
            free(json);
            return;
        }

        /* 10. Static File Serving (HTML, CSS, JS, Assets) */
        struct mg_http_serve_opts opts = {
            .root_dir = s_static_dir,
            .ssi_pattern = NULL,
            .extra_headers = "Access-Control-Allow-Origin: *\r\nCache-Control: no-cache\r\n"
        };
        mg_http_serve_dir(c, hm, &opts);
    }
}

int server_init(const char *port, const char *static_dir) {
    if (static_dir) {
        char resolved[512];
#ifdef _WIN32
        if (_fullpath(resolved, static_dir, sizeof(resolved))) {
            strncpy(s_static_dir, resolved, sizeof(s_static_dir) - 1);
        } else {
            strncpy(s_static_dir, static_dir, sizeof(s_static_dir) - 1);
        }
#else
        if (realpath(static_dir, resolved)) {
            strncpy(s_static_dir, resolved, sizeof(s_static_dir) - 1);
        } else {
            strncpy(s_static_dir, static_dir, sizeof(s_static_dir) - 1);
        }
#endif
        /* Convert backslashes to forward slashes for Mongoose uri2path */
        for (char *p = s_static_dir; *p; p++) {
            if (*p == '\\') *p = '/';
        }
    }

    mg_mgr_init(&s_mgr);

    char url[64];
    snprintf(url, sizeof(url), "http://0.0.0.0:%s", port ? port : "8001");

    struct mg_connection *c = mg_http_listen(&s_mgr, url, ev_handler, NULL);
    if (!c) {
        fprintf(stderr, "[SERVER ERROR] Cannot bind to %s. Port may be in use.\n", url);
        return 0;
    }

    printf("====================================================================\n");
    printf("   3D VEHICLE HEADLIGHT CONTROL SIMULATOR (C BACKEND)\n");
    printf("====================================================================\n");
    printf(" [x] HTTP Engine:     Mongoose Embedded C Networking\n");
    printf(" [x] Web Port:        http://localhost:%s\n", port ? port : "8001");
    printf(" [x] Static Assets:   %s\n", s_static_dir);
    printf(" [x] Telemetry API:   http://localhost:%s/api/status\n", port ? port : "8001");
    printf("====================================================================\n");
    printf(" Open your browser and navigate to: http://localhost:%s\n\n", port ? port : "8001");

    return 1;
}

void server_poll(int timeout_ms) {
    mg_mgr_poll(&s_mgr, timeout_ms);
}

void server_cleanup(void) {
    mg_mgr_free(&s_mgr);
    printf("[SERVER] Mongoose HTTP server stopped.\n");
}

