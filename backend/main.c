#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <time.h>
#include "database.h"
#include "server.h"
#include "headlights.h"
#include "sensor.h"

#ifdef _WIN32
    #include <windows.h>
#else
    #include <unistd.h>
#endif

static volatile int s_running = 1;

static void sig_handler(int sig) {
    (void)sig;
    s_running = 0;
}

int main(int argc, char *argv[]) {
    signal(SIGINT, sig_handler);
    signal(SIGTERM, sig_handler);
    srand((unsigned int)time(NULL));

    const char *port = "8001";
    const char *db_path = "../database/headlights.db";
    const char *static_dir = "../frontend";

    /* Allow running directly from root folder */
    FILE *f_check = fopen("frontend/index.html", "r");
    if (f_check) {
        fclose(f_check);
        static_dir = "frontend";
        db_path = "database/headlights.db";
    }

    if (argc > 1) port = argv[1];
    if (argc > 2) static_dir = argv[2];
    if (argc > 3) db_path = argv[3];

    printf("\n[BOOT] Initializing 3D Vehicle Headlight Control Simulator...\n");

    /* 1. Initialize SQLite Database */
    if (!db_init(db_path)) {
        fprintf(stderr, "[FATAL] Unable to open or initialize SQLite database at '%s'\n", db_path);
        return 1;
    }

    /* 2. Initialize Mongoose HTTP Server */
    if (!server_init(port, static_dir)) {
        fprintf(stderr, "[FATAL] Unable to bind Mongoose HTTP server on port %s\n", port);
        db_close();
        return 1;
    }

    int tick_count = 0;

    /* 3. Server Poll & Autonomous Control Loop */
    while (s_running) {
        server_poll(100); /* 100ms timeout per poll */

        tick_count++;
        /* Every 1.5 seconds (15 ticks * 100ms) */
        if (tick_count >= 15) {
            sensor_simulation_tick();
            sensor_process_auto_logic();
            tick_count = 0;
        }
    }

    printf("\n[SHUTDOWN] Gracefully stopping simulator...\n");
    server_cleanup();
    db_close();
    printf("[SHUTDOWN] All services terminated safely.\n");

    return 0;
}

