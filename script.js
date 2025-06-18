// script.js
// Updated: constrain popups within the gray ".terminal" area, staying below the header

// 1. Date/time updater
function updateDateTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const el = document.getElementById('date-time');
    if (el) el.textContent = `${hour12}:${minutes}${ampm} - ${dateStr}`;
}
setInterval(updateDateTime, 1000);
updateDateTime();

window.addEventListener('DOMContentLoaded', () => {
    const links = {
        contact: document.getElementById('contact-link'),
        about:   document.getElementById('about-link')
    };
    const popups = {
        contact: document.getElementById('contact-popup'),
        about:   document.getElementById('about-popup')
    };
    const closes = {
        contact: document.getElementById('close-contact'),
        about:   document.getElementById('close-about')
    };
    const terminal = document.querySelector('.terminal');
    const header   = document.querySelector('.terminal-header');
    const fileGrid = document.querySelector('.file-grid');

    let zCounter = 200;
    function bringToFront(popup) {
        zCounter++;
        popup.style.zIndex = zCounter;
    }

    function openPopup(popup) {
        popup.style.left = '60px';
        popup.style.top = '120px';
        popup.classList.add('active');
        bringToFront(popup);
    }
    links.contact.onclick = e => { e.preventDefault(); openPopup(popups.contact); };
    links.about  .onclick = e => { e.preventDefault(); openPopup(popups.about);   };
    closes.contact.onclick = () => popups.contact.classList.remove('active');
    closes.about  .onclick = () => popups.about  .classList.remove('active');

    // Bring popup to front when header is clicked (for drag)
    [popups.contact, popups.about].forEach(popup => {
        popup.querySelector('.popup-header').addEventListener('mousedown', function(e) {
            if (!e.target.classList.contains('popup-close')) {
                bringToFront(popup);
            }
        });
    });

    // Improved drag and drop for popups with boundary constraints
    function makeDraggable(popup) {
        const hdr = popup.querySelector('.popup-header');
        let offsetX = 0, offsetY = 0;
        let mouseMoveHandler, mouseUpHandler;

        hdr.addEventListener('mousedown', function(e) {
            if (e.target.classList.contains('popup-close')) return; // Don't drag if clicking the close button
            e.preventDefault();

            // get bounding rects
            const termRect   = terminal.getBoundingClientRect();
            const headerRect = header.getBoundingClientRect();
            const popupRect  = popup.getBoundingClientRect();
            const fileGridRect = fileGrid.getBoundingClientRect();

            // initial click offsets
            offsetX = e.clientX - popupRect.left;
            offsetY = e.clientY - popupRect.top;
            document.body.style.userSelect = 'none';

            // compute movement bounds relative to terminal
            const minX = 0;
            const maxX = termRect.width - popupRect.width;
            // ensure popup stays below header: use header bottom relative to terminal top
            const minY = headerRect.bottom - termRect.top;
            const maxY = termRect.height - popupRect.height;

            mouseMoveHandler = function(e) {
                // raw coords relative to terminal
                let x = e.clientX - offsetX - termRect.left;
                let y = e.clientY - offsetY - termRect.top;
                // clamp within bounds
                x = Math.max(minX, Math.min(x, maxX));
                y = Math.max(minY, Math.min(y, maxY));
                popup.style.position = 'absolute';
                popup.style.left     = x + 'px';
                popup.style.top      = y + 'px';
            };
            mouseUpHandler = function() {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup',   mouseUpHandler);
                document.body.style.userSelect = '';
            };
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup',   mouseUpHandler);
        });
    }

    makeDraggable(popups.contact);
    makeDraggable(popups.about);
});
  