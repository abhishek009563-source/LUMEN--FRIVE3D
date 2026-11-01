#ifndef SERVER_H
#define SERVER_H

#include "mongoose.h"

/* Initialize Mongoose HTTP Server on specified port and serve static_dir */
int server_init(const char *port, const char *static_dir);

/* Single iteration of network event polling loop */
void server_poll(int timeout_ms);

/* Stop server and clean up resources */
void server_cleanup(void);

#endif /* SERVER_H */

