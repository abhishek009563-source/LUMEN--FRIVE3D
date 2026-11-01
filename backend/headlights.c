#include "headlights.h"
#include "database.h"
#include "sensor.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int headlights_get_state(HeadlightSystemState *state) {
    if (!state) return 0;
    memset(state, 0, sizeof(HeadlightSystemState));

    sqlite3 *db = db_get_handle();
    if (!db) return 0;

    sqlite3_stmt *stmt;
    const char *sql =
        "SELECT power, mode, auto_mode, ambient_light, light_threshold, "
        "left_indicator, right_indicator, hazard_lights, environment, speed, battery_voltage, updated_at "
        "FROM system_state WHERE id = 1;";

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }

    int success = 0;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        state->power = sqlite3_column_int(stmt, 0);
        strncpy(state->mode, (const char *)sqlite3_column_text(stmt, 1), sizeof(state->mode) - 1);
        state->auto_mode = sqlite3_column_int(stmt, 2);
        state->ambient_light = sqlite3_column_double(stmt, 3);
        state->light_threshold = sqlite3_column_double(stmt, 4);
        state->left_indicator = sqlite3_column_int(stmt, 5);
        state->right_indicator = sqlite3_column_int(stmt, 6);
        state->hazard_lights = sqlite3_column_int(stmt, 7);
        strncpy(state->environment, (const char *)sqlite3_column_text(stmt, 8), sizeof(state->environment) - 1);
        state->speed = sqlite3_column_double(stmt, 9);
        state->battery_voltage = sqlite3_column_double(stmt, 10);
        const char *upd = (const char *)sqlite3_column_text(stmt, 11);
        if (upd) {
            strncpy(state->updated_at, upd, sizeof(state->updated_at) - 1);
        }
        success = 1;
    }

    sqlite3_finalize(stmt);
    return success;
}

int headlights_set_power(int power) {
    sqlite3 *db = db_get_handle();
    if (!db) return 0;

    HeadlightSystemState curr;
    headlights_get_state(&curr);

    const char *new_mode = power ? (strcmp(curr.mode, "OFF") == 0 ? "LOW_BEAM" : curr.mode) : "OFF";

    sqlite3_stmt *stmt;
    const char *sql = "UPDATE system_state SET power = ?, mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }

    sqlite3_bind_int(stmt, 1, power ? 1 : 0);
    sqlite3_bind_text(stmt, 2, new_mode, -1, SQLITE_STATIC);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    char detail[128];
    snprintf(detail, sizeof(detail), "Vehicle headlight master power switched %s (Mode: %s)", power ? "ON" : "OFF", new_mode);
    db_log_event("USER", power ? "POWER_ON" : "POWER_OFF", detail, curr.ambient_light, new_mode);

    return 1;
}

int headlights_set_mode(const char *mode) {
    if (!mode) return 0;

    /* Validate mode */
    if (strcmp(mode, "OFF") != 0 &&
        strcmp(mode, "PARKING") != 0 &&
        strcmp(mode, "LOW_BEAM") != 0 &&
        strcmp(mode, "HIGH_BEAM") != 0) {
        return 0;
    }

    sqlite3 *db = db_get_handle();
    if (!db) return 0;

    HeadlightSystemState curr;
    headlights_get_state(&curr);

    int power = (strcmp(mode, "OFF") == 0) ? 0 : 1;

    sqlite3_stmt *stmt;
    const char *sql = "UPDATE system_state SET mode = ?, power = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }

    sqlite3_bind_text(stmt, 1, mode, -1, SQLITE_STATIC);
    sqlite3_bind_int(stmt, 2, power);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    char detail[128];
    snprintf(detail, sizeof(detail), "Lighting mode transitioned to %s", mode);
    db_log_event("USER", "MODE_CHANGE", detail, curr.ambient_light, mode);

    return 1;
}

int headlights_set_auto(int auto_mode) {
    sqlite3 *db = db_get_handle();
    if (!db) return 0;

    HeadlightSystemState curr;
    headlights_get_state(&curr);

    sqlite3_stmt *stmt;
    const char *sql = "UPDATE system_state SET auto_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }

    sqlite3_bind_int(stmt, 1, auto_mode ? 1 : 0);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    char detail[128];
    snprintf(detail, sizeof(detail), "Automatic ALS light sensing system %s", auto_mode ? "Enabled" : "Disabled");
    db_log_event("USER", auto_mode ? "AUTO_ENABLED" : "AUTO_DISABLED", detail, curr.ambient_light, curr.mode);

    if (auto_mode) {
        sensor_process_auto_logic();
    }

    return 1;
}

int headlights_set_environment(const char *env) {
    if (!env) return 0;

    double target_ambient = 25.0;
    double target_speed = 50.0;

    if (strcmp(env, "DAYTIME") == 0) {
        target_ambient = 85.0;
        target_speed = 60.0;
    } else if (strcmp(env, "EVENING") == 0) {
        target_ambient = 38.0;
        target_speed = 52.0;
    } else if (strcmp(env, "NIGHT") == 0) {
        target_ambient = 16.0;
        target_speed = 65.0;
    } else if (strcmp(env, "DARK_HIGHWAY") == 0) {
        target_ambient = 4.0;
        target_speed = 95.0;
    } else {
        return 0; /* Invalid environment name */
    }

    sqlite3 *db = db_get_handle();
    if (!db) return 0;

    sqlite3_stmt *stmt;
    const char *sql = "UPDATE system_state SET environment = ?, ambient_light = ?, speed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }

    sqlite3_bind_text(stmt, 1, env, -1, SQLITE_STATIC);
    sqlite3_bind_double(stmt, 2, target_ambient);
    sqlite3_bind_double(stmt, 3, target_speed);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    HeadlightSystemState curr;
    headlights_get_state(&curr);

    char detail[128];
    snprintf(detail, sizeof(detail), "Atmospheric condition shifted to %s (Ambient: %.1f%%, Speed: %.0f km/h)", env, target_ambient, target_speed);
    db_log_event("ENVIRONMENT", "ENV_CHANGE", detail, target_ambient, curr.mode);

    /* Re-evaluate automatic headlight threshold in new atmospheric lighting */
    if (curr.auto_mode) {
        sensor_process_auto_logic();
    }

    return 1;
}

char *headlights_get_status_json(void) {
    HeadlightSystemState s;
    if (!headlights_get_state(&s)) {
        return strdup("{\"error\":\"Failed to fetch system state\"}");
    }

    /* Compute derived optical metrics */
    double drl_intensity = 0.0;
    double low_beam_intensity = 0.0;
    double high_beam_intensity = 0.0;
    int cone_visible = 0;
    double range_meters = 0.0;
    const char *color_temp = "#e0f7fa"; /* Xenon / Cool White LED */

    if (s.power) {
        if (strcmp(s.mode, "PARKING") == 0) {
            drl_intensity = 0.75;
            low_beam_intensity = 0.0;
            high_beam_intensity = 0.0;
            cone_visible = 0;
            range_meters = 12.0;
        } else if (strcmp(s.mode, "LOW_BEAM") == 0) {
            drl_intensity = 1.0;
            low_beam_intensity = 1.0;
            high_beam_intensity = 0.0;
            cone_visible = 1;
            range_meters = 48.0;
        } else if (strcmp(s.mode, "HIGH_BEAM") == 0) {
            drl_intensity = 1.0;
            low_beam_intensity = 1.0;
            high_beam_intensity = 1.0;
            cone_visible = 1;
            range_meters = 115.0;
        }
    }

    /* Determine sensor decision status string */
    const char *decision_str = "STANDBY_MANUAL";
    if (s.auto_mode) {
        if (s.ambient_light < s.light_threshold) {
            decision_str = "AUTOMATIC_ILLUMINATION_ENGAGED";
        } else {
            decision_str = "SUFFICIENT_DAYLIGHT_DETECTED";
        }
    }

    /* Fetch recent events */
    char *history_json = headlights_get_history_json(6);

    size_t cap = 8192;
    char *buf = malloc(cap);
    if (!buf) {
        free(history_json);
        return strdup("{\"error\":\"Out of memory\"}");
    }

    snprintf(buf, cap,
        "{"
        "\"power\":%d,"
        "\"mode\":\"%s\","
        "\"auto_mode\":%d,"
        "\"ambient_light\":%.1f,"
        "\"light_threshold\":%.1f,"
        "\"left_indicator\":%d,"
        "\"right_indicator\":%d,"
        "\"hazard_lights\":%d,"
        "\"environment\":\"%s\","
        "\"speed\":%.1f,"
        "\"battery_voltage\":%.2f,"
        "\"updated_at\":\"%s\","
        "\"optical_telemetry\":{"
          "\"drl_intensity\":%.2f,"
          "\"low_beam_intensity\":%.2f,"
          "\"high_beam_intensity\":%.2f,"
          "\"cone_visible\":%d,"
          "\"range_meters\":%.1f,"
          "\"color_temp\":\"%s\""
        "},"
        "\"sensor_telemetry\":{"
          "\"lux_percent\":%.1f,"
          "\"threshold_percent\":%.1f,"
          "\"is_dark\":%d,"
          "\"decision\":\"%s\""
        "},"
        "\"recent_events\":%s"
        "}",
        s.power,
        s.mode,
        s.auto_mode,
        s.ambient_light,
        s.light_threshold,
        s.left_indicator,
        s.right_indicator,
        s.hazard_lights,
        s.environment,
        s.speed,
        s.battery_voltage,
        s.updated_at,
        drl_intensity,
        low_beam_intensity,
        high_beam_intensity,
        cone_visible,
        range_meters,
        color_temp,
        s.ambient_light,
        s.light_threshold,
        s.ambient_light < s.light_threshold ? 1 : 0,
        decision_str,
        history_json ? history_json : "[]"
    );

    if (history_json) free(history_json);
    return buf;
}

char *headlights_get_history_json(int limit) {
    sqlite3 *db = db_get_handle();
    if (!db) return strdup("[]");

    sqlite3_stmt *stmt;
    char sql[256];
    snprintf(sql, sizeof(sql),
        "SELECT id, timestamp, source, action, details, ambient_light, headlight_state "
        "FROM event_logs ORDER BY id DESC LIMIT %d;", limit > 0 ? limit : 20);

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return strdup("[]");
    }

    size_t cap = 4096;
    size_t len = 0;
    char *buf = malloc(cap);
    if (!buf) {
        sqlite3_finalize(stmt);
        return strdup("[]");
    }

    strcpy(buf, "[");
    len = 1;
    int first = 1;

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        int id = sqlite3_column_int(stmt, 0);
        const char *ts = (const char *)sqlite3_column_text(stmt, 1);
        const char *source = (const char *)sqlite3_column_text(stmt, 2);
        const char *action = (const char *)sqlite3_column_text(stmt, 3);
        const char *details = (const char *)sqlite3_column_text(stmt, 4);
        double ambient = sqlite3_column_double(stmt, 5);
        const char *hstate = (const char *)sqlite3_column_text(stmt, 6);

        char item[512];
        snprintf(item, sizeof(item),
            "%s{\"id\":%d,\"timestamp\":\"%s\",\"source\":\"%s\",\"action\":\"%s\",\"details\":\"%s\",\"ambient_light\":%.1f,\"headlight_state\":\"%s\"}",
            first ? "" : ",",
            id,
            ts ? ts : "",
            source ? source : "",
            action ? action : "",
            details ? details : "",
            ambient,
            hstate ? hstate : ""
        );
        first = 0;

        size_t item_len = strlen(item);
        if (len + item_len + 4 >= cap) {
            cap *= 2;
            char *new_buf = realloc(buf, cap);
            if (!new_buf) {
                free(buf);
                sqlite3_finalize(stmt);
                return strdup("[]");
            }
            buf = new_buf;
        }

        strcpy(buf + len, item);
        len += item_len;
    }

    sqlite3_finalize(stmt);
    strcat(buf, "]");
    return buf;
}

