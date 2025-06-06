// --- Configuration ---
// DEPLOYED WEB APP URL - this should point to your Google Apps Script Web App
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzLXwvmQ2uTSbW0kCVAupFRwhK9hEEpQ2651MiQpZehhYteoCQlsbsMWRvMz5WcFKO7lg/exec';
const updateInterval = 60 * 1000;

// --- DOM Elements ---
const mainGrid = document.getElementById('mainGrid');
const clockElement = document.getElementById('clock');

// --- Global State ---
let currentData = null; // To store the currently displayed data
let lastWindowSize = { width: window.innerWidth, height: window.innerHeight }; // Track window size for significant changes

// --- Constants ---
const CARD_TYPES = {
    TIMES: 'זמני היום',
    MESSAGES: 'הודעות'
};

const COLUMN_SPANS = {
    COMPACT: 4,
    REGULAR: 5
};

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 72;
const FONT_STEP = 0.5;
const PORTRAIT_FONT_SIZE = 18;

// Cache for previously calculated font sizes
const fontSizeCache = {};

// --- Utility Functions ---
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
    if (clockElement) {
        clockElement.textContent = time;
    }
}

function setFontSize(size) {
    document.documentElement.style.setProperty('--base-font-size', `${size}px`);
    const minisize = size * 0.7;
    const compactSize = Math.round(minisize);
    document.documentElement.style.setProperty('--compact-font-size', `${compactSize}px`);
}

function checkForOverflow() {
    // Check if grid has vertical overflow
    if (mainGrid.scrollHeight > mainGrid.clientHeight + 1) { // Add a small tolerance
        console.log('Grid overflow detected vertically!');
        return true;
    }

    // NEW: Check each card-body for vertical overflow
    const cardBodies = document.querySelectorAll('.card-body');
    for (const body of cardBodies) {
        if (body.scrollHeight > body.clientHeight + 1) { // Add tolerance
            console.log('Card body vertical overflow detected!');
            return true;
        }
    }

    // Check each row for text horizontal overflow
    const rows = document.querySelectorAll('.card-body .row'); // Be more specific to .card-body rows
    for (const row of rows) {
        const label = row.querySelector('.label');
        const value = row.querySelector('.value');

        if ((label && label.scrollWidth > label.clientWidth + 1) ||
            (value && value.scrollWidth > value.clientWidth + 1)) {
            console.log('Row text horizontal overflow detected!');
            return true;
        }
    }

    // Check card headers for horizontal overflow
    const headers = document.querySelectorAll('.card-header');
    for (const header of headers) {
        if (header.scrollWidth > header.clientWidth + 1) {
            console.log('Header text horizontal overflow detected!');
            return true;
        }
    }

    return false;
}

// --- Data Fetching ---
async function fetchData() {
    if (!WEB_APP_URL || WEB_APP_URL === 'YOUR_DEPLOYED_WEB_APP_URL_GOES_HERE') {
        return displayError("יש להגדיר את כתובת ה-Web App בקובץ get-sheet.js");
    }

    try {
        const cacheBuster = new Date().getTime();
        const url = `${WEB_APP_URL}?cb=${cacheBuster}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            mode: 'cors'
        });

        if (!response.ok) {
            let errorText = `HTTP שגיאה ${response.status}`;
            try {
                const errorBody = await response.text();
                errorText += `: ${errorBody}`;
            } catch (e) { /* Ignore if cannot read body */ }
            throw new Error(errorText);
        }

        const data = await response.json();

        if (data.error) {
            return displayError(data.error);
        }

        return data;
    } catch (error) {
        return displayError(error.message || 'לא ניתן היה לטעון את הנתונים.');
    }
}

// --- Rendering and Layout ---
function renderSchedules(data) {
    mainGrid.innerHTML = '';
    const sortedData = [...data].sort((a, b) => {
        if (a.title === CARD_TYPES.MESSAGES) return -1; // "הודעות" comes first (rightmost in RTL)
        if (b.title === CARD_TYPES.MESSAGES) return 1;
        if (a.title === CARD_TYPES.TIMES) return 1; // "זמני היום" comes last (leftmost in RTL)
        if (b.title === CARD_TYPES.TIMES) return -1;
        return 0; // Keep original order for other items
    });

    sortedData.forEach(schedule => {
        const card = document.createElement('div');
        const isCompact = isCompactCard(schedule.title);
        const isMessages = schedule.type === 'messages';

        card.className = `card ${isCompact ? 'compact' : ''} ${isMessages ? 'messages' : ''}`;

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

function setupGridAndFont(data) {
    // Calculate available height
    const headerHeight = document.querySelector('.header').offsetHeight;
    const footerHeight = document.querySelector('.footer').offsetHeight;
    const availableHeight = window.innerHeight - headerHeight - footerHeight;

    // Set grid height to fill available space
    mainGrid.style.height = `${availableHeight}px`;
    mainGrid.style.maxHeight = `${availableHeight}px`;

    // Apply visibility:hidden to prevent flickering during calculations
    mainGrid.style.visibility = 'hidden';

    // Use requestAnimationFrame for smoother updates and to ensure DOM is ready
    requestAnimationFrame(() => {
        if (isPortrait()) {
            // For portrait: use fixed font size and simple layout
            setFontSize(PORTRAIT_FONT_SIZE);
            mainGrid.style.gridTemplateColumns = '1fr';
            mainGrid.style.display = 'flex';
            mainGrid.style.flexDirection = 'column';
            mainGrid.classList.add('mobile-grid');
            mainGrid.style.visibility = 'visible'; // Make visible after portrait adjustments
        } else {
            // For landscape: proceed with dynamic grid layout and font optimization
            mainGrid.classList.remove('mobile-grid');
            mainGrid.style.display = 'grid'; // Ensure grid display for landscape

            // Dynamically calculate grid columns based on card types
            const compactCount = data.filter(card => isCompactCard(card.title)).length;
            const regularCount = data.length - compactCount;
            const totalCols = (compactCount * COLUMN_SPANS.COMPACT) + (regularCount * COLUMN_SPANS.REGULAR);
            mainGrid.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;

            // Try to use cached font size first
            // Cache key includes content count for more robust invalidation
            const cacheKey = `${window.innerWidth}-${window.innerHeight}-${data.length}-${JSON.stringify(data.map(d => ({title: d.title, contentCount: d.type === 'messages' ? d.messages.length : d.items.length})))}`;
            const cachedSize = fontSizeCache[cacheKey];

            if (cachedSize) {
                setFontSize(cachedSize);
                console.log(`Using cached font size: ${cachedSize}px`);
                mainGrid.style.visibility = 'visible'; // Make visible immediately
            } else {
                // Initial large font size for binary search
                setFontSize(MAX_FONT_SIZE);

                // Wait for a small moment for styles to apply before measuring overflow
                requestAnimationFrame(() => {
                    let min = MIN_FONT_SIZE;
                    let max = MAX_FONT_SIZE;
                    let foundSize = null;
                    let iterations = 0;
                    const maxIterations = 30; // Increased iterations for more precision

                    // Binary search for optimal font size
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

                    // Apply the final size
                    if (foundSize !== null) {
                        setFontSize(foundSize);
                    } else {
                        // If no size was found (very unlikely with correct min/max), fallback to min
                        setFontSize(MIN_FONT_SIZE);
                    }

                    // Cache the result
                    const newSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-font-size'));
                    fontSizeCache[cacheKey] = newSize;

                    mainGrid.style.visibility = 'visible'; // Make visible after all calculations
                    console.log(`Optimal font size found: ${newSize}px`);
                });
            }
        }

        // Update card spans after grid setup, in case of orientation change
        const cards = mainGrid.querySelectorAll('.card');
        cards.forEach(card => {
            if (isPortrait()) {
                card.style.gridColumn = ''; // Remove grid-column span in portrait
            } else {
                const isCompact = card.classList.contains('compact');
                const span = isCompact ? COLUMN_SPANS.COMPACT : COLUMN_SPANS.REGULAR;
                card.style.gridColumn = `span ${span}`;
            }
        });
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

// --- Debounce function to prevent multiple resize calculations ---
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        const later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- Update the resize handler with debouncing ---
window.addEventListener('resize', debounce(() => {
    // Check if window size or orientation has significantly changed
    const currentWindowSize = { width: window.innerWidth, height: window.innerHeight };
    const orientationChanged = isPortrait() !== (lastWindowSize.width < lastWindowSize.height);
    const sizeChanged = Math.abs(currentWindowSize.width - lastWindowSize.width) > 10 ||
                        Math.abs(currentWindowSize.height - lastWindowSize.height) > 10; // Smaller threshold for height

    if (orientationChanged || sizeChanged) {
        console.log("Window resized or orientation changed, re-optimizing display.");
        updateDisplay();
        lastWindowSize = currentWindowSize;
    }
}, 200)); // Increased debounce time slightly

// --- Data Update Check ---
async function checkForUpdates() {
    console.log("Checking for data updates...");
    try {
        const newData = await fetchData();

        if (newData) {
            // Deep comparison to check if data actually changed
            if (JSON.stringify(newData) !== JSON.stringify(currentData)) {
                console.log("Data changed, updating display.");
                currentData = newData; // Update the current data state
                updateDisplay(); // Re-render and optimize
            } else {
                console.log("No data changes detected.");
            }
        } else {
            console.warn("Failed to fetch updates or received null data.");
            // Optionally: keep showing old data or display a transient warning
        }
    } catch (error) {
        console.error("Error checking for updates:", error);
    }
}

// --- Initialization ---
window.onload = async () => {
    try {
        setInterval(updateClock, 1000);
        updateClock();

        mainGrid.innerHTML = '<div class="loading">טוען נתונים...</div>';

        const initialData = await fetchData();
        if (initialData) {
            currentData = initialData;
            updateDisplay(); // Initial render and optimization
            setInterval(checkForUpdates, updateInterval);
        } else {
            showError('לא התקבלו נתונים או שגיאה בטעינתם הראשונית.');
        }
    } catch (error) {
        showError('Error during initial load: ' + error.message);
    }
};
