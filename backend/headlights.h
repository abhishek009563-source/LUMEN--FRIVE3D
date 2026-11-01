#ifndef HEADLIGHTS_H
#define HEADLIGHTS_H

typedef struct {
    int power;                 /* 0 = System Master Off, 1 = On */
    char mode[32];             /* "OFF", "PARKING", "LOW_BEAM", "HIGH_BEAM" */
    int auto_mode;             /* 0 = Manual, 1 = Automatic (ALS Driven) */
    double ambient_light;      /* 0.0 to 100.0 % */
    double light_threshold;    /* 0.0 to 100.0 % (default 35.0%) */
    int left_indicator;        /* 0 or 1 */
    int right_indicator;       /* 0 or 1 */
    int hazard_lights;         /* 0 or 1 */
    char environment[32];      /* "DAYTIME", "EVENING", "NIGHT", "DARK_HIGHWAY" */
    double speed;              /* km/h */
    double battery_voltage;    /* Volts */
    char updated_at[64];
} HeadlightSystemState;

/* Retrieve current system state from SQLite */
int headlights_get_state(HeadlightSystemState *state);

/* Master power toggle: 1 = ON, 0 = OFF */
int headlights_set_power(int power);

/* Set lighting mode: "OFF", "PARKING", "LOW_BEAM", "HIGH_BEAM" */
int headlights_set_mode(const char *mode);

/* Set automatic mode: 1 = Automatic, 0 = Manual */
int headlights_set_auto(int auto_mode);

/* Set environment: "DAYTIME", "EVENING", "NIGHT", "DARK_HIGHWAY" */
int headlights_set_environment(const char *env);

/* Generate full status JSON for REST API */
char *headlights_get_status_json(void);

/* Generate JSON array of event logs from SQLite */
char *headlights_get_history_json(int limit);

#endif /* HEADLIGHTS_H */

