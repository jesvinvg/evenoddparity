/**
 * ============================================================================
 * Project: Even/Odd Parity Bit Generator & Checker
 * File: script.js
 * Purpose: UI Controller & DOM event management.
 * 
 * STRICT COMPLIANCE:
 * ALL core calculations (counting 1s, calculating parity, storing frames,
 * flipping bits, checking error parity) are executed strictly in C (parity.c)
 * via WebAssembly / C-mirror.
 * ============================================================================
 */

// C function bindings
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
const radioEven = document.getElementById('radio-even');
const radioOdd = document.getElementById('radio-odd');
const modeHint = document.getElementById('mode-hint');

const btnGenerateParity = document.getElementById('btn-generate-parity');
const btnSendFrame = document.getElementById('btn-send-frame');
const cardParityResult = document.getElementById('card-parity-result');
const valMessageOnes = document.getElementById('val-message-ones');
const valParityBit = document.getElementById('val-parity-bit');
const valSentFrameText = document.getElementById('val-sent-frame-text');

const panelSender = document.getElementById('panel-sender');
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
const truthTableCard = document.getElementById('truth-table-card');

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

  // Initialize initial message bits in C: [1, 0, 1, 1, 0, 1, 1, 1]
  if (c_set_bit) {
    const defaultBits = [1, 0, 1, 1, 0, 1, 1, 1];
    for (let i = 0; i < 8; i++) {
      c_set_bit(i, defaultBits[i]);
    }
  }

  highlightTruthTableRow();
  updateLiveTerminal();
}

/**
 * Set active step link in top navigation
 */
function setActiveStepNav(stepNum) {
  const stepLinks = document.querySelectorAll('.steps-nav .step-link');
  stepLinks.forEach(link => {
    const step = parseInt(link.getAttribute('data-step'), 10);
    if (step === stepNum) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Parity Mode Toggle (Even vs Odd)
 */
function setParityMode(mode) {
  currentMode = mode;
  if (mode === 0) {
    if (radioEven) radioEven.checked = true;
    if (modeHint) modeHint.textContent = 'Even parity : the total number of 1s in the 9-bit frame must be even.';
    if (valReceiverMode) valReceiverMode.textContent = 'Even Parity';
  } else {
    if (radioOdd) radioOdd.checked = true;
    if (modeHint) modeHint.textContent = 'Odd parity : the total number of 1s in the 9-bit frame must be odd.';
    if (valReceiverMode) valReceiverMode.textContent = 'Odd Parity';
  }

  invalidateGeneratedFrame();
  updateLiveTerminal();
}

/**
 * Invalidate downstream panels when input or mode changes
 */
function invalidateGeneratedFrame() {
  // Hide results section in Step 1
  if (cardParityResult) cardParityResult.classList.add('hidden');

  // Deactivate Step 2 and Step 3
  if (panelNoise) panelNoise.classList.add('panel-inactive');
  if (panelReceiver) panelReceiver.classList.add('panel-inactive');
  isFrameSent = false;
  isDelivered = false;

  setActiveStepNav(1);

  // Disable noise bit buttons
  for (let i = 0; i < 9; i++) {
    const btn = document.getElementById(`nbit-${i}`);
    if (btn) {
      btn.disabled = true;
      btn.classList.remove('bit-corrupted');
    }
  }
  if (btnResetNoise) btnResetNoise.disabled = true;
  if (btnDeliverReceiver) btnDeliverReceiver.disabled = true;

  // Reset noise alert
  if (noiseStatusAlert) {
    noiseStatusAlert.className = 'channel-status-line status-waiting';
  }
  if (noiseStatusText) {
    noiseStatusText.textContent = 'Waiting for frame from sender...';
  }

  // Clear receiver UI
  for (let i = 0; i < 9; i++) {
    const rbox = document.getElementById(`rbit-${i}`);
    if (rbox) {
      rbox.classList.remove('bit-corrupted');
    }
  }
  if (valReceiverOnes) valReceiverOnes.textContent = '-';
  if (receiverStatusCard) {
    receiverStatusCard.className = 'verdict-container status-awaiting';
  }
  if (valStatusTitle) valStatusTitle.textContent = 'AWAITING DELIVERY';
  if (valStatusDesc) {
    valStatusDesc.textContent = 'Complete Step 1 and Step 2 to verify data integrity.';
  }

  updateLiveTerminal();
}

/**
 * Toggle a message bit at index i (0 to 7) when rectangle is clicked
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

  // Update UI rectangle text
  btn.textContent = newVal;

  highlightTruthTableRow();
  invalidateGeneratedFrame();
}

/**
 * Step 1: Generate Parity Bit
 * Calculates parity and reveals results card with "Send 9-bit Frame" button
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
  if (valMessageOnes) valMessageOnes.textContent = `${onesCount} (${onesCountType})`;
  if (valParityBit) valParityBit.textContent = parityBit;
  if (valSentFrameText) valSentFrameText.textContent = frameValues.join('');

  // Reveal results box
  if (cardParityResult) cardParityResult.classList.remove('hidden');

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
      nbtn.classList.remove('bit-corrupted');
    }
  }

  // Activate Step 2 Panel
  if (panelNoise) panelNoise.classList.remove('panel-inactive');
  if (btnResetNoise) btnResetNoise.disabled = false;
  if (btnDeliverReceiver) btnDeliverReceiver.disabled = false;

  // Set clean channel alert
  if (noiseStatusAlert) noiseStatusAlert.className = 'channel-status-line';
  if (noiseStatusText) noiseStatusText.textContent = 'Frame loaded: Transmission is clean';

  setActiveStepNav(2);
  updateLiveTerminal();
}

/**
 * Step 2: Click any bit in Channel to simulate noise (flip bit)
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
      if (val !== sentFrameBaseline[i]) {
        btn.classList.add('bit-corrupted');
        corruptedCount++;
      } else {
        btn.classList.remove('bit-corrupted');
      }
    }
  }

  // Update status alert
  if (corruptedCount === 0) {
    if (noiseStatusAlert) noiseStatusAlert.className = 'channel-status-line';
    if (noiseStatusText) noiseStatusText.textContent = 'Frame loaded: Transmission is clean';
  } else if (corruptedCount === 1) {
    if (noiseStatusAlert) noiseStatusAlert.className = 'channel-status-line status-corrupted';
    if (noiseStatusText) noiseStatusText.textContent = '1 bit changed: Channel noise detected';
  } else {
    if (noiseStatusAlert) noiseStatusAlert.className = 'channel-status-line status-corrupted';
    if (noiseStatusText) noiseStatusText.textContent = `${corruptedCount} bits changed: Channel noise detected`;
  }

  // Dim receiver if it was previously evaluated
  if (isDelivered) {
    if (panelReceiver) panelReceiver.classList.add('panel-inactive');
    isDelivered = false;
  }

  updateLiveTerminal();
}

/**
 * Step 2: Reset Noise in Channel (Restore clean frame)
 */
function handleResetNoise() {
  if (!c_generate_parity || !c_get_frame || !isFrameSent) return;

  c_generate_parity(currentMode);

  for (let i = 0; i < 9; i++) {
    const bitVal = c_get_frame(i);
    const nbtn = document.getElementById(`nbit-${i}`);
    if (nbtn) {
      nbtn.textContent = bitVal;
      nbtn.classList.remove('bit-corrupted');
    }
  }

  if (noiseStatusAlert) noiseStatusAlert.className = 'channel-status-line';
  if (noiseStatusText) noiseStatusText.textContent = 'Frame loaded: Transmission is clean';

  if (isDelivered) {
    if (panelReceiver) panelReceiver.classList.add('panel-inactive');
    isDelivered = false;
  }

  updateLiveTerminal();
}

/**
 * Step 3: Deliver Frame to Receiver & Check Parity Rule
 */
function handleDeliverReceiver() {
  if (!panelReceiver || !c_get_frame || !c_count_frame_ones || !c_check_frame || !isFrameSent) return;

  isDelivered = true;
  panelReceiver.classList.remove('panel-inactive');
  setActiveStepNav(3);

  // Populate received 9 bits from C
  for (let i = 0; i < 9; i++) {
    const rcvVal = c_get_frame(i);
    const rbox = document.getElementById(`rbit-${i}`);
    if (rbox) {
      rbox.textContent = rcvVal;
      if (rcvVal !== sentFrameBaseline[i]) {
        rbox.classList.add('bit-corrupted');
      } else {
        rbox.classList.remove('bit-corrupted');
      }
    }
  }

  // Call C functions for verification
  const totalOnes = c_count_frame_ones();
  const isValid = c_check_frame(currentMode);

  // Update receiver metadata
  const modeName = currentMode === 0 ? 'Even' : 'Odd';
  const onesParityStr = totalOnes % 2 === 0 ? 'Even' : 'Odd';
  if (valReceiverMode) valReceiverMode.textContent = `${modeName} Parity`;
  if (valReceiverOnes) valReceiverOnes.textContent = `${totalOnes} (${onesParityStr})`;

  // Display status card matching screenshot exactly
  if (isValid === 1) {
    if (receiverStatusCard) receiverStatusCard.className = 'verdict-container status-valid';
    if (valStatusTitle) valStatusTitle.textContent = 'DATA VALID';
    if (valStatusDesc) {
      valStatusDesc.textContent = `The total number of 1s is ${onesParityStr.toLowerCase()}, so the parity rule is satisfied.`;
    }
  } else {
    if (receiverStatusCard) receiverStatusCard.className = 'verdict-container status-error';
    if (valStatusTitle) valStatusTitle.textContent = 'DATA CORRUPTED';
    if (valStatusDesc) {
      valStatusDesc.textContent = `The total number of 1s is ${onesParityStr.toLowerCase()}, which violates the ${modeName.toLowerCase()} parity rule. Error detected!`;
    }
  }

  updateLiveTerminal();
}

/**
 * Highlight Truth Table row matching first 3 bits
 */
function highlightTruthTableRow() {
  const bit0 = document.getElementById('sbit-0')?.textContent.trim() || '0';
  const bit1 = document.getElementById('sbit-1')?.textContent.trim() || '0';
  const bit2 = document.getElementById('sbit-2')?.textContent.trim() || '0';
  const key = `${bit0}${bit1}${bit2}`;

  const rows = document.querySelectorAll('.truth-table tbody tr');
  rows.forEach(row => {
    if (row.getAttribute('data-bits') === key) {
      row.classList.add('row-matched');
    } else {
      row.classList.remove('row-matched');
    }
  });
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
    }
  }

  setParityMode(0);
  highlightTruthTableRow();
  invalidateGeneratedFrame();
}

/**
 * Load Example Message: [1, 0, 1, 1, 0, 1, 1, 1]
 */
function handleLoadExample() {
  const example = [1, 0, 1, 1, 0, 1, 1, 1];

  for (let i = 0; i < 8; i++) {
    if (c_set_bit) c_set_bit(i, example[i]);
    const sbtn = document.getElementById(`sbit-${i}`);
    if (sbtn) {
      sbtn.textContent = example[i];
    }
  }

  setParityMode(0);
  highlightTruthTableRow();
  handleGenerateParity();
}

/**
 * Update the Live C Terminal Output
 */
function updateLiveTerminal() {
  if (!cConsoleOutput || !c_get_frame || !c_count_ones) return;

  const modeName = currentMode === 0 ? 'EVEN' : 'ODD';
  const onesMsg = c_count_ones();

  const currentBits = [];
  for (let i = 0; i < 8; i++) {
    const btn = document.getElementById(`sbit-${i}`);
    currentBits.push(btn ? btn.textContent.trim() : '0');
  }

  let text = `Even/Odd Parity Bit Generator & Checker\n---------------------------------------\n\n`;
  text += `1. Loading 8-Bit Message:\n`;
  text += `   bits = [ ${currentBits.join(' ')} ]\n`;
  text += `   Total 1s in message: ${onesMsg}\n\n`;

  if (isFrameSent || (cardParityResult && !cardParityResult.classList.contains('hidden'))) {
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
    text += `   Outcome: ${isValid === 1 ? 'DATA VALID (No errors detected)' : 'DATA CORRUPTED (Error detected)'}\n`;
  } else {
    text += `3. Receiver Check:\n`;
    text += `   AWAITING FRAME DELIVERY...\n`;
  }

  cConsoleOutput.textContent = text;
}

/**
 * Scroll reveal for Truth Table section
 */
function setupScrollReveal() {
  if (!truthTableCard) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        truthTableCard.classList.add('visible');
      }
    });
  }, {
    threshold: 0.15
  });

  observer.observe(truthTableCard);
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Radio buttons for Parity Mode
  if (radioEven) radioEven.addEventListener('change', () => setParityMode(0));
  if (radioOdd) radioOdd.addEventListener('change', () => setParityMode(1));

  // 8-bit Data boxes (0 to 7)
  for (let i = 0; i < 8; i++) {
    const btn = document.getElementById(`sbit-${i}`);
    if (btn) {
      btn.addEventListener('click', () => toggleMessageBit(i));
    }
  }

  // Step 1: Generate Parity & Send Frame
  if (btnGenerateParity) btnGenerateParity.addEventListener('click', handleGenerateParity);
  if (btnSendFrame) btnSendFrame.addEventListener('click', handleSendFrame);

  // Step 2: Noise bit clicks & actions
  for (let i = 0; i < 9; i++) {
    const nbtn = document.getElementById(`nbit-${i}`);
    if (nbtn) {
      nbtn.addEventListener('click', () => handleFlipBit(i));
    }
  }
  if (btnResetNoise) btnResetNoise.addEventListener('click', handleResetNoise);
  if (btnDeliverReceiver) btnDeliverReceiver.addEventListener('click', handleDeliverReceiver);

  // Top header actions
  if (btnResetAll) btnResetAll.addEventListener('click', handleResetAll);
  if (btnDemoExample) btnDemoExample.addEventListener('click', handleLoadExample);

  // Smooth scroll to top
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  setupScrollReveal();
}

// Bootstrap
function bootstrap() {
  initWasmBindings();
  setupEventListeners();
  // Keep generated frame hidden initially as requested by user
  // ("when clicked generate parity bit only then the mesage 1s count to send 9-bit frame appear")
  invalidateGeneratedFrame();
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
