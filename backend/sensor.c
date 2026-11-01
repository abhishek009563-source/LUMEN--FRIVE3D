#include "sensor.h"
#include "headlights.h"
#include "database.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int sensor_set_light_level(double lux_percent) {
    if (lux_percent < 0.0) lux_percent = 0.0;
    if (lux_percent > 100.0) lux_percent = 100.0;

    sqlite3 *db = db_get_handle();
    if (!db) return 0;

    sqlite3_stmt *stmt;
    const char *sql = "UPDATE system_state SET ambient_light = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }

    sqlite3_bind_double(stmt, 1, lux_percent);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    HeadlightSystemState curr;
    headlights_get_state(&curr);

    char detail[128];
    snprintf(detail, sizeof(detail), "Photodiode sensor reading adjusted to %.1f%%", lux_percent);
    db_log_event("SENSOR", "ALS_UPDATE", detail, lux_percent, curr.mode);

    /* Process automated logic immediately */
    if (curr.auto_mode) {
        sensor_process_auto_logic();
    }

    return 1;
}

int sensor_set_threshold(double threshold_percent) {
    if (threshold_percent < 5.0) threshold_percent = 5.0;
    if (threshold_percent > 90.0) threshold_percent = 90.0;

    sqlite3 *db = db_get_handle();
    if (!db) return 0;

    sqlite3_stmt *stmt;
    const char *sql = "UPDATE system_state SET light_threshold = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }

    sqlite3_bind_double(stmt, 1, threshold_percent);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    HeadlightSystemState curr;
    headlights_get_state(&curr);

    char detail[128];
    snprintf(detail, sizeof(detail), "Auto-light illumination threshold updated to %.1f%%", threshold_percent);
    db_log_event("USER", "THRESHOLD_SET", detail, curr.ambient_light, curr.mode);

    if (curr.auto_mode) {
        sensor_process_auto_logic();
    }

    return 1;
}

void sensor_process_auto_logic(void) {
    sqlite3 *db = db_get_handle();
    if (!db) return;

    HeadlightSystemState curr;
    if (!headlights_get_state(&curr)) return;

    /* Automatic mode must be active to trigger autonomous actions */
    if (!curr.auto_mode) return;

    /* Condition 1: Dark environment detected (ambient < threshold) -> Activate Low Beams */
    if (curr.ambient_light < curr.light_threshold) {
        if (strcmp(curr.mode, "LOW_BEAM") != 0 && strcmp(curr.mode, "HIGH_BEAM") != 0) {
            sqlite3_stmt *stmt;
            const char *sql = "UPDATE system_state SET mode = 'LOW_BEAM', power = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1;";
            if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) == SQLITE_OK) {
                sqlite3_step(stmt);
                sqlite3_finalize(stmt);

                char detail[160];
                snprintf(detail, sizeof(detail),
                    "ALS Photocell (%.1f%%) fell below threshold (%.1f%%). Low beam headlights autonomously activated.",
                    curr.ambient_light, curr.light_threshold);
                db_log_event("AUTO_SENSOR", "AUTO_ACTIVATE", detail, curr.ambient_light, "LOW_BEAM");
                printf("[C-LOGIC] %s\n", detail);
            }
        }
    }
    /* Condition 2: Daylight recovered (ambient >= threshold + 6.0% hysteresis) -> Deactivate Beams */
    else if (curr.ambient_light >= (curr.light_threshold + 6.0)) {
        if (strcmp(curr.mode, "LOW_BEAM") == 0 || strcmp(curr.mode, "HIGH_BEAM") == 0) {
            const char *target_mode = (strcmp(curr.environment, "DAYTIME") == 0) ? "OFF" : "PARKING";
            int target_power = (strcmp(target_mode, "OFF") == 0) ? 0 : 1;

            sqlite3_stmt *stmt;
            const char *sql = "UPDATE system_state SET mode = ?, power = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1;";
            if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) == SQLITE_OK) {
                sqlite3_bind_text(stmt, 1, target_mode, -1, SQLITE_STATIC);
                sqlite3_bind_int(stmt, 2, target_power);
                sqlite3_step(stmt);
                sqlite3_finalize(stmt);

                char detail[160];
                snprintf(detail, sizeof(detail),
                    "Sufficient ambient light detected (%.1f%% >= %.1f%%). Headlights automatically turned %s.",
                    curr.ambient_light, curr.light_threshold + 6.0, target_mode);
                db_log_event("AUTO_SENSOR", "AUTO_DEACTIVATE", detail, curr.ambient_light, target_mode);
                printf("[C-LOGIC] %s\n", detail);
            }
        }
    }
}

void sensor_simulation_tick(void) {
    sqlite3 *db = db_get_handle();
    if (!db) return;

    /* Add micro-jitter to electrical telemetry for real automotive dashboard feel */
    HeadlightSystemState curr;
    if (!headlights_get_state(&curr)) return;

    double v_jitter = 14.18 + ((rand() % 15) / 100.0); /* 14.18V - 14.33V alternator */
    double s_jitter = curr.speed;
    if (s_jitter > 5.0) {
        s_jitter += ((rand() % 10) - 5) / 10.0; /* +/- 0.5 km/h jitter */
    }

    sqlite3_stmt *stmt;
    const char *sql = "UPDATE system_state SET battery_voltage = ?, speed = ? WHERE id = 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_double(stmt, 1, v_jitter);
        sqlite3_bind_double(stmt, 2, s_jitter);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }
}

