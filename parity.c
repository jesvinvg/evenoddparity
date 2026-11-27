#include <stdio.h>

int bits[8] = {0};
int frame[9] = {0};

/* Set message bit at index i (0 to 7) */
void set_bit(int i, int value) {
    if (i >= 0 && i < 8) {
        bits[i] = value;
    }
}

/* Count number of 1s in 8-bit message */
int count_ones() {
    int count = 0;
    for (int i = 0; i < 8; i++) {
        if (bits[i] == 1) count++;
    }
    return count;
}

/* Generate parity bit and construct 9-bit frame (mode: 0 = Even, 1 = Odd) */
int generate_parity(int mode) {
    for (int i = 0; i < 8; i++) {
        frame[i] = bits[i];
    }

    int count = count_ones();
    int parity = 0;

    if (mode == 0) {
        parity = (count % 2 == 0) ? 0 : 1; /* Even Parity */
    } else {
        parity = (count % 2 == 0) ? 1 : 0; /* Odd Parity */
    }

    frame[8] = parity;
    return parity;
}

/* Get bit at index i (0 to 8) from frame */
int get_frame(int i) {
    if (i >= 0 && i < 9) return frame[i];
    return -1;
}

/* Flip bit at index i to simulate noise */
void flip_bit(int i) {
    if (i >= 0 && i < 9) {
        frame[i] = (frame[i] == 1) ? 0 : 1;
    }
}

/* Count number of 1s in 9-bit frame */
int count_frame_ones() {
    int count = 0;
    for (int i = 0; i < 9; i++) {
        if (frame[i] == 1) count++;
    }
    return count;
}

/* Check frame validity (returns 1 for valid, 0 for error) */
int check_frame(int mode) {
    int count = count_frame_ones();
    if (mode == 0) {
        return (count % 2 == 0) ? 1 : 0;
    } else {
        return (count % 2 != 0) ? 1 : 0;
    }
}

int main() {
    /* Sample 8-bit data: 1 0 1 1 0 1 1 1 */
    int sample[8] = {1, 0, 1, 1, 0, 1, 1, 1};
    for (int i = 0; i < 8; i++) {
        set_bit(i, sample[i]);
    }

    printf("8-Bit Message: ");
    for (int i = 0; i < 8; i++) printf("%d ", bits[i]);
    printf("\nTotal 1s: %d\n", count_ones());

    /* Even Parity (mode = 0) */
    int p = generate_parity(0);
    printf("Even Parity Bit: %d\n", p);
    printf("Sent Frame: ");
    for (int i = 0; i < 9; i++) printf("%d ", frame[i]);
    printf("\nCheck (clean): %s\n", check_frame(0) ? "DATA VALID" : "ERROR DETECTED");

    /* Simulate noise on bit 2 */
    printf("\nSimulating noise on bit 2...\n");
    flip_bit(2);
    printf("Corrupted Frame: ");
    for (int i = 0; i < 9; i++) printf("%d ", frame[i]);
    printf("\nCheck (corrupted): %s\n", check_frame(0) ? "DATA VALID" : "ERROR DETECTED");

    return 0;
}
