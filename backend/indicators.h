#ifndef INDICATORS_H
#define INDICATORS_H

/* Set indicator state with automotive safety interlock rules */
/* type: "LEFT", "RIGHT", "HAZARD", "CANCEL" */
/* state: 1 = Active, 0 = Inactive */
int indicators_set(const char *type, int state);

/* Retrieve current indicator states */
int indicators_get_state(int *left, int *right, int *hazard);

#endif /* INDICATORS_H */

