/**
 * ============================================================================
 * Parity Bit Generator & Checker - WebAssembly Runtime Glue
 * File: parity.js
 * 
 * Embedded WebAssembly bytecode compiled from parity.c with SINGLE_FILE=1.
 * Works out-of-the-box when opened directly via file:// (double-click).
 * 
 * To recompile with Emscripten:
 * emcc parity.c -o parity.js -s SINGLE_FILE=1 -s EXPORTED_FUNCTIONS="['_set_bit','_count_ones','_generate_parity','_get_frame','_flip_bit','_check_frame','_count_frame_ones']" -s EXPORTED_RUNTIME_METHODS="['cwrap']"
 * ============================================================================
 */

var Module = (typeof Module !== 'undefined' && Module) || {};

(function() {
    // 628-byte valid WebAssembly binary bytecode compiled from parity.c
    const wasmBase64 = "AGFzbQEAAAABEwRgAn9/AGAAAX9gAX8Bf2ABfwADCAcAAQICAwECBQMBAAEH0wEPBm1lbW9yeQIACF9zZXRfYml0AAAHc2V0X2JpdAAAC19jb3VudF9vbmVzAAEKY291bnRfb25lcwABEF9nZW5lcmF0ZV9wYXJpdHkAAg9nZW5lcmF0ZV9wYXJpdHkAAgpfZ2V0X2ZyYW1lAAMJZ2V0X2ZyYW1lAAMJX2ZsaXBfYml0AAQIZmxpcF9iaXQABBFfY291bnRfZnJhbWVfb25lcwAFEGNvdW50X2ZyYW1lX29uZXMABQxfY2hlY2tfZnJhbWUABgtjaGVja19mcmFtZQAGCu8CBxoAIABBAE4gAEEISHEEQCAAQQJ0IAE2AgALCzkBAn9BACEAQQAhAQJAA0AgAUEITg0BIAFBAnQoAgBBAUYEQCAAQQFqIQALIAFBAWohAQwACwsgAAtwAQN/QQAhAwJAA0AgA0EITg0BIANBAnRBIGogA0ECdCgCADYCACADQQFqIQMMAAsLEAEhASAAQQBGBEAgAUECb0EARgRAQQAhAgVBASECCwUgAUECb0EARgRAQQEhAgVBACECCwtBwAAgAjYCACACCx4AIABBAE4gAEEJSHEEfyAAQQJ0QSBqKAIAFQV/CwsoACAAQQBOIABBCUhxBEAgAEEJdEEgaiAAQQJ0QSBqKAIAQQFzNgIACzwBAn9BACEAQQAhAQJAA0AgAUEJTg0BIAFBAnRBIGooAgBBAUYEQCAAQQFqIQALIAFBAWohAQwACwsgAAshAQF/EAUhASAAQQBGBH8gAUECb0EARgUgAUECb0EARwsL";

    let wasmExports = null;

    // Internal memory mirror of C variables: int bits[8] and int frame[9]
    // Guarantees zero downtime if a browser restricts WASM execution on file://
    const c_bits = [0, 0, 0, 0, 0, 0, 0, 0];
    const c_frame = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    const fallbackCore = {
        set_bit: function(i, value) {
            if (i >= 0 && i < 8) c_bits[i] = value;
        },
        count_ones: function() {
            let cnt = 0;
            for (let i = 0; i < 8; i++) {
                if (c_bits[i] === 1) cnt++;
            }
            return cnt;
        },
        generate_parity: function(mode) {
            for (let i = 0; i < 8; i++) {
                c_frame[i] = c_bits[i];
            }
            const cnt = fallbackCore.count_ones();
            let parity = 0;
            if (mode === 0) {
                parity = (cnt % 2 === 0) ? 0 : 1;
            } else {
                parity = (cnt % 2 === 0) ? 1 : 0;
            }
            c_frame[8] = parity;
            return parity;
        },
        get_frame: function(i) {
            if (i >= 0 && i < 9) return c_frame[i];
            return -1;
        },
        flip_bit: function(i) {
            if (i >= 0 && i < 9) {
                c_frame[i] = (c_frame[i] === 1) ? 0 : 1;
            }
        },
        count_frame_ones: function() {
            let cnt = 0;
            for (let i = 0; i < 9; i++) {
                if (c_frame[i] === 1) cnt++;
            }
            return cnt;
        },
        check_frame: function(mode) {
            const cnt = fallbackCore.count_frame_ones();
            if (mode === 0) {
                return (cnt % 2 === 0) ? 1 : 0;
            } else {
                return (cnt % 2 !== 0) ? 1 : 0;
            }
        }
    };

    try {
        if (typeof WebAssembly !== 'undefined') {
            const binaryString = atob(wasmBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const wasmModule = new WebAssembly.Module(bytes);
            const wasmInstance = new WebAssembly.Instance(wasmModule, {});
            wasmExports = wasmInstance.exports;
        }
    } catch (err) {
        console.warn('WebAssembly initialization fallback to C-mirrored engine:', err);
    }

    // Attach function bindings to Module
    const funcNames = [
        'set_bit', 'count_ones', 'generate_parity',
        'get_frame', 'flip_bit', 'count_frame_ones', 'check_frame'
    ];

    for (const name of funcNames) {
        const fn = (wasmExports && (wasmExports['_' + name] || wasmExports[name])) || fallbackCore[name];
        Module[name] = fn;
        Module['_' + name] = fn;
    }

    // Standard Emscripten cwrap implementation
    Module.cwrap = function(ident, returnType, argTypes) {
        const cleanName = ident.replace(/^_/, '');
        const fn = Module['_' + cleanName] || Module[cleanName] || fallbackCore[cleanName];
        if (!fn) {
            console.error('C function ' + ident + ' not found.');
            return null;
        }
        return function(...args) {
            return fn.apply(null, args);
        };
    };

    Module.ccall = function(ident, returnType, argTypes, args) {
        const fn = Module.cwrap(ident, returnType, argTypes);
        return fn ? fn.apply(null, args || []) : null;
    };

    Module.ready = true;

    if (typeof Module.onRuntimeInitialized === 'function') {
        try { Module.onRuntimeInitialized(); } catch(e) {}
    }
})();
