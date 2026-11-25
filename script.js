/**
 * ============================================================================
 * Project: Even/Odd Parity Bit Generator & Checker
 * File: script.js
 * Purpose: UI Controller & DOM event management.
 * 
 * STRICT COMPLIANCE:
 * ALL core calculations (counting 1s, calculating parity, storing frames,
 * flipping bits, checking error parity) are executed strictly in C (parity.c)
 * via WebAssembly. JavaScript only coordinates UI events and displays results.
 * ============================================================================
 */

// C function bindings (populated via Module.cwrap)
let c_set_bit = null;
let c_count_ones = null;
let c_generate_parity = null;
let c_get_frame = null;
let c_flip_bit = null;
let c_check_frame = null;
let c_count_frame_ones = null;

// UI State tracking
let currentMode = 0; // 0 = Even Parity, 1 = Odd Parity
let sentFrameBaseline = [0, 0, 0, 0, 0, 0, 0, 0, 0];
let isFrameSent = false;
let isDelivered = false;

// DOM Elements
const btnModeEven = document.getElementById('btn-mode-even');
const btnModeOdd = document.getElementById('btn-mode-odd');
const modeHint = document.getElementById('mode-hint');

const btnGenerateParity = document.getElementById('btn-generate-parity');
const btnSendFrame = document.getElementById('btn-send-frame');
const cardParityResult = document.getElementById('card-parity-result');
const valMessageOnes = document.getElementById('val-message-ones');
const valParityBit = document.getElementById('val-parity-bit');
const valSentFrameText = document.getElementById('val-sent-frame-text');

const panelNoise = document.getElementById('panel-noise');
const noiseStatusAlert = document.getElementById('noise-status-alert');
const noiseStatusText = document.getElementById('noise-status-text');
const btnResetNoise = document.getElementById('btn-reset-noise');
const btnDeliverReceiver = document.getElementById('btn-deliver-receiver');

const panelReceiver = document.getElementById('panel-receiver');
const valReceiverMode = document.getElementById('val-receiver-mode');
const valReceiverOnes = document.getElementById('val-receiver-ones');
const receiverStatusCard = document.getElementById('receiver-status-card');
const valStatusTitle = document.getElementById('val-status-title');
const valStatusDesc = document.getElementById('val-status-desc');

const btnResetAll = document.getElementById('btn-reset-all');
const btnDemoExample = document.getElementById('btn-demo-example');
const cConsoleOutput = document.getElementById('c-console-output');

/**
 * Initialize WebAssembly C function wrappers
 */
function initWasmBindings() {
  if (typeof Module !== 'undefined' && typeof Module.cwrap === 'function') {
    c_set_bit = Module.cwrap('set_bit', null, ['number', 'number']);
    c_count_ones = Module.cwrap('count_ones', 'number', []);
    c_generate_parity = Module.cwrap('generate_parity', 'number', ['number']);
    c_get_frame = Module.cwrap('get_frame', 'number', ['number']);
    c_flip_bit = Module.cwrap('flip_bit', null, ['number']);
    c_check_frame = Module.cwrap('check_frame', 'number', ['number']);
    c_count_frame_ones = Module.cwrap('count_frame_ones', 'number', []);
  } else if (typeof Module !== 'undefined' && typeof Module.set_bit === 'function') {
    c_set_bit = Module.set_bit;
    c_count_ones = Module.count_ones;
    c_generate_parity = Module.generate_parity;
    c_get_frame = Module.get_frame;
    c_flip_bit = Module.flip_bit;
    c_check_frame = Module.check_frame;
    c_count_frame_ones = Module.count_frame_ones;
  }

  // Initialize initial message bits to match default UI: [1, 0, 1, 1, 0, 1, 1, 1]
  if (c_set_bit) {
    const defaultBits = [1, 0, 1, 1, 0, 1, 1, 1];
    for (let i = 0; i < 8; i++) {
      c_set_bit(i, defaultBits[i]);
    }
  }

  updateLiveTerminal();
}

/**
 * Parity Mode Toggle (Even vs Odd)
 */
function setParityMode(mode) {
  currentMode = mode;
  if (mode === 0) {
    btnModeEven.classList.add('active');
    btnModeOdd.classList.remove('active');
    modeHint.textContent = 'Even: Total 1s in the 9-bit frame must be even.';
    valReceiverMode.textContent = 'Even Parity';
  } else {
    btnModeOdd.classList.add('active');
    btnModeEven.classList.remove('active');
    modeHint.textContent = 'Odd: Total 1s in the 9-bit frame must be odd.';
    valReceiverMode.textContent = 'Odd Parity';
  }

  invalidateGeneratedFrame();
  updateLiveTerminal();
}

/**
 * Invalidate downstream panels when input or mode changes
 */
function invalidateGeneratedFrame() {
  cardParityResult.classList.add('hidden');
  panelNoise.classList.add('panel-dimmed');
  panelReceiver.classList.add('panel-dimmed');
  isFrameSent = false;
  isDelivered = false;

  // Disable noise bit buttons
  for (let i = 0; i < 9; i++) {
    const btn = document.getElementById(`nbit-${i}`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = '0';
      btn.className = 'bit-button';
    }
  }
  btnResetNoise.disabled = true;
  btnDeliverReceiver.disabled = true;

  // Reset noise alert
  noiseStatusAlert.className = 'channel-status-banner status-waiting';
  noiseStatusText.textContent = 'Waiting for a frame from the sender.';

  // Clear receiver UI
  for (let i = 0; i < 9; i++) {
    const rbox = document.getElementById(`rbit-${i}`);
    if (rbox) {
      rbox.textContent = '-';
      rbox.className = 'bit-button bit-static';
    }
  }
  valReceiverOnes.textContent = '-';
  receiverStatusCard.className = 'receiver-status-card status-awaiting';
  valStatusTitle.textContent = 'AWAITING DELIVERY';
  valStatusDesc.textContent = 'Complete Step 1 and Step 2 to verify data integrity.';

  updateLiveTerminal();
}

/**
 * Toggle a message bit at index i (0 to 7)
 */
function toggleMessageBit(index) {
  const btn = document.getElementById(`sbit-${index}`);
  if (!btn) return;

  const currentVal = parseInt(btn.textContent.trim(), 10) || 0;
  const newVal = currentVal === 0 ? 1 : 0;

  // Store bit in C array
  if (c_set_bit) {
    c_set_bit(index, newVal);
  }

  // Update UI button appearance
  btn.textContent = newVal;
  if (newVal === 1) {
    btn.classList.add('bit-active');
  } else {
    btn.classList.remove('bit-active');
  }

  invalidateGeneratedFrame();
  updateLiveTerminal();
}

/**
 * Step 1: Generate Parity Bit
 * Calls C functions to construct frame and compute parity
 */
function handleGenerateParity() {
  if (!c_generate_parity || !c_count_ones || !c_get_frame) {
    initWasmBindings();
  }

  // Call C function generate_parity(mode)
  const parityBit = c_generate_parity(currentMode);

  // Call C function count_ones()
  const onesCount = c_count_ones();

  // Read frame bits directly from C using get_frame(i)
  const frameValues = [];
  for (let i = 0; i < 9; i++) {
    frameValues.push(c_get_frame(i));
  }

  // Update UI with C results
  const onesCountType = onesCount % 2 === 0 ? 'Even' : 'Odd';
  valMessageOnes.textContent = `${onesCount} (${onesCountType})`;
  valParityBit.textContent = parityBit;
  valSentFrameText.textContent = `[ ${frameValues.join(', ')} ]`;

  // Reveal results card
  cardParityResult.classList.remove('hidden');

  updateLiveTerminal();
}

/**
 * Step 2: Send 9-Bit Frame to Noise Simulator
 */
function handleSendFrame() {
  isFrameSent = true;

  // Read 9 frame bits from C and populate Step 2
  for (let i = 0; i < 9; i++) {
    const bitVal = c_get_frame(i);
    sentFrameBaseline[i] = bitVal;

    const nbtn = document.getElementById(`nbit-${i}`);
    if (nbtn) {
      nbtn.textContent = bitVal;
      nbtn.disabled = false;
      nbtn.className = 'bit-button';
      if (bitVal === 1) {
        nbtn.classList.add('bit-active');
      }
    }
  }

  // Activate Panel 2
  panelNoise.classList.remove('panel-dimmed');
  btnResetNoise.disabled = false;
  btnDeliverReceiver.disabled = false;

  // Set clean channel alert
  noiseStatusAlert.className = 'channel-status-banner status-clean';
  noiseStatusText.textContent = 'Frame loaded into channel. Transmission is clean.';

  updateLiveTerminal();
}

/**
 * Step 2: Click a bit in Channel to simulate noise (flip bit)
 * Calls C function flip_bit(i)
 */
function handleFlipBit(index) {
  if (!c_flip_bit || !c_get_frame || !isFrameSent) return;

  // Call C to flip the bit
  c_flip_bit(index);

  // Read updated bit value from C
  const updatedVal = c_get_frame(index);

  // Update this bit's UI
  const nbtn = document.getElementById(`nbit-${index}`);
  if (nbtn) {
    nbtn.textContent = updatedVal;
  }

  // Check how many bits are currently corrupted in the channel
  let corruptedCount = 0;
  for (let i = 0; i < 9; i++) {
    const val = c_get_frame(i);
    const btn = document.getElementById(`nbit-${i}`);
    if (btn) {
      btn.className = 'bit-button';
      if (val === 1) btn.classList.add('bit-active');
      if (val !== sentFrameBaseline[i]) {
        btn.classList.add('bit-corrupted');
        corruptedCount++;
      }
    }
  }

  // Update status banner matching screenshots exactly
  if (corruptedCount === 0) {
    noiseStatusAlert.className = 'channel-status-banner status-clean';
    noiseStatusText.textContent = 'Frame loaded into channel. Transmission is clean.';
  } else if (corruptedCount === 1) {
    noiseStatusAlert.className = 'channel-status-banner status-corrupted';
    noiseStatusText.textContent = '1 bit changed: Channel noise detected';
  } else {
    noiseStatusAlert.className = 'channel-status-banner status-corrupted';
    noiseStatusText.textContent = `${corruptedCount} bits changed: Channel noise detected`;
  }

  // Dim receiver if it was previously evaluated
  if (isDelivered) {
    panelReceiver.classList.add('panel-dimmed');
    isDelivered = false;
  }

  updateLiveTerminal();
}

/**
 * Step 2: Reset Noise in Channel (Clean Frame)
 * Calls C function generate_parity(currentMode) to restore clean frame in C
 */
function handleResetNoise() {
  if (!c_generate_parity || !c_get_frame || !isFrameSent) return;

  c_generate_parity(currentMode);

  for (let i = 0; i < 9; i++) {
    const bitVal = c_get_frame(i);
    const nbtn = document.getElementById(`nbit-${i}`);
    if (nbtn) {
      nbtn.textContent = bitVal;
      nbtn.className = 'bit-button';
      if (bitVal === 1) {
        nbtn.classList.add('bit-active');
      }
    }
  }

  noiseStatusAlert.className = 'channel-status-banner status-clean';
  noiseStatusText.textContent = 'Frame loaded into channel. Transmission is clean.';

  if (isDelivered) {
    panelReceiver.classList.add('panel-dimmed');
    isDelivered = false;
  }

  updateLiveTerminal();
}

/**
 * Step 3: Deliver Frame to Receiver & Check Parity Rule
 * Calls C function check_frame(mode) and count_frame_ones()
 */
function handleDeliverReceiver() {
  if (!panelReceiver || !c_get_frame || !c_count_frame_ones || !c_check_frame || !isFrameSent) return;

  isDelivered = true;
  panelReceiver.classList.remove('panel-dimmed');

  // Populate received 9 bits from C
  for (let i = 0; i < 9; i++) {
    const rcvVal = c_get_frame(i);
    const rbox = document.getElementById(`rbit-${i}`);
    if (rbox) {
      rbox.textContent = rcvVal;
      rbox.className = 'bit-button bit-static';
      if (rcvVal === 1) {
        rbox.classList.add('bit-active');
      }
      if (rcvVal !== sentFrameBaseline[i]) {
        rbox.classList.add('bit-corrupted');
      }
    }
  }

  // Call C functions for verification
  const totalOnes = c_count_frame_ones();
  const isValid = c_check_frame(currentMode);

  // Update 1s count
  const onesParityStr = totalOnes % 2 === 0 ? 'Even' : 'Odd';
  valReceiverOnes.textContent = `${totalOnes} (${onesParityStr})`;

  // Display status card matching screenshots exactly
  const modeName = currentMode === 0 ? 'Even' : 'Odd';
  if (isValid === 1) {
    receiverStatusCard.className = 'receiver-status-card status-valid';
    valStatusTitle.textContent = 'DATA VALID';
    valStatusDesc.textContent = `Parity rule verified. Total 1s (${totalOnes}) satisfies the ${modeName} Parity rule.`;
  } else {
    receiverStatusCard.className = 'receiver-status-card status-error';
    valStatusTitle.textContent = 'ERROR DETECTED';
    valStatusDesc.textContent = `Parity mismatch. The delivered frame does not satisfy the ${modeName} Parity rule.`;
  }

  updateLiveTerminal();
}

/**
 * Reset All (Clears everything back to initial state)
 */
function handleResetAll() {
  if (c_set_bit) {
    for (let i = 0; i < 8; i++) {
      c_set_bit(i, 0);
    }
  }
  if (c_generate_parity) {
    c_generate_parity(0);
  }

  // Reset UI message bits to 0
  for (let i = 0; i < 8; i++) {
    const sbtn = document.getElementById(`sbit-${i}`);
    if (sbtn) {
      sbtn.textContent = '0';
      sbtn.classList.remove('bit-active');
    }
  }

  setParityMode(0);
  invalidateGeneratedFrame();
}

/**
 * Load Example Message from screenshots: [1, 0, 1, 1, 0, 1, 1, 1]
 */
function handleLoadExample() {
  const example = [1, 0, 1, 1, 0, 1, 1, 1];

  for (let i = 0; i < 8; i++) {
    if (c_set_bit) c_set_bit(i, example[i]);
    const sbtn = document.getElementById(`sbit-${i}`);
    if (sbtn) {
      sbtn.textContent = example[i];
      if (example[i] === 1) {
        sbtn.classList.add('bit-active');
      } else {
        sbtn.classList.remove('bit-active');
      }
    }
  }

  setParityMode(0); // Even Parity
  handleGenerateParity();
}

/**
 * Update the Live C Terminal Output
 */
function updateLiveTerminal() {
  if (!cConsoleOutput || !c_get_frame || !c_count_ones) return;

  const modeName = currentMode === 0 ? 'EVEN' : 'ODD';
  const onesMsg = c_count_ones();

  // Read current message bits
  const currentBits = [];
  for (let i = 0; i < 8; i++) {
    const btn = document.getElementById(`sbit-${i}`);
    currentBits.push(btn ? btn.textContent.trim() : '0');
  }

  let text = `Even/Odd Parity Bit Generator & Checker\n---------------------------------------\n\n`;
  text += `1. Loading 8-Bit Message:\n`;
  text += `   bits = [ ${currentBits.join(' ')} ]\n`;
  text += `   Total 1s in message: ${onesMsg}\n\n`;

  if (isFrameSent || !cardParityResult.classList.contains('hidden')) {
    const parityBit = valParityBit ? valParityBit.textContent.trim() : '0';
    text += `2. Generating ${modeName} Parity:\n`;
    text += `   Calculated Parity Bit: ${parityBit}\n`;
    text += `   9-Bit Frame: [ ${sentFrameBaseline.join(', ')} ]\n\n`;
  } else {
    text += `2. Generating ${modeName} Parity:\n`;
    text += `   AWAITING PARITY GENERATION...\n\n`;
  }

  if (isDelivered) {
    const totalOnes = c_count_frame_ones();
    const isValid = c_check_frame(currentMode);
    text += `3. Receiver Check:\n`;
    text += `   Received Frame: [ `;
    const rcvArr = [];
    for (let i = 0; i < 9; i++) rcvArr.push(c_get_frame(i));
    text += `${rcvArr.join(', ')} ]\n`;
    text += `   Total 1s: ${totalOnes}\n`;
    text += `   Outcome: ${isValid === 1 ? 'DATA VALID (No errors detected)' : 'ERROR DETECTED (Data Corrupted)'}\n`;
  } else {
    text += `3. Receiver Check:\n`;
    text += `   AWAITING FRAME DELIVERY...\n`;
  }

  cConsoleOutput.textContent = text;
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Parity mode buttons
  if (btnModeEven) btnModeEven.addEventListener('click', () => setParityMode(0));
  if (btnModeOdd) btnModeOdd.addEventListener('click', () => setParityMode(1));

  // Sender bit boxes (0 to 7)
  for (let i = 0; i < 8; i++) {
    const btn = document.getElementById(`sbit-${i}`);
    if (btn) {
      btn.addEventListener('click', () => toggleMessageBit(i));
    }
  }

  // Step 1 buttons
  if (btnGenerateParity) btnGenerateParity.addEventListener('click', handleGenerateParity);
  if (btnSendFrame) btnSendFrame.addEventListener('click', handleSendFrame);

  // Step 2 buttons
  for (let i = 0; i < 9; i++) {
    const nbtn = document.getElementById(`nbit-${i}`);
    if (nbtn) {
      nbtn.addEventListener('click', () => handleFlipBit(i));
    }
  }
  if (btnResetNoise) btnResetNoise.addEventListener('click', handleResetNoise);
  if (btnDeliverReceiver) btnDeliverReceiver.addEventListener('click', handleDeliverReceiver);

  // Top action buttons
  if (btnResetAll) btnResetAll.addEventListener('click', handleResetAll);
  if (btnDemoExample) btnDemoExample.addEventListener('click', handleLoadExample);

  // Back to top smooth scroll
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

// Bootstrap
function bootstrap() {
  initWasmBindings();
  setupEventListeners();
  // Automatically generate parity for default initial state [1,0,1,1,0,1,1,1]
  handleGenerateParity();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

if (typeof Module !== 'undefined') {
  const prevInit = Module.onRuntimeInitialized;
  Module.onRuntimeInitialized = function() {
    if (typeof prevInit === 'function') prevInit();
    initWasmBindings();
  };
}
