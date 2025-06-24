// script.js
// Updated: constrain popups within the gray ".terminal" area, staying below the header

// 1. Date/time updater - updates the clock in the terminal header
function updateDateTime() {
    const now = new Date();  // Get current date and time
    const hours = now.getHours();  // Extract hours (0-23)
    const minutes = now.getMinutes().toString().padStart(2, '0');  // Extract minutes, pad with leading zero
    const ampm = hours >= 12 ? 'PM' : 'AM';  // Determine AM/PM
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;  // Convert to 12-hour format
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });  // Format date
    const el = document.getElementById('date-time');  // Get the date-time element
    if (el) el.textContent = `${hour12}:${minutes}${ampm} - ${dateStr}`;  // Update the display
}
setInterval(updateDateTime, 1000);  // Update every second
updateDateTime();  // Initial update

window.addEventListener('DOMContentLoaded', () => {
    // Get references to all important DOM elements
    const links = {
        contact: document.getElementById('contact-link'),  // Contact file link
        about:   document.getElementById('about-link')     // About file link
    };
    const popups = {
        contact: document.getElementById('contact-popup'),  // Contact popup window
        about:   document.getElementById('about-popup')     // About popup window
    };
    const closes = {
        contact: document.getElementById('close-contact'),  // Contact close button
        about:   document.getElementById('close-about')     // About close button
    };
    const terminal = document.querySelector('.terminal');  // Main terminal container
    const header   = document.querySelector('.terminal-header');  // Terminal header
    const fileGrid = document.querySelector('.file-grid');  // File grid container

    let zCounter = 200;  // Z-index counter for layering popups
    function bringToFront(popup) {
        zCounter++;  // Increment z-index
        popup.style.zIndex = zCounter;  // Bring popup to front
    }

    // Function to open popup windows at fixed position
    function openPopup(popup) {
        popup.style.left = '60px';  // Set horizontal position
        popup.style.top = '120px';  // Set vertical position
        popup.classList.add('active');  // Show the popup
        bringToFront(popup);  // Bring popup to front
    }
    
    // Event handlers for opening popups
    links.contact.onclick = e => { 
        e.preventDefault();  // Prevent default link behavior
        openPopup(popups.contact);  // Open contact popup
    };
    links.about.onclick = e => { 
        e.preventDefault();  // Prevent default link behavior
        openPopup(popups.about);  // Open about popup
    };
    
    // Event handlers for closing popups
    closes.contact.onclick = () => popups.contact.classList.remove('active');  // Hide contact popup
    closes.about.onclick = () => popups.about.classList.remove('active');  // Hide about popup

    // Bring popup to front when header is clicked (for drag functionality)
    [popups.contact, popups.about].forEach(popup => {
        popup.querySelector('.popup-header').addEventListener('mousedown', function(e) {
            if (!e.target.classList.contains('popup-close')) {  // Don't bring to front if clicking close button
                bringToFront(popup);  // Bring popup to front
            }
        });
        
        // Bring popup to front when clicking/touching the popup content area
        const content = popup.querySelector('.popup-content');  // Get content area
        
        // Desktop mouse events
        content.addEventListener('mousedown', function(e) {
            e.stopPropagation();  // Prevent event bubbling
            bringToFront(popup);  // Bring popup to front
        });
        
        // Mobile touch events
        content.addEventListener('touchstart', function(e) {
            e.stopPropagation();  // Prevent event bubbling
            bringToFront(popup);  // Bring popup to front
        }, { passive: true });  // Passive listener for better performance
    });

    // Improved drag and drop for popups with boundary constraints
    function makeDraggable(popup) {
        const hdr = popup.querySelector('.popup-header');  // Get the header element for dragging
      
        hdr.addEventListener('pointerdown', (e) => {
          if (e.target.classList.contains('popup-close')) return;  // Don't drag if clicking close button
          e.preventDefault();  // Prevent default behavior
      
          // Get bounding rectangles for boundary calculations
          const termRect   = terminal.getBoundingClientRect();  // Terminal boundaries
          const headerRect = header.getBoundingClientRect();    // Header boundaries
          const startX     = e.clientX;  // Initial mouse X position
          const startY     = e.clientY;  // Initial mouse Y position
          const rect       = popup.getBoundingClientRect();     // Popup boundaries
          const initLeft   = rect.left - termRect.left;        // Initial left position relative to terminal
          const initTop    = rect.top  - termRect.top;         // Initial top position relative to terminal
      
          document.body.style.userSelect = 'none';  // Prevent text selection during drag
          hdr.setPointerCapture(e.pointerId);  // Capture pointer for consistent tracking
      
          function onPointerMove(e) {
            const dx = e.clientX - startX;  // Calculate X movement
            const dy = e.clientY - startY;  // Calculate Y movement
            let newLeft = initLeft + dx;    // New left position
            let newTop  = initTop  + dy;    // New top position
          
            // Uniform inset on all sides for boundary padding
            const PADDING = 5;  // Padding from edges
          
            // Calculate boundary limits
            const minX = PADDING;  // Minimum X position
            const maxX = termRect.width  - rect.width  - PADDING;  // Maximum X position
            const minY = (headerRect.bottom - termRect.top) + PADDING;  // Minimum Y position (below header)
            const maxY = termRect.height - rect.height - PADDING;  // Maximum Y position
          
            // Constrain to boundaries
            newLeft = Math.max(minX, Math.min(newLeft, maxX));  // Clamp X position
            newTop  = Math.max(minY, Math.min(newTop, maxY));   // Clamp Y position
          
            // Apply new position
            popup.style.left = `${newLeft}px`;  // Set left position
            popup.style.top  = `${newTop}px`;   // Set top position
          }
          
      
          function onPointerUp(e) {
            document.body.style.userSelect = '';  // Re-enable text selection
            hdr.releasePointerCapture(e.pointerId);  // Release pointer capture
            document.removeEventListener('pointermove', onPointerMove);  // Remove move listener
            document.removeEventListener('pointerup',   onPointerUp);    // Remove up listener
          }
      
          document.addEventListener('pointermove', onPointerMove);  // Add move listener
          document.addEventListener('pointerup',   onPointerUp);    // Add up listener
        });
      }
      

    makeDraggable(popups.contact);  // Make contact popup draggable
    makeDraggable(popups.about);    // Make about popup draggable

    // Blur effect for external links
    let blurTimeout;  // Timeout for delayed blur effect
    const externalLinks = document.querySelectorAll('.desktop-link[href*="calendly"], .desktop-link[href*="linkedin"], .desktop-link[href*="paragonpatents"], .desktop-link[href*="psv.vc"]');
    const allFiles = document.querySelectorAll('.desktop-file');

    // Function to apply blur effect
    function applyBlurEffect(hoveredFile) {
        allFiles.forEach(file => {
            if (file !== hoveredFile) {
                file.style.filter = 'blur(2px) brightness(0.5)';
                file.style.opacity = '0.4';
            }
        });
    }

    // Function to remove blur effect
    function removeBlurEffect() {
        allFiles.forEach(file => {
            file.style.filter = '';
            file.style.opacity = '';
        });
    }

    // Add hover listeners to external links
    externalLinks.forEach(link => {
        const fileContainer = link.closest('.desktop-file');
        
        link.addEventListener('mouseenter', () => {
            // Clear any existing timeout
            clearTimeout(blurTimeout);
            
            // Set timeout for 0.5 second delay
            blurTimeout = setTimeout(() => {
                applyBlurEffect(fileContainer);
            }, 300);
        });

        link.addEventListener('mouseleave', () => {
            // Clear timeout and remove blur immediately
            clearTimeout(blurTimeout);
            removeBlurEffect();
        });
    });
});
  