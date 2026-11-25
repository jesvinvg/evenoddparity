/*
 * ============================================================================
 * Project: Even/Odd Parity Bit Generator & Checker
 * File: parity.c
 * Purpose: Core logic for 8-bit message parity generation, transmission frame
 *          construction, simulated noise (bit flipping), and receiver error
 *          detection using simple 1D integer arrays.
 * 
 * Works in:
 *   1. Code::Blocks / GCC (Console application with main function)
 *   2. Emscripten (Compiled to WebAssembly for browser execution)
 * ============================================================================
 */

#include <stdio.h>

/*
 * Data Structures:
 * - bits[8]: Holds the 8 message bits set by the sender (indices 0 to 7).
 * - frame[9]: Holds the 9-bit transmitted frame (indices 0 to 8).
 *             Indices 0 to 7 are the copied message bits.
 *             Index 8 is the calculated parity bit.
 */
int bits[8] = {0, 0, 0, 0, 0, 0, 0, 0};
int frame[9] = {0, 0, 0, 0, 0, 0, 0, 0, 0};

/*
 * Function: set_bit
 * Purpose: Stores a bit value (0 or 1) at a specific index in the message array.
 * Parameters:
 *   - i: index in bits array (0 to 7)
 *   - value: bit value (0 or 1)
 */
void set_bit(int i, int value) {
    if (i >= 0 && i < 8) {
        bits[i] = value;
    }
}

/*
 * Function: count_ones
 * Purpose: Counts and returns the total number of 1s in the 8-bit message array.
 * Returns: Number of 1s (0 to 8).
 */
int count_ones() {
    int count = 0;
    int i;
    for (i = 0; i < 8; i++) {
        if (bits[i] == 1) {
            count = count + 1;
        }
    }
    return count;
}

/*
 * Function: generate_parity
 * Purpose: Constructs the 9-bit frame from the message bits and calculates
 *          the parity bit based on the selected mode:
 *          - Mode 0 (Even Parity): Total 1s in 9-bit frame must be EVEN.
 *            If message 1s count is even, parity bit = 0.
 *            If message 1s count is odd, parity bit = 1.
 *          - Mode 1 (Odd Parity): Total 1s in 9-bit frame must be ODD.
 *            If message 1s count is even, parity bit = 1.
 *            If message 1s count is odd, parity bit = 0.
 * Parameters:
 *   - mode: 0 for Even Parity, 1 for Odd Parity
 * Returns: The calculated parity bit (0 or 1).
 */
int generate_parity(int mode) {
    int count;
    int parity;
    int i;

    /* Step 1: Copy 8 message bits into the first 8 slots of the frame */
    for (i = 0; i < 8; i++) {
        frame[i] = bits[i];
    }

    /* Step 2: Count the number of 1s in the original message */
    count = count_ones();

    /* Step 3: Determine the parity bit based on the mode */
    if (mode == 0) {
        /* Even Parity: make total 1s even */
        if (count % 2 == 0) {
            parity = 0;
        } else {
            parity = 1;
        }
    } else {
        /* Odd Parity: make total 1s odd */
        if (count % 2 == 0) {
            parity = 1;
        } else {
            parity = 0;
        }
    }

    /* Step 4: Store the parity bit at index 8 of the frame */
    frame[8] = parity;

    return parity;
}

/*
 * Function: get_frame
 * Purpose: Returns the bit value at index i of the 9-bit frame.
 * Parameters:
 *   - i: index in frame array (0 to 8)
 * Returns: Bit value (0 or 1), or -1 if index is invalid.
 */
int get_frame(int i) {
    if (i >= 0 && i < 9) {
        return frame[i];
    }
    return -1;
}

/*
 * Function: flip_bit
 * Purpose: Inverts (flips) the bit at index i in the frame (0 -> 1 or 1 -> 0)
 *          to simulate transmission noise in the communication channel.
 * Parameters:
 *   - i: index in frame array to flip (0 to 8)
 */
void flip_bit(int i) {
    if (i >= 0 && i < 9) {
        if (frame[i] == 1) {
            frame[i] = 0;
        } else {
            frame[i] = 1;
        }
    }
}

/*
 * Function: count_frame_ones
 * Purpose: Counts and returns the total number of 1s in all 9 bits of the frame
 *          at the receiver side.
 * Returns: Number of 1s (0 to 9).
 */
int count_frame_ones() {
    int count = 0;
    int i;
    for (i = 0; i < 9; i++) {
        if (frame[i] == 1) {
            count = count + 1;
        }
    }
    return count;
}

/*
 * Function: check_frame
 * Purpose: Receiver-side validation. Checks if the received 9-bit frame conforms
 *          to the expected parity rule (Even or Odd).
 * Parameters:
 *   - mode: 0 for Even Parity, 1 for Odd Parity
 * Returns:
 *   - 1 if parity check passes (DATA VALID)
 *   - 0 if parity check fails (ERROR DETECTED)
 */
int check_frame(int mode) {
    int count = count_frame_ones();

    if (mode == 0) {
        /* Even Parity: Total 1s must be even (divisible by 2) */
        if (count % 2 == 0) {
            return 1; /* Valid */
        } else {
            return 0; /* Error detected */
        }
    } else {
        /* Odd Parity: Total 1s must be odd (not divisible by 2) */
        if (count % 2 != 0) {
            return 1; /* Valid */
        } else {
            return 0; /* Error detected */
        }
    }
}

/*
 * Function: main
 * Purpose: Console test and demo entry point for running directly in Code::Blocks.
 *          Demonstrates message loading, parity generation, simulated transmission noise,
 *          and receiver-side error checking in the console output.
 */
int main() {
    int i;
    int parity;
    int is_valid;
    
    /* Sample message from assignment: 1, 0, 1, 1, 0, 0, 1, 0 */
    int sample[8] = {1, 0, 1, 1, 0, 0, 1, 0};

    printf("=====================================================\n");
    printf("  Even/Odd Parity Bit Generator & Checker (C Demo)   \n");
    printf("=====================================================\n\n");

    /* 1. Store message bits */
    printf("1. Loading 8-Bit Message:\n   bits = [ ");
    for (i = 0; i < 8; i++) {
        set_bit(i, sample[i]);
        printf("%d ", sample[i]);
    }
    printf("]\n");
    printf("   Total 1s in message: %d\n\n", count_ones());

    /* 2. Generate Even Parity */
    printf("2. Generating EVEN Parity (Mode 0):\n");
    parity = generate_parity(0);
    printf("   Calculated Parity Bit (frame[8]): %d\n", parity);
    printf("   Transmitted 9-Bit Frame: [ ");
    for (i = 0; i < 9; i++) {
        printf("%d ", get_frame(i));
    }
    printf("]\n");

    /* 3. Check clean frame */
    is_valid = check_frame(0);
    printf("   Receiver Check (Clean Channel): %s\n\n", 
           is_valid == 1 ? "DATA VALID (No errors)" : "ERROR DETECTED");

    /* 4. Simulate noise */
    printf("3. Simulating Channel Noise:\n");
    printf("   Flipping bit at index 2 (was %d)...\n", get_frame(2));
    flip_bit(2);
    printf("   Frame after noise: [ ");
    for (i = 0; i < 9; i++) {
        printf("%d ", get_frame(i));
    }
    printf("]\n");
    printf("   Total 1s in frame: %d\n", count_frame_ones());

    /* 5. Check corrupted frame */
    is_valid = check_frame(0);
    printf("   Receiver Check (Corrupted Channel): %s\n\n", 
           is_valid == 1 ? "DATA VALID" : "ERROR DETECTED (Data Corrupted)");

    /* 6. Odd Parity test */
    printf("4. Generating ODD Parity (Mode 1):\n");
    for (i = 0; i < 8; i++) {
        set_bit(i, sample[i]);
    }
    parity = generate_parity(1);
    printf("   Calculated Parity Bit (frame[8]): %d\n", parity);
    printf("   Transmitted 9-Bit Frame: [ ");
    for (i = 0; i < 9; i++) {
        printf("%d ", get_frame(i));
    }
    printf("]\n");
    is_valid = check_frame(1);
    printf("   Receiver Check: %s\n\n", 
           is_valid == 1 ? "DATA VALID (Odd parity matched)" : "ERROR DETECTED");

    printf("=====================================================\n");
    printf("All C functions executed successfully!\n");
    printf("=====================================================\n");

    return 0;
}
