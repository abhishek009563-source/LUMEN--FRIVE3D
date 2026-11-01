#include "database.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static sqlite3 *s_db = NULL;

int db_init(const char *db_path) {
    if (s_db != NULL) {
        return 1;
    }

    int rc = sqlite3_open(db_path, &s_db);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[DB ERROR] Failed to open SQLite database '%s': %s\n", db_path, sqlite3_errmsg(s_db));
        if (s_db) {
            sqlite3_close(s_db);
            s_db = NULL;
        }
        return 0;
    }

    /* Enable WAL mode for high concurrency and performance */
    sqlite3_exec(s_db, "PRAGMA journal_mode = WAL;", NULL, NULL, NULL);
    sqlite3_exec(s_db, "PRAGMA synchronous = NORMAL;", NULL, NULL, NULL);

    /* 1. Create system_state table */
    const char *create_state_sql =
        "CREATE TABLE IF NOT EXISTS system_state ("
        "  id INTEGER PRIMARY KEY CHECK (id = 1),"
        "  power INTEGER NOT NULL DEFAULT 1,"
        "  mode TEXT NOT NULL DEFAULT 'LOW_BEAM',"
        "  auto_mode INTEGER NOT NULL DEFAULT 1,"
        "  ambient_light REAL NOT NULL DEFAULT 25.0,"
        "  light_threshold REAL NOT NULL DEFAULT 35.0,"
        "  left_indicator INTEGER NOT NULL DEFAULT 0,"
        "  right_indicator INTEGER NOT NULL DEFAULT 0,"
        "  hazard_lights INTEGER NOT NULL DEFAULT 0,"
        "  environment TEXT NOT NULL DEFAULT 'NIGHT',"
        "  speed REAL NOT NULL DEFAULT 48.0,"
        "  battery_voltage REAL NOT NULL DEFAULT 14.2,"
        "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"
        ");";

    char *err_msg = NULL;
    rc = sqlite3_exec(s_db, create_state_sql, NULL, NULL, &err_msg);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[DB ERROR] Failed to create system_state table: %s\n", err_msg);
        sqlite3_free(err_msg);
        return 0;
    }

    /* 2. Create event_logs table */
    const char *create_logs_sql =
        "CREATE TABLE IF NOT EXISTS event_logs ("
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "  timestamp DATETIME DEFAULT (datetime('now', 'localtime')),"
        "  source TEXT NOT NULL,"
        "  action TEXT NOT NULL,"
        "  details TEXT,"
        "  ambient_light REAL,"
        "  headlight_state TEXT"
        ");";

    rc = sqlite3_exec(s_db, create_logs_sql, NULL, NULL, &err_msg);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[DB ERROR] Failed to create event_logs table: %s\n", err_msg);
        sqlite3_free(err_msg);
        return 0;
    }

    /* Ensure initial record exists in system_state */
    const char *seed_state_sql =
        "INSERT OR IGNORE INTO system_state (id, power, mode, auto_mode, ambient_light, light_threshold, "
        "left_indicator, right_indicator, hazard_lights, environment, speed, battery_voltage) "
        "VALUES (1, 1, 'LOW_BEAM', 1, 25.0, 35.0, 0, 0, 0, 'NIGHT', 48.0, 14.2);";
    sqlite3_exec(s_db, seed_state_sql, NULL, NULL, NULL);

    /* Check if event logs need baseline entries */
    sqlite3_stmt *stmt;
    int count = 0;
    if (sqlite3_prepare_v2(s_db, "SELECT COUNT(*) FROM event_logs;", -1, &stmt, NULL) == SQLITE_OK) {
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            count = sqlite3_column_int(stmt, 0);
        }
        sqlite3_finalize(stmt);
    }

    if (count == 0) {
        db_log_event("SYSTEM", "INITIALIZATION", "Headlight Control Unit booted in Night mode", 25.0, "LOW_BEAM");
        db_log_event("AUTO_SENSOR", "AUTO_ACTIVATE", "Ambient light below 35.0% threshold. Low beams engaged.", 25.0, "LOW_BEAM");
    }

    printf("[DB] SQLite database initialized successfully: %s\n", db_path);
    return 1;
}

void db_close(void) {
    if (s_db) {
        sqlite3_close(s_db);
        s_db = NULL;
        printf("[DB] SQLite database connection closed.\n");
    }
}

sqlite3 *db_get_handle(void) {
    return s_db;
}

int db_log_event(const char *source, const char *action, const char *details, double ambient_light, const char *headlight_state) {
    if (!s_db) return 0;

    sqlite3_stmt *stmt;
    const char *sql = "INSERT INTO event_logs (source, action, details, ambient_light, headlight_state) VALUES (?, ?, ?, ?, ?);";

    if (sqlite3_prepare_v2(s_db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }

    sqlite3_bind_text(stmt, 1, source ? source : "SYSTEM", -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 2, action ? action : "EVENT", -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 3, details ? details : "", -1, SQLITE_STATIC);
    sqlite3_bind_double(stmt, 4, ambient_light);
    sqlite3_bind_text(stmt, 5, headlight_state ? headlight_state : "UNKNOWN", -1, SQLITE_STATIC);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    return (rc == SQLITE_DONE);
}

