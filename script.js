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
      
        hdr.addEventListener('pointerdown', (e) => {
          if (e.target.classList.contains('popup-close')) return;
          e.preventDefault();
      
          const termRect   = terminal.getBoundingClientRect();
          const headerRect = header.getBoundingClientRect();
          const startX     = e.clientX;
          const startY     = e.clientY;
          const rect       = popup.getBoundingClientRect();
          const initLeft   = rect.left - termRect.left;
          const initTop    = rect.top  - termRect.top;
      
          document.body.style.userSelect = 'none';
          hdr.setPointerCapture(e.pointerId);
      
          function onPointerMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newLeft = initLeft + dx;
            let newTop  = initTop  + dy;
      
            // desktop clamp
            if (window.innerWidth > 500) {
              const minX = 0;
              const maxX = termRect.width  - rect.width;
              const minY = headerRect.bottom - termRect.top;
              const maxY = termRect.height - rect.height;
      
              newLeft = Math.max(minX, Math.min(newLeft, maxX));
              newTop  = Math.max(minY, Math.min(newTop, maxY));
            }
      
            popup.style.left = `${newLeft}px`;
            popup.style.top  = `${newTop}px`;
          }
      
          function onPointerUp(e) {
            document.body.style.userSelect = '';
            hdr.releasePointerCapture(e.pointerId);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup',   onPointerUp);
          }
      
          document.addEventListener('pointermove', onPointerMove);
          document.addEventListener('pointerup',   onPointerUp);
        });
      }
      

    makeDraggable(popups.contact);
    makeDraggable(popups.about);
});
  