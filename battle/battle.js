// Configuration
const CONFIG = {
  API_KEY: "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",
  ANALYSIS_PROMPT: `Analyze these food ingredients for healthiness. Consider:
  - Presence of harmful additives (artificial colors, preservatives, sweeteners)
  - Processing level (whole foods vs highly processed)
  - Nutrient density (vitamins, minerals, fiber)
  - Presence of allergens or common irritants
  - Sugar, salt, and unhealthy fat content
  
  Return JSON with these properties:
  - score (0-100, higher is better)
  - additives_count (number of artificial additives)
  - processing_level (1-5, 1=minimally processed, 5=ultra-processed)
  - nutrient_density (1-5, 5=most nutrient dense)
  - flagged_ingredients: [{name, reason, severity (1-3)}]
  - health_warnings: []
  - summary: "brief explanation of the score"
  
  Example response:
  {
    "score": 78,
    "additives_count": 2,
    "processing_level": 3,
    "nutrient_density": 4,
    "flagged_ingredients": [
      {"name": "high fructose corn syrup", "reason": "linked to obesity and diabetes", "severity": 2},
      {"name": "red 40", "reason": "artificial color linked to hyperactivity", "severity": 1}
    ],
    "health_warnings": ["contains common allergens: soy"],
    "summary": "Good nutrient density but contains some processed ingredients and additives"
  }`
};

// State
const state = {
  products: [{}, {}],
  cameras: [null, null],
  streams: [null, null],
  isProcessing: [false, false],
  currentManualInputIndex: null
};

// DOM Elements
const elements = {
  cameras: [document.getElementById('camera-1'), document.getElementById('camera-2')],
  canvases: [document.getElementById('canvas-1'), document.getElementById('canvas-2')],
  placeholders: [document.getElementById('placeholder-1'), document.getElementById('placeholder-2')],
  captureBtns: [document.getElementById('capture-btn-1'), document.getElementById('capture-btn-2')],
  manualBtns: [document.getElementById('manual-btn-1'), document.getElementById('manual-btn-2')],
  retryBtns: [document.getElementById('retry-btn-1'), document.getElementById('retry-btn-2')],
  resultsSection: document.getElementById('results-section'),
  backButton: document.getElementById('back-button'),
  newBattleBtn: document.getElementById('new-battle-btn'),
  manualModal: document.getElementById('manual-modal'),
  manualInput: document.getElementById('manual-input'),
  modalTitle: document.getElementById('modal-title'),
  cancelManual: document.getElementById('cancel-manual'),
  submitManual: document.getElementById('submit-manual')
};

// Initialize cameras
async function initCameras() {
  try {
    for (let i = 0; i < 2; i++) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      state.streams[i] = stream;
      state.cameras[i] = elements.cameras[i];
      elements.cameras[i].srcObject = stream;
    }
  } catch (error) {
    console.error("Camera error:", error);
    showError("Camera access is required for scanning. Please enable camera permissions.");
  }
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
  document.querySelector('.container').prepend(errorDiv);
}

// Show success message
function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
  document.querySelector('.container').prepend(successDiv);
  setTimeout(() => successDiv.remove(), 3000);
}

// Capture image from camera
function captureImage(index) {
  if (state.isProcessing[index]) return;
  
  const canvas = elements.canvases[index];
  const video = elements.cameras[index];
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  
  // Apply image processing to improve OCR
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const processedData = preprocessImage(imageData);
  ctx.putImageData(processedData, 0, 0);
  
  // Show canvas, hide video
  video.classList.add('hidden');
  canvas.classList.remove('hidden');
  elements.placeholders[index].classList.add('hidden');
  
  // Switch buttons
  elements.captureBtns[index].classList.add('hidden');
  elements.manualBtns[index].classList.add('hidden');
  elements.retryBtns[index].classList.remove('hidden');
  
  // Process image
  processCapturedImage(canvas, index);
}

// Image preprocessing for better OCR
function preprocessImage(imageData) {
  const data = imageData.data;
  
  // Convert to grayscale and enhance contrast
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    
    // Simple thresholding
    const threshold = 128;
    const value = avg > threshold ? 255 : 0;
    
    data[i] = value;     // R
    data[i + 1] = value; // G
    data[i + 2] = value; // B
  }
  
  return imageData;
}

// Open manual input modal
function openManualInput(index) {
  state.currentManualInputIndex = index;
  elements.modalTitle.textContent = `Enter Ingredients for Product ${index + 1}`;
  elements.manualInput.value = '';
  elements.manualModal.classList.remove('hidden');
}

// Submit manual input
function submitManualInput() {
  const index = state.currentManualInputIndex;
  const text = elements.manualInput.value.trim();
  
  if (!text) {
    showError("Please enter some ingredients");
    return;
  }
  
  elements.manualModal.classList.add('hidden');
  
  // Show canvas (for consistency), hide video
  elements.cameras[index].classList.add('hidden');
  elements.canvases[index].classList.remove('hidden');
  elements.placeholders[index].classList.add('hidden');
  
  // Switch buttons
  elements.captureBtns[index].classList.add('hidden');
  elements.manualBtns[index].classList.add('hidden');
  elements.retryBtns[index].classList.remove('hidden');
  
  // Process the manual input
  processManualInput(text, index);
}

// Process manual input
async function processManualInput(text, index) {
  try {
    state.isProcessing[index] = true;
    elements.retryBtns[index].innerHTML = '<i class="fas fa-spinner spinner"></i>';
    elements.retryBtns[index].disabled = true;
    
    showSuccess("Analyzing ingredients...");
    
    // Analyze with AI
    const analysis = await analyzeIngredients(text);
    state.products[index] = {
      ingredients: text,
      analysis
    };
    
    console.log(`Analysis for product ${index + 1}:`, analysis);
    
    // Check if both are done
    if (state.products[0].analysis && state.products[1].analysis) {
      showResults();
    }
  } catch (error) {
    console.error("Analysis error:", error);
    showError(`Analysis failed: ${error.message}`);
    retryCapture(index);
  } finally {
    state.isProcessing[index] = false;
    elements.retryBtns[index].innerHTML = '<i class="fas fa-sync-alt"></i>';
    elements.retryBtns[index].disabled = false;
  }
}

// Retry capture
function retryCapture(index) {
  const video = elements.cameras[index];
  const canvas = elements.canvases[index];
  
  // Show video, hide canvas
  video.classList.remove('hidden');
  canvas.classList.add('hidden');
  elements.placeholders[index].classList.remove('hidden');
  
  // Switch buttons
  elements.captureBtns[index].classList.remove('hidden');
  elements.manualBtns[index].classList.remove('hidden');
  elements.retryBtns[index].classList.add('hidden');
  
  // Clear previous data
  state.products[index] = {};
  state.isProcessing[index] = false;
}

// Process captured image
async function processCapturedImage(canvas, index) {
  try {
    state.isProcessing[index] = true;
    
    // Show processing state
    elements.retryBtns[index].innerHTML = '<i class="fas fa-spinner spinner"></i>';
    elements.retryBtns[index].disabled = true;
    
    // Extract text with Tesseract
    console.log(`Processing image ${index + 1}...`);
    showSuccess("Processing image... Please wait");
    
    // First try with default settings
    let { data: { text } } = await Tesseract.recognize(
      canvas,
      'eng',
      { 
        logger: m => console.log(m),
        tessedit_pageseg_mode: 6, // Assume a single uniform block of text
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789(),.-/ '
      }
    );
    
    // If we get very little text, try again with different settings
    if (text.split('\n').filter(line => line.trim().length > 3).length < 2) {
      console.log("First attempt failed, trying alternative OCR settings...");
      const retry = await Tesseract.recognize(
        canvas,
        'eng',
        {
          logger: m => console.log(m),
          tessedit_pageseg_mode: 11, // Sparse text with OSD
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789(),.-/ ',
          preserve_interword_spaces: '1'
        }
      );
      text = retry.data.text;
    }
    
    if (!text.trim()) {
      throw new Error("No text detected. Please try again with clearer image of the ingredients list or use manual input.");
    }
    
    console.log(`Extracted text for product ${index + 1}:`, text);
    showSuccess("Ingredients detected! Analyzing nutrition...");
    
    // Analyze with AI
    const analysis = await analyzeIngredients(text);
    state.products[index] = {
      ingredients: text,
      analysis
    };
    
    console.log(`Analysis for product ${index + 1}:`, analysis);
    
    // Check if both are done
    if (state.products[0].analysis && state.products[1].analysis) {
      showResults();
    }
  } catch (error) {
    console.error("Processing error:", error);
    showError(`Analysis failed: ${error.message}`);
    retryCapture(index);
  } finally {
    state.isProcessing[index] = false;
    elements.retryBtns[index].innerHTML = '<i class="fas fa-sync-alt"></i>';
    elements.retryBtns[index].disabled = false;
  }
}

// Analyze ingredients with AI
async function analyzeIngredients(ingredients) {
  try {
    // First clean the ingredients text
    const cleanedIngredients = cleanIngredientsText(ingredients);
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CONFIG.API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1:free",
        messages: [{
          role: "user",
          content: `${CONFIG.ANALYSIS_PROMPT}\n\nIngredients:\n${cleanedIngredients}\n\nReturn only valid JSON:`
        }],
        temperature: 0.2, // For more consistent results
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Try to parse the JSON response
    try {
      // Sometimes the API returns markdown with JSON inside
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}') + 1;
      const jsonString = content.slice(jsonStart, jsonEnd);
      
      const result = JSON.parse(jsonString);
      
      // Validate the response has required fields
      if (typeof result.score !== 'number' || !Array.isArray(result.flagged_ingredients)) {
        throw new Error("Invalid analysis format received from API");
      }
      
      return result;
    } catch (parseError) {
      console.error("Failed to parse API response:", parseError);
      throw new Error("Received invalid analysis data from API");
    }
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
}

// Clean ingredients text before sending to API
function cleanIngredientsText(text) {
  // Remove common OCR artifacts
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.match(/^[^a-zA-Z0-9]*$/)) // Remove lines without letters/numbers
    .filter(line => !line.match(/SCAN|INGREDIENTS|LIST/i)) // Remove common header text
    .join('\n');
}

// Show comparison results
function showResults() {
  const [product1, product2] = state.products;
  
  // Determine winner with a 5-point threshold to avoid ties
  let winner;
  const scoreDiff = product1.analysis.score - product2.analysis.score;
  
  if (Math.abs(scoreDiff) <= 5) {
    // Scores are too close to call
    document.getElementById('winner-text').textContent = "IT'S A TIE!";
  } else {
    winner = scoreDiff > 0 ? 1 : 2;
    document.getElementById('winner-text').textContent = `PRODUCT ${winner} WINS!`;
  }
  
  // Update scores with color coding
  updateScoreDisplay('score-1', product1.analysis.score);
  updateScoreDisplay('score-2', product2.analysis.score);
  
  // Update metric bars
  setMetricBar('additives', product1, product2);
  setMetricBar('processing', product1, product2);
  setMetricBar('nutrient', product1, product2);
  
  // Show flagged ingredients
  renderIngredients(1, product1);
  renderIngredients(2, product2);
  
  // Show results
  elements.resultsSection.classList.remove('hidden');
  
  // Scroll to results
  elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Update score display with color coding
function updateScoreDisplay(elementId, score) {
  const element = document.getElementById(elementId);
  element.textContent = `SCORE: ${Math.round(score)}/100`;
  
  // Color based on score
  if (score >= 80) {
    element.style.backgroundColor = '#E8F5E9';
    element.style.borderColor = '#4CAF50';
  } else if (score >= 60) {
    element.style.backgroundColor = '#FFF8E1';
    element.style.borderColor = '#FFC107';
  } else {
    element.style.backgroundColor = '#FFEBEE';
    element.style.borderColor = '#F44336';
  }
}

// Set metric bar values
function setMetricBar(type, p1, p2) {
  const types = {
    additives: {
      prop: 'additives_count',
      max: 10,
      colorGood: '#4CAF50',
      colorBad: '#F44336',
      reverse: true // Lower is better
    },
    processing: {
      prop: 'processing_level',
      max: 5,
      colorGood: '#4CAF50',
      colorBad: '#F44336',
      reverse: true // Lower is better
    },
    nutrient: {
      prop: 'nutrient_density',
      max: 5,
      colorGood: '#4CAF50',
      colorBad: '#F44336',
      reverse: false // Higher is better
    }
  };
  
  const config = types[type];
  let p1Value = p1.analysis[config.prop];
  let p2Value = p2.analysis[config.prop];
  
  // Calculate widths (0-100%)
  const p1Width = Math.min(100, (p1Value / config.max) * 100);
  const p2Width = Math.min(100, (p2Value / config.max) * 100);
  
  // Set colors - green if good, red if bad
  const p1Color = config.reverse ? 
    (p1Value <= 2 ? config.colorGood : p1Value <= 4 ? '#FFC107' : config.colorBad) :
    (p1Value >= 4 ? config.colorGood : p1Value >= 2 ? '#FFC107' : config.colorBad);
    
  const p2Color = config.reverse ? 
    (p2Value <= 2 ? config.colorGood : p2Value <= 4 ? '#FFC107' : config.colorBad) :
    (p2Value >= 4 ? config.colorGood : p2Value >= 2 ? '#FFC107' : config.colorBad);
  
  // Update bars
  document.getElementById(`${type}-bar-1`).style.setProperty('--width', `${p1Width}%`);
  document.getElementById(`${type}-bar-1`).style.setProperty('--color', p1Color);
  
  document.getElementById(`${type}-bar-2`).style.setProperty('--width', `${p2Width}%`);
  document.getElementById(`${type}-bar-2`).style.setProperty('--color', p2Color);
  
  // Add tooltips with values
  document.getElementById(`${type}-bar-1`).title = `${p1Value}/${config.max}`;
  document.getElementById(`${type}-bar-2`).title = `${p2Value}/${config.max}`;
}

// Render ingredients list
function renderIngredients(index, product) {
  const container = document.getElementById(`ingredients-${index}`);
  container.innerHTML = '';
  
  // Add summary if available
  if (product.analysis.summary) {
    const summary = document.createElement('div');
    summary.className = 'ingredient-item';
    summary.style.fontWeight = 'bold';
    summary.style.backgroundColor = '#E3F2FD';
    summary.style.borderLeftColor = '#2196F3';
    summary.textContent = product.analysis.summary;
    container.appendChild(summary);
  }
  
  // Add health warnings if any
  if (product.analysis.health_warnings && product.analysis.health_warnings.length > 0) {
    const warningHeader = document.createElement('div');
    warningHeader.className = 'ingredient-item';
    warningHeader.style.fontWeight = 'bold';
    warningHeader.textContent = '⚠️ Health Warnings:';
    container.appendChild(warningHeader);
    
    product.analysis.health_warnings.forEach(warning => {
      const warningItem = document.createElement('div');
      warningItem.className = 'ingredient-item bad';
      warningItem.textContent = warning;
      container.appendChild(warningItem);
    });
  }
  
  // Split ingredients and flag bad ones
  const ingredients = product.ingredients.split('\n')
    .filter(line => line.trim().length > 0);
  
  if (ingredients.length === 0) {
    const noIngredients = document.createElement('div');
    noIngredients.className = 'ingredient-item';
    noIngredients.textContent = 'No ingredients detected';
    container.appendChild(noIngredients);
    return;
  }
  
  const ingredientHeader = document.createElement('div');
  ingredientHeader.className = 'ingredient-item';
  ingredientHeader.style.fontWeight = 'bold';
  ingredientHeader.textContent = 'Ingredients:';
  container.appendChild(ingredientHeader);
  
  ingredients.forEach(ing => {
    const cleanIng = ing.trim();
    if (!cleanIng) return;
    
    const isFlagged = product.analysis.flagged_ingredients.some(
      item => cleanIng.toLowerCase().includes(item.name.toLowerCase())
    );
    
    const item = document.createElement('div');
    item.className = `ingredient-item ${isFlagged ? 'bad' : 'good'}`;
    item.textContent = cleanIng;
    
    if (isFlagged) {
      const flaggedIng = product.analysis.flagged_ingredients.find(
        item => cleanIng.toLowerCase().includes(item.name.toLowerCase())
      );
      
      // Add severity indicator (more ! for worse ingredients)
      const severity = flaggedIng.severity || 1;
      const severityIndicators = '!'.repeat(severity);
      
      item.textContent = `${cleanIng} ${severityIndicators}`;
      item.title = flaggedIng.reason;
      
      // Make more severe items stand out more
      if (severity >= 2) {
        item.style.fontWeight = 'bold';
      }
      if (severity >= 3) {
        item.style.backgroundColor = '#FFCDD2';
      }
    }
    
    container.appendChild(item);
  });
}

// Reset for new battle
function resetBattle() {
  // Stop camera streams
  state.streams.forEach(stream => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  });
  
  // Reset state
  state.products = [{}, {}];
  state.streams = [null, null];
  state.cameras = [null, null];
  state.isProcessing = [false, false];
  
  // Reset UI
  elements.resultsSection.classList.add('hidden');
  elements.cameras.forEach((cam, i) => {
    cam.classList.remove('hidden');
    elements.canvases[i].classList.add('hidden');
    elements.placeholders[i].classList.remove('hidden');
    elements.captureBtns[i].classList.remove('hidden');
    elements.manualBtns[i].classList.remove('hidden');
    elements.retryBtns[i].classList.add('hidden');
    elements.retryBtns[i].innerHTML = '<i class="fas fa-sync-alt"></i>';
    elements.retryBtns[i].disabled = false;
  });
  
  // Clear any error messages
  const errorMessages = document.querySelectorAll('.error-message, .success-message');
  errorMessages.forEach(el => el.remove());
  
  // Reinitialize
  initCameras();
}

// Event Listeners
function setupEventListeners() {
  // Capture buttons
  elements.captureBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => captureImage(i));
  });

  elements.backButton.addEventListener('click', () => {
    
    state.streams.forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });
    
    // Navigate back (you can replace this with your actual navigation logic)
    window.location.href = '/index.html'; // Change to your home page URL
  });
  
  
  // Manual input buttons
  elements.manualBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => openManualInput(i));
  });
  
  // Retry buttons
  elements.retryBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => retryCapture(i));
  });
  
  // New battle button
  elements.newBattleBtn.addEventListener('click', resetBattle);
  
  // Manual input modal
  elements.cancelManual.addEventListener('click', () => {
    elements.manualModal.classList.add('hidden');
  });
  
  elements.submitManual.addEventListener('click', submitManualInput);
  
  // Allow submitting with Enter key
  elements.manualInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitManualInput();
    }
  });
}

// Initialize
async function init() {
  try {
    // Load Tesseract.js first
    console.log("Loading Tesseract.js...");
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });
    
    console.log("Initializing cameras...");
    await initCameras();
    setupEventListeners();
    console.log("App initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
    showError(`Failed to initialize app: ${error.message}`);
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);