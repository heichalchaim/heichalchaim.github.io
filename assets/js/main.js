// --- Configuration ---
// DEPLOYED WEB APP URL - this should point to your Google Apps Script Web App
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwfeuyVub7ew6i4KFN7sHiYhjRBY_BL1QDfg1Uha-CFaS6zOPFrHi5V2T08Vp7l7zD_/exec';
const updateInterval = 60 * 1000;

// --- DOM Elements ---
const mainGrid = document.getElementById('mainGrid');

// --- Global State ---
let currentData = null; // To store the currently displayed data

// --- Constants ---
const CARD_TYPES = {
  TIMES: 'זמני היום',
  MESSAGES: 'הודעות'
};

const COLUMN_SPANS = {
  COMPACT: 4,
  REGULAR: 5
};

// Add these constants for configurable font size limits
const MIN_FONT_SIZE = 8; // Minimum font size
const MAX_FONT_SIZE = 72; // Maximum font size
const FONT_STEP = 0.5; // Step size for binary search
const PORTRAIT_FONT_SIZE = 18; // Fixed reasonable font size for portrait mode

// --- Functions ---
function displayError(message) {
    console.error('Error fetching or displaying data:', message);
    return null;
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  mainGrid.innerHTML = '';
  mainGrid.appendChild(errorDiv);
}

// --- Data Fetching ---
async function fetchData() {
    if (!WEB_APP_URL || WEB_APP_URL === 'YOUR_DEPLOYED_WEB_APP_URL_GOES_HERE') {
        return displayError("יש להגדיר את כתובת ה-Web App בקובץ get-sheet.js");
    }

    try {
        // Add cache-busting query parameter
        const cacheBuster = new Date().getTime();
        const url = `${WEB_APP_URL}?cb=${cacheBuster}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            mode: 'cors' // This is needed for cross-origin requests
        });
        
        if (!response.ok) {
            // Try to get error text from response if possible
            let errorText = `HTTP שגיאה ${response.status}`;
            try {
                const errorBody = await response.text();
                errorText += `: ${errorBody}`;
            } catch (e) { /* Ignore if cannot read body */ }
            throw new Error(errorText);
        }
        
        const data = await response.json();
        
        // Handle potential error object from GAS
        if (data.error) {
            return displayError(data.error);
        }
        
        // Return data for processing by main.js
        return data;
    } catch (error) {
        return displayError(error.message || 'לא ניתן היה לטעון את הנתונים.');
    }
}

function renderSchedules(data) {
  mainGrid.innerHTML = '';
  const spans = calculateGrid(data);

  // Sort data to ensure "הודעות" is rightmost and "זמני היום" is leftmost
  const sortedData = [...data].sort((a, b) => {
    if (a.title === 'הודעות') return -1; // "הודעות" comes first (rightmost in RTL)
    if (b.title === 'הודעות') return 1;
    if (a.title === 'זמני היום') return 1; // "זמני היום" comes last (leftmost in RTL)
    if (b.title === 'זמני היום') return -1;
    return 0; // Keep original order for other items
  });

  sortedData.forEach(schedule => {
    const card = document.createElement('div');
    const isCompact = isCompactCard(schedule.title);
    const isMessages = schedule.type === 'messages';

    card.className = `card ${isCompact ? 'compact' : ''} ${isMessages ? 'messages' : ''}`;

    // Only apply grid-column span on desktop
    if (!isPortrait()) {
      card.style.gridColumn = `span ${isCompact ? spans.COMPACT : spans.REGULAR}`;
    }

    if (isMessages) {
      card.innerHTML = `
        <div class="card-header">${schedule.title}</div>
        <div class="card-body">
          ${schedule.messages.map(msg => `<div class="row">${msg}</div>`).join('')}
        </div>`;
    } else {
      card.innerHTML = `
        <div class="card-header">${schedule.title}</div>
        <div class="card-body">
          ${schedule.items.map(item => `
            <div class="row">
              <span class="label">${item.label}</span>
              <span class="value">${item.value}</span>
            </div>`).join('')}
        </div>`;
    }

    mainGrid.appendChild(card);
  });
}

// --- Utility Functions ---
function isCompactCard(title) {
  return title === CARD_TYPES.TIMES || title === CARD_TYPES.MESSAGES;
}

function isPortrait() {
  return window.innerWidth < window.innerHeight;
}

function updateClock() {
  const now = new Date();
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
  document.getElementById('clock').textContent = time;
}

// --- Layout and Responsive Design ---

function setFontSize(size) {
  document.documentElement.style.setProperty('--base-font-size', `${size}px`);
  const minisize = size * 0.7;
  const compactSize = Math.round(minisize);
  document.documentElement.style.setProperty('--compact-font-size', `${compactSize}px`);
}

// --- Set up the grid to fill available space ---
function setupGrid(data) {
  // Calculate available height
  const headerHeight = document.querySelector('.header').offsetHeight;
  const footerHeight = document.querySelector('.footer').offsetHeight;
  const availableHeight = window.innerHeight - headerHeight - footerHeight;
  
  // Set grid height to fill available space
  mainGrid.style.height = `${availableHeight}px`;
  mainGrid.style.maxHeight = `${availableHeight}px`;
  
  // Set up columns based on orientation
  if (isPortrait()) {
    // For portrait: use fixed font size and simple layout
    setFontSize(PORTRAIT_FONT_SIZE);
    mainGrid.style.gridTemplateColumns = '1fr';
    mainGrid.style.display = 'flex';
    mainGrid.style.flexDirection = 'column';
    mainGrid.classList.add('mobile-grid');
    return COLUMN_SPANS;
  } else {
    // For landscape: proceed with dynamic grid layout
    const compactCount = data.filter(card => isCompactCard(card.title)).length;
    const regularCount = data.length - compactCount;
    const totalCols = (compactCount * COLUMN_SPANS.COMPACT) + (regularCount * COLUMN_SPANS.REGULAR);
    
    mainGrid.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;
    mainGrid.style.display = 'grid';
    mainGrid.classList.remove('mobile-grid');
    return COLUMN_SPANS;
  }
}

// --- Binary search for optimal font size (landscape only) ---
function findOptimalFontSize() {
  // Skip if in portrait mode
  if (isPortrait()) {
    return;
  }
  
  // Apply visibility:hidden to prevent flickering during calculations
  mainGrid.style.visibility = 'hidden';
  
  let min = MIN_FONT_SIZE;
  let max = MAX_FONT_SIZE;
  let current = Math.floor((min + max) / 2);
  let iterations = 0;
  const maxIterations = 20; // Prevent infinite loops
  let foundSize = null;

  
  function tryFontSize(size) {
    setFontSize(size);
    return !checkForOverflow();
  }
  
  // Start binary search
  while (max - min > FONT_STEP && iterations < maxIterations) {
    iterations++;
    
    if (tryFontSize(current)) {
      // Current size works, try larger
      min = current;
      foundSize = current; // Keep track of last successful size
    } else {
      // Current size is too big, try smaller
      max = current;
    }
    
    current = (min + max) / 2;
  }
  
  // Apply the final size all at once
  if (foundSize === null || !tryFontSize(current)) {
    // If no size or current size still causes overflow, use the minimum successful size
    setFontSize(min);
  }
  
  // Make visible again with the final size applied
  mainGrid.style.visibility = 'visible';
  
  // Debug output
  console.log(`Optimal font size found: ${parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-font-size'))}`);
}

// --- Check if any element has overflow ---
function checkForOverflow() {
  // Check if grid has vertical overflow
  if (mainGrid.scrollHeight > mainGrid.clientHeight) {
    return true;
  }
  
  // Check each row for text overflow
  const rows = document.querySelectorAll('.row');
  for (const row of rows) {
    const label = row.querySelector('.label');
    const value = row.querySelector('.value');
    
    if ((label && label.scrollWidth > label.clientWidth) ||
        (value && value.scrollWidth > value.clientWidth)) {
      return true;
    }
  }
  
  // Check card headers for overflow
  const headers = document.querySelectorAll('.card-header');
  for (const header of headers) {
    if (header.scrollWidth > header.clientWidth) {
      return true;
    }
  }
  
  return false;
}

// Cache for previously calculated font sizes
const fontSizeCache = {
  // Format: 'width-height-cardCount': fontSize
};

// --- Main function to optimize grid and font ---
function optimizeDisplay(data) {
  // First set up the grid
  const spans = setupGrid(data);
  
  // If in landscape mode, proceed with font optimization
  if (!isPortrait()) {
    // Try to use cached font size first
    const cacheKey = `${window.innerWidth}-${window.innerHeight}-${data.length}`;
    const cachedSize = fontSizeCache[cacheKey];
    
    if (cachedSize) {
      // Use cached size immediately to prevent flickering
      setFontSize(cachedSize);
      console.log(`Using cached font size: ${cachedSize}px`);
    } else {
      // Hide content during calculation
      mainGrid.style.visibility = 'hidden';
      
      // Give the DOM time to update before checking font size
      setTimeout(() => {
        // Set initial font size
        setFontSize(MAX_FONT_SIZE);
        
        // After DOM updates, find optimal font size
        setTimeout(() => {
          findOptimalFontSize();
          
          // Cache the result for future use
          const newSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-font-size'));
          fontSizeCache[cacheKey] = newSize;
        }, 50);
      }, 50);
    }
  }
  
  return spans;
}

// --- Replace the old functions ---
function calculateGrid(data) {
  return optimizeDisplay(data);
}

// --- Debounce function to prevent multiple resize calculations ---
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// --- Update the resize handler with debouncing ---
window.addEventListener('resize', debounce(() => {
  if (mainGrid.hasChildNodes() && currentData) {
    // Check if orientation changed (more significant than just slight resize)
    const wasPortrait = mainGrid.classList.contains('mobile-grid');
    const isNowPortrait = isPortrait();
    
    if (wasPortrait !== isNowPortrait || Math.abs(window.innerWidth - lastWidth) > 100) {
      optimizeDisplay(currentData);
      
      // Update card spans
      const cards = mainGrid.querySelectorAll('.card');
      
      cards.forEach(card => {
        if (isNowPortrait) {
          card.style.gridColumn = '';
        } else {
          const isCompact = card.classList.contains('compact');
          const span = isCompact ? COLUMN_SPANS.COMPACT : COLUMN_SPANS.REGULAR;
          card.style.gridColumn = `span ${span}`;
        }
      });
      
      // Store current width for future comparison
      lastWidth = window.innerWidth;
    }
  }
}, 150)); // 150ms debounce time

// Track window width to detect significant changes
let lastWidth = window.innerWidth;

// --- Data Update Check ---
async function checkForUpdates() {
  console.log("Checking for data updates..."); // Optional: for debugging
  try {
    const newData = await fetchData();

    // Check if fetch was successful and if data actually changed
    if (newData && JSON.stringify(newData) !== JSON.stringify(currentData)) {
      console.log("Data changed, updating display."); // Optional: for debugging
      currentData = newData; // Update the current data state
      renderSchedules(currentData); // Re-render the grid with new data
    } else if (!newData) {
        console.warn("Failed to fetch updates or received null data.");
    } else {
          console.log("No data changes detected."); // Optional: for debugging
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
    // Optionally show a non-intrusive error indicator if needed
  }
}

// --- Initialization ---
window.onload = async () => {
  try {
    setInterval(updateClock, 1000);
    updateClock();
  
    // Show loading indicator
    mainGrid.innerHTML = '<div class="loading">טוען נתונים...</div>';

    // Load initial data using fetchData
    const initialData = await fetchData();
    if (initialData) {
      currentData = initialData; // Store the initial data
      renderSchedules(currentData);
      // Start checking for updates AFTER initial load
      setInterval(checkForUpdates, updateInterval); 
    } else {
      showError('לא התקבלו נתונים');
    }
  } catch (error) {
    showError('Error loading data: ' + error.message);
  }
};