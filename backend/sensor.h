#ifndef SENSOR_H
#define SENSOR_H

/* Set simulated ambient light sensor reading (0.0 to 100.0 %) */
int sensor_set_light_level(double lux_percent);

/* Configure automatic lighting threshold (5.0 to 90.0 %) */
int sensor_set_threshold(double threshold_percent);

/* Core C decision engine: evaluates ALS reading against threshold & toggles headlights */
void sensor_process_auto_logic(void);

/* Real-time background simulation step for electronic sensors & telemetry */
void sensor_simulation_tick(void);

#endif /* SENSOR_H */

