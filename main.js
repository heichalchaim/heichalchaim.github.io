// --- Configuration & Constants ---
/**
 * DEPLOYED WEB APP URL - this should point to your Google Apps Script Web App
 * @type {string}
 */
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxWJaLCR3wIISYnikIXhBeh0nIa2NGCtthowQ4EMsulGhZUC0afC1CwJHwj8jmRGLLaQg/exec';
const UPDATE_INTERVAL = 60 * 1000;

const CARD_TYPES = {
    TIMES: 'זמני היום',
    MESSAGES: 'הודעות'
};
const COLUMN_SPANS = {
    COMPACT: 4,
    REGULAR: 5
};
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 120;
const FONT_STEP = 0.1;
const PORTRAIT_FONT_SIZE = 18;
const COMPACT_FONT_RATIO = 0.75;

// --- DOM Elements ---
const mainGrid = document.getElementById('mainGrid');
const clockElement = document.getElementById('clock');

// --- Global State ---
let currentData = null;
let lastWindowSize = { width: window.innerWidth, height: window.innerHeight };
const fontSizeCache = {};

// --- Utility Functions ---
/**
 * Display an error in the console and return null.
 * @param {string} message
 * @returns {null}
 */
function displayError(message) {
    console.error('Error fetching or displaying data:', message);
    return null;
}

/**
 * Show an error message in the main grid.
 * @param {string} message
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    mainGrid.innerHTML = '';
    mainGrid.appendChild(errorDiv);
}

function isCompactCard(title) {
    return title === CARD_TYPES.TIMES || title === CARD_TYPES.MESSAGES;
}

function isPortrait() {
    return window.innerWidth < window.innerHeight;
}

/**
 * Update the clock element with the current time.
 */
function updateClock() {
    const now = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(n => String(n).padStart(2, '0'))
        .join(':');
    if (clockElement) {
        clockElement.textContent = time;
    }
}

/**
 * Set the base and compact font sizes via CSS variables.
 * @param {number} size
 */
function setFontSize(size) {
    document.documentElement.style.setProperty('--base-font-size', `${size}px`);
    const compactSize = Math.round(size * COMPACT_FONT_RATIO);
    document.documentElement.style.setProperty('--compact-font-size', `${compactSize}px`);
}

/**
 * Check for overflow in the grid, card bodies, and rows.
 * @returns {boolean}
 */
function checkForOverflow() {
    if (mainGrid.scrollHeight > mainGrid.clientHeight + 1) return true;
    const cardBodies = document.querySelectorAll('.card-body');
    for (const body of cardBodies) {
        if (body.scrollHeight > body.clientHeight + 1) return true;
    }
    const rows = document.querySelectorAll('.card-body .row');
    for (const row of rows) {
        const label = row.querySelector('.label');
        const value = row.querySelector('.value');
        if ((label && label.scrollWidth > label.clientWidth + 1) ||
            (value && value.scrollWidth > value.clientWidth + 1)) {
            return true;
        }
    }
    const headers = document.querySelectorAll('.card-header');
    for (const header of headers) {
        if (header.scrollWidth > header.clientWidth + 1) return true;
    }
    return false;
}

// --- Data Fetching ---
/**
 * Fetch data from the web app URL.
 * @returns {Promise<Object|null>}
 */
async function fetchData() {
    if (!WEB_APP_URL || WEB_APP_URL === 'YOUR_DEPLOYED_WEB_APP_URL_GOES_HERE') {
        return displayError("יש להגדיר את כתובת ה-Web App בקובץ get-sheet.js");
    }
    try {
        const cacheBuster = new Date().getTime();
        const url = `${WEB_APP_URL}?cb=${cacheBuster}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors'
        });
        if (!response.ok) {
            let errorText = `HTTP שגיאה ${response.status}`;
            try { errorText += `: ${await response.text()}`; } catch (e) {}
            throw new Error(errorText);
        }
        const data = await response.json();
        if (data.error) return displayError(data.error);
        return data;
    } catch (error) {
        return displayError(error.message || 'לא ניתן היה לטעון את הנתונים.');
    }
}

// --- Rendering and Layout ---
/**
 * Render the schedule cards in the main grid.
 * @param {Array} data
 */
function renderSchedules(data) {
    mainGrid.innerHTML = '';
    const sortedData = [...data].sort((a, b) => {
        if (a.title === CARD_TYPES.MESSAGES) return -1;
        if (b.title === CARD_TYPES.MESSAGES) return 1;
        if (a.title === CARD_TYPES.TIMES) return 1;
        if (b.title === CARD_TYPES.TIMES) return -1;
        return 0;
    });
    sortedData.forEach(schedule => {
        const card = document.createElement('div');
        const isCompact = isCompactCard(schedule.title);
        const isMessages = schedule.type === 'messages';
        card.className = `card${isCompact ? ' compact' : ''}${isMessages ? ' messages' : ''}`;
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

/**
 * Set up the grid layout and font size based on orientation and content.
 * @param {Array} data
 */
function setupGridAndFont(data) {
    const headerHeight = document.querySelector('.header').offsetHeight;
    const footerHeight = document.querySelector('.footer').offsetHeight;
    const availableHeight = window.innerHeight - headerHeight - footerHeight;
    mainGrid.style.height = `${availableHeight}px`;
    mainGrid.style.maxHeight = `${availableHeight}px`;
    mainGrid.style.visibility = 'hidden';

    if (isPortrait()) {
        setFontSize(PORTRAIT_FONT_SIZE);
        mainGrid.style.gridTemplateColumns = '1fr';
        mainGrid.style.display = 'flex';
        mainGrid.style.flexDirection = 'column';
        mainGrid.classList.add('mobile-grid');
        mainGrid.style.visibility = 'visible';
    } else {
        mainGrid.classList.remove('mobile-grid');
        mainGrid.style.display = 'grid';
        const compactCount = data.filter(card => isCompactCard(card.title)).length;
        const regularCount = data.length - compactCount;
        const totalCols = (compactCount * COLUMN_SPANS.COMPACT) + (regularCount * COLUMN_SPANS.REGULAR);
        mainGrid.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;
        const cacheKey = `${window.innerWidth}-${window.innerHeight}-${data.length}-${JSON.stringify(data.map(d => ({title: d.title, contentCount: d.type === 'messages' ? d.messages.length : d.items.length})))}`;
        const cachedSize = fontSizeCache[cacheKey];
        if (cachedSize && !checkForOverflow()) {
            setFontSize(cachedSize);
            mainGrid.style.visibility = 'visible';
        } else {
            setFontSize(MAX_FONT_SIZE);
            let min = MIN_FONT_SIZE;
            let max = MAX_FONT_SIZE;
            let foundSize = null;
            let iterations = 0;
            const maxIterations = 100;
            while (max - min > FONT_STEP && iterations < maxIterations) {
                iterations++;
                const current = (min + max) / 2;
                setFontSize(current);
                if (!checkForOverflow()) {
                    min = current;
                    foundSize = current;
                } else {
                    max = current;
                }
            }
            setFontSize(foundSize !== null ? foundSize : MIN_FONT_SIZE);
            const newSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-font-size'));
            fontSizeCache[cacheKey] = newSize;
            mainGrid.style.visibility = 'visible';
        }
    }
    // Update card spans after grid setup
    const cards = mainGrid.querySelectorAll('.card');
    cards.forEach(card => {
        if (isPortrait()) {
            card.style.gridColumn = '';
        } else {
            const isCompact = card.classList.contains('compact');
            const span = isCompact ? COLUMN_SPANS.COMPACT : COLUMN_SPANS.REGULAR;
            card.style.gridColumn = `span ${span}`;
        }
    });
}

// --- Central Display Update Function ---
function updateDisplay() {
    if (!currentData) {
        showError('No data available to display.');
        return;
    }
    renderSchedules(currentData);
    setupGridAndFont(currentData);
}

// --- Debounce Utility ---
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// --- Window Resize Handler ---
window.addEventListener('resize', debounce(() => {
    const currentWindowSize = { width: window.innerWidth, height: window.innerHeight };
    const orientationChanged = isPortrait() !== (lastWindowSize.width < lastWindowSize.height);
    const sizeChanged = Math.abs(currentWindowSize.width - lastWindowSize.width) > 1 ||
                        Math.abs(currentWindowSize.height - lastWindowSize.height) > 1;
    if (orientationChanged || sizeChanged) {
        updateDisplay();
        lastWindowSize = currentWindowSize;
    }
}, 200));

// --- Data Update Check ---
async function checkForUpdates() {
    try {
        const newData = await fetchData();
        if (newData && JSON.stringify(newData) !== JSON.stringify(currentData)) {
            currentData = newData;
            updateDisplay();
        }
    } catch (error) {
        // Optionally show a transient warning
    }
}

function setHeaderAndFooter() {
  /**
   * Application constants for UI strings.
   * Centralizing them here makes maintenance easier.
   */
  const UI_TEXT = {
    SITE_TITLE: 'בית הכנסת היכל חיים',
    FOOTER_DEDICATION: 'לעלוי נשמת יהושע בן ישראל איסר ז"ל',
  };

  // Update the page title
  document.title = UI_TEXT.SITE_TITLE;

  // Update the main heading
  const mainTitleElement = document.getElementById('main-title');
  if (mainTitleElement) {
    mainTitleElement.textContent = UI_TEXT.SITE_TITLE;
  }

  // Update the footer
  const footerElement = document.getElementById('footer-dedication');
  if (footerElement) {
    footerElement.textContent = UI_TEXT.FOOTER_DEDICATION;
  }
};

// --- Initialization ---
window.onload = async () => {
    mainGrid.innerHTML = '<div class="loading">טוען נתונים...</div>';
    try {
        setInterval(updateClock, 1000);
        updateClock();
        setHeaderAndFooter();
        const initialData = await fetchData();
        if (initialData) {
            currentData = initialData;
            updateDisplay();
            setInterval(checkForUpdates, UPDATE_INTERVAL);
        } else {
            showError('לא התקבלו נתונים או שגיאה בטעינתם הראשונית.');
        }
    } catch (error) {
        showError('Error during initial load: ' + error.message);
    }
};



