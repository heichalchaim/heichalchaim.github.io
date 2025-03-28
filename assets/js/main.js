// --- Configuration ---
// DEPLOYED WEB APP URL - this should point to your Google Apps Script Web App
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzbyYfR6VFdL5l0Epzz4vCBtwqPQkb2OUbCx9R1Cdw8qqP5snOvuS0ugbIRQqZ0_tw0Vw/exec';
const updateInterval = 1000;//5 * 60 * 1000;

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
const MAX_FONT_SIZE = 256; // Maximum font size

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

// --- Rendering Functions ---
function renderData(data) {
    // Clear loading message
    contentDiv.innerHTML = '';

    if (!data || data.length === 0) {
        contentDiv.innerHTML = '<p>אין נתונים להצגה כרגע.</p>';
        return;
    }

    // Handle potential error object from GAS
    if (data.error) {
         displayError(data.error);
         return;
    }

    data.forEach(section => {
        const sectionDiv = document.createElement('div');

        if (section.type === 'messages') {
            sectionDiv.className = 'messages-section';
            const titleElement = document.createElement('h2');
            titleElement.textContent = section.title;
            sectionDiv.appendChild(titleElement);

            const list = document.createElement('ul');
            section.messages.forEach(msg => {
                const listItem = document.createElement('li');
                // Assuming messages don't contain HTML. If they might, sanitize before setting innerHTML.
                listItem.textContent = msg;
                list.appendChild(listItem);
            });
            sectionDiv.appendChild(list);

        } else if (section.type === 'schedule') {
            sectionDiv.className = 'schedule-section';
            const titleElement = document.createElement('h2');
            titleElement.textContent = section.title;
            sectionDiv.appendChild(titleElement);

            const list = document.createElement('ul');
            section.items.forEach(item => {
                const listItem = document.createElement('li');
                const labelSpan = document.createElement('span');
                labelSpan.className = 'label';
                labelSpan.textContent = item.label + ':'; // Add colon after label

                const valueSpan = document.createElement('span');
                valueSpan.className = 'value';
                // Use innerHTML carefully - assumes formatValue in GAS creates safe HTML (like <strong>)
                // If values could contain malicious HTML, sanitize it here!
                valueSpan.innerHTML = item.value; // Use innerHTML to render formatting like <strong>

                listItem.appendChild(labelSpan);
                listItem.appendChild(valueSpan);
                list.appendChild(listItem);
            });
            sectionDiv.appendChild(list);
        }

         // Only append the section if it has content (redundant due to GAS filter but safe)
        if (sectionDiv.hasChildNodes()) {
           contentDiv.appendChild(sectionDiv);
        }
    });
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
    if (!isMobileDevice()) {
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

function isMobileDevice() {
  return window.innerWidth <= 500 ||
    (window.screen && window.screen.width <= 500) ||
    (window.matchMedia && window.matchMedia('(max-width: 500px), (max-device-width: 500px)').matches);
}

function updateClock() {
  const now = new Date();
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
  document.getElementById('clock').textContent = time;
}

// --- Layout and Responsive Design ---
function calculateGrid(data) {
  // Check if we're on mobile - include iPhone detection
  const isMobile = isMobileDevice();

  if (isMobile) {
    // On mobile, we use a single column layout with larger text
    mainGrid.style.gridTemplateColumns = '1fr';
    mainGrid.style.display = 'flex';
    mainGrid.style.flexDirection = 'column';
    mainGrid.classList.add('mobile-grid');

    // Increase font size for mobile devices
    const mobileFontSize = Math.max(16, Math.min(64, window.innerWidth / 20));
    document.documentElement.style.setProperty('--base-font-size', `${mobileFontSize}px`);

    return COLUMN_SPANS;
  }

  // Desktop layout
  const compactCount = data.filter(card => isCompactCard(card.title)).length;
  const regularCount = data.length - compactCount;
  const totalCols = (regularCount * COLUMN_SPANS.REGULAR) + (compactCount * COLUMN_SPANS.COMPACT);

  mainGrid.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;
  mainGrid.style.display = 'grid';
  mainGrid.classList.remove('mobile-grid');

  // Calculate and set dynamic font size based on screen width and columns
  adjustFontSize(totalCols, data);

  return COLUMN_SPANS;
}

function adjustFontSize(totalColumns, data) {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // Base calculation on available width per column and height
  const columnWidth = screenWidth / totalColumns;

  // Calculate total rows across all cards
  const totalRows = data.reduce((total, card) => {
    return total + (card.type === 'messages' ? card.messages.length : card.items.length);
  }, 0);

  // Consider both width and height constraints
  const widthBasedSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, columnWidth / 10));
  const heightBasedSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, (screenHeight * 0.7) / totalRows));

  // Use the smaller of the two to prevent overflow in either direction
  let baseFontSize = Math.min(widthBasedSize, heightBasedSize);

  document.documentElement.style.setProperty('--base-font-size', `${baseFontSize}px`);

  // After rendering, check for text overflow and adjust if needed
  setTimeout(() => {
    optimizeFontSize(data);
  }, 0);
}

function optimizeFontSize(data) {
  // Get all rows to check for overflow
  const rows = document.querySelectorAll('.row');
  let currentFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-font-size'));
  let needsAdjustment = false;

  // Check each row for overflow
  rows.forEach(row => {
    const label = row.querySelector('.label');
    const value = row.querySelector('.value');

    // Check if either label or value is overflowing
    if (label && (label.scrollWidth > label.clientWidth)) {
      needsAdjustment = true;
    }

    if (value && (value.scrollWidth > value.clientWidth)) {
      needsAdjustment = true;
    }
  });

  // Check for vertical overflow as well
  if (mainGrid.scrollHeight > mainGrid.clientHeight) {
    needsAdjustment = true;
  }

  // If overflow detected, reduce font size and check again
  if (needsAdjustment && currentFontSize > MIN_FONT_SIZE) {
    currentFontSize -= 0.5;
    document.documentElement.style.setProperty('--base-font-size', `${currentFontSize}px`);

    // Recursively check again after DOM update
    setTimeout(() => {
      optimizeFontSize(data);
    }, 10);
  } else if (!needsAdjustment) {
    // Try to increase font size if possible
    tryIncreaseFont(data, currentFontSize);
  }
}

function tryIncreaseFont(data, currentSize) {
  // Increase font size slightly
  const newSize = currentSize + 0.5;
  document.documentElement.style.setProperty('--base-font-size', `${newSize}px`);

  // Check if this causes overflow
  setTimeout(() => {
    const rows = document.querySelectorAll('.row');
    let hasOverflow = false;

    rows.forEach(row => {
      const label = row.querySelector('.label');
      const value = row.querySelector('.value');

      if (label && (label.scrollWidth > label.clientWidth)) {
        hasOverflow = true;
      }

      if (value && (value.scrollWidth > value.clientWidth)) {
        hasOverflow = true;
      }
    });

    // Check for vertical overflow as well
    if (mainGrid.scrollHeight > mainGrid.clientHeight) {
      hasOverflow = true;
    }

    // If increasing caused overflow, revert to previous size
    if (hasOverflow) {
      document.documentElement.style.setProperty('--base-font-size', `${currentSize}px`);
    } else if (newSize < MAX_FONT_SIZE) {
      // If no overflow and size is still reasonable, try increasing more
      tryIncreaseFont(data, newSize);
    }
  }, 10);
}

// --- Event Listeners ---
// Recalculate grid and font size when window is resized
window.addEventListener('resize', () => {
  // Only run if grid has been initialized and we have data
  if (mainGrid.hasChildNodes() && currentData) {
     console.log("Window resized, recalculating grid/font..."); // Optional debug
     calculateGrid(currentData); // Use the stored data
   }
});

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