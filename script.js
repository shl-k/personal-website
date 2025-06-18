// script.js
// Updated: constrain popups within the gray “.terminal” area, staying below the header

// 1. Date/time updater
function updateDateTime() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes().toString().padStart(2,'0');
    const ampm = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    const d = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const el = document.getElementById('date-time');
    if (el) el.textContent = `${h12}:${m}${ampm} – ${d}`;
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
  
    function openPopup(popup) {
      popup.style.left = '60px';
      popup.style.top  = '120px';
      popup.classList.add('active');
    }
    links.contact.onclick = e => { e.preventDefault(); openPopup(popups.contact); };
    links.about  .onclick = e => { e.preventDefault(); openPopup(popups.about);   };
    closes.contact.onclick = () => popups.contact.classList.remove('active');
    closes.about  .onclick = () => popups.about  .classList.remove('active');
  
    function makeDraggable(popup) {
      const hdr = popup.querySelector('.popup-header');
      hdr.addEventListener('mousedown', e => {
        if (e.target.classList.contains('popup-close')) return;
        e.preventDefault();
  
        // get bounding rects
        const termRect   = terminal.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        const popupRect  = popup.getBoundingClientRect();
  
        // initial click offsets
        const offsetX = e.clientX - popupRect.left;
        const offsetY = e.clientY - popupRect.top;
        document.body.style.userSelect = 'none';
  
        // compute movement bounds relative to terminal
        const minX = 0;
        const maxX = termRect.width - popupRect.width;
        // ensure popup stays below header: use header bottom relative to terminal top
        const minY = headerRect.bottom - termRect.top;
        const maxY = termRect.height - popupRect.height;
  
        function onMove(e) {
          // raw coords relative to terminal
          let x = e.clientX - offsetX - termRect.left;
          let y = e.clientY - offsetY - termRect.top;
          // clamp within bounds
          x = Math.max(minX, Math.min(x, maxX));
          y = Math.max(minY, Math.min(y, maxY));
          popup.style.position = 'absolute';
          popup.style.left     = x + 'px';
          popup.style.top      = y + 'px';
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
          document.body.style.userSelect = '';
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      });
    }
  
    makeDraggable(popups.contact);
    makeDraggable(popups.about);
  });
  