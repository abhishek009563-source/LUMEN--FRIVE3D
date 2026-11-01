CC ?= gcc
CFLAGS = -O2 -Wall -Wextra -std=c99 -DSQLITE_THREADSAFE=0 -DMG_ENABLE_LINES=1 -I.
LDFLAGS = 

ifeq ($(OS),Windows_NT)
    TARGET = server.exe
    LDFLAGS += -lws2_32
else
    TARGET = server
    LDFLAGS += -lpthread -ldl
endif

OBJS = main.o server.o database.o headlights.o sensor.o indicators.o mongoose.o sqlite3.o

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(OBJS) $(LDFLAGS) -o $(TARGET)
	@echo [SUCCESS] Headlight Simulator C Backend built: $(TARGET)

main.o: main.c database.h server.h headlights.h sensor.h
	$(CC) $(CFLAGS) -c main.c -o main.o

server.o: server.c server.h headlights.h sensor.h indicators.h database.h mongoose.h
	$(CC) $(CFLAGS) -c server.c -o server.o

database.o: database.c database.h sqlite3.h
	$(CC) $(CFLAGS) -c database.c -o database.o

headlights.o: headlights.c headlights.h database.h sensor.h
	$(CC) $(CFLAGS) -c headlights.c -o headlights.o

sensor.o: sensor.c sensor.h headlights.h database.h
	$(CC) $(CFLAGS) -c sensor.c -o sensor.o

indicators.o: indicators.c indicators.h headlights.h database.h
	$(CC) $(CFLAGS) -c indicators.c -o indicators.o

mongoose.o: mongoose.c mongoose.h
	$(CC) $(CFLAGS) -c mongoose.c -o mongoose.o

sqlite3.o: sqlite3.c sqlite3.h
	$(CC) $(CFLAGS) -c sqlite3.c -o sqlite3.o

clean:
	rm -f $(OBJS) $(TARGET)

