#include "indicators.h"
#include "headlights.h"
#include "database.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int indicators_set(const char *type, int state) {
    if (!type) return 0;

    sqlite3 *db = db_get_handle();
    if (!db) return 0;

    HeadlightSystemState curr;
    if (!headlights_get_state(&curr)) return 0;

    int new_left = curr.left_indicator;
    int new_right = curr.right_indicator;
    int new_hazard = curr.hazard_lights;
    char action_name[64];
    char detail_msg[128];

    if (strcmp(type, "LEFT") == 0) {
        if (state) {
            new_left = 1;
            new_right = 0; /* Safety interlock: left cancels right */
            new_hazard = 0;
            strcpy(action_name, "INDICATOR_LEFT_ON");
            strcpy(detail_msg, "Left turn signal flasher activated");
        } else {
            new_left = 0;
            strcpy(action_name, "INDICATOR_LEFT_OFF");
            strcpy(detail_msg, "Left turn signal cancelled");
        }
    } else if (strcmp(type, "RIGHT") == 0) {
        if (state) {
            new_right = 1;
            new_left = 0; /* Safety interlock: right cancels left */
            new_hazard = 0;
            strcpy(action_name, "INDICATOR_RIGHT_ON");
            strcpy(detail_msg, "Right turn signal flasher activated");
        } else {
            new_right = 0;
            strcpy(action_name, "INDICATOR_RIGHT_OFF");
            strcpy(detail_msg, "Right turn signal cancelled");
        }
    } else if (strcmp(type, "HAZARD") == 0) {
        if (state) {
            new_hazard = 1;
            new_left = 1;
            new_right = 1;
            strcpy(action_name, "HAZARD_ON");
            strcpy(detail_msg, "Emergency hazard warning flasher engaged");
        } else {
            new_hazard = 0;
            new_left = 0;
            new_right = 0;
            strcpy(action_name, "HAZARD_OFF");
            strcpy(detail_msg, "Emergency hazard warning flasher disengaged");
        }
    } else if (strcmp(type, "CANCEL") == 0) {
        new_left = 0;
        new_right = 0;
        new_hazard = 0;
        strcpy(action_name, "INDICATORS_CANCEL");
        strcpy(detail_msg, "All turn signals and flashers deactivated");
    } else {
        return 0; /* Unknown indicator type */
    }

    sqlite3_stmt *stmt;
    const char *sql = "UPDATE system_state SET left_indicator = ?, right_indicator = ?, hazard_lights = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }

    sqlite3_bind_int(stmt, 1, new_left);
    sqlite3_bind_int(stmt, 2, new_right);
    sqlite3_bind_int(stmt, 3, new_hazard);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    db_log_event("USER", action_name, detail_msg, curr.ambient_light, curr.mode);
    printf("[INDICATOR] %s\n", detail_msg);

    return 1;
}

int indicators_get_state(int *left, int *right, int *hazard) {
    HeadlightSystemState curr;
    if (!headlights_get_state(&curr)) return 0;

    if (left) *left = curr.left_indicator;
    if (right) *right = curr.right_indicator;
    if (hazard) *hazard = curr.hazard_lights;

    return 1;
}

