#ifndef DATABASE_H
#define DATABASE_H

#include "sqlite3.h"

/* Initialize SQLite database and tables */
int db_init(const char *db_path);

/* Close database connection */
void db_close(void);

/* Get current active SQLite database handle */
sqlite3 *db_get_handle(void);

/* Log an event into the SQLite event_logs table */
int db_log_event(const char *source, const char *action, const char *details, double ambient_light, const char *headlight_state);

#endif /* DATABASE_H */

