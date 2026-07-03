document.addEventListener('DOMContentLoaded', () => {
  
  // =========================================================
  // 1. Mobile Sidebar Menu Toggle
  // =========================================================
  const menuBtn = document.querySelector('.menu-btn');
  const navMenu = document.querySelector('.nav');
  const closeBtn = document.querySelector('.menu-close');

  // Open Menu
  if (menuBtn && navMenu) {
    menuBtn.addEventListener('click', () => {
      navMenu.classList.add('open');
    });
  }

  // Close Menu
  if (closeBtn && navMenu) {
    closeBtn.addEventListener('click', () => {
      navMenu.classList.remove('open');
    });
  }

  // =========================================================
  // 2. Dropdown & Mega Menu Toggles
  // =========================================================
  const dropdownBtns = document.querySelectorAll('.nav-drop-btn');
  
  dropdownBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Prevent the link from jumping to the top of the page
      e.preventDefault(); 
      
      const parentDropdown = btn.closest('.nav-dropdown');
      
      // Optional: Close any other open dropdowns first (Accordion style)
      document.querySelectorAll('.nav-dropdown.open').forEach(dropdown => {
        if (dropdown !== parentDropdown) {
          dropdown.classList.remove('open');
        }
      });

      // Toggle the currently clicked dropdown
      parentDropdown.classList.toggle('open');
    });
  });

  // =========================================================
  // 3. Close Dropdowns when clicking outside of them
  // =========================================================
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-dropdown')) {
      document.querySelectorAll('.nav-dropdown.open').forEach(dropdown => {
        dropdown.classList.remove('open');
      });
    }
  }); // <-- THIS WAS MISSING HERE

  // =========================================================
  // 4. Tool Filter Buttons (Active State)
  // =========================================================
  const filterBtns = document.querySelectorAll('.filter-btn');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Step 1: Remove the 'active' class from ALL buttons
      filterBtns.forEach(b => b.classList.remove('active'));
      
      // Step 2: Add the 'active' class to the button that was just clicked
      btn.classList.add('active');

      // (Optional) Step 3: Filter logic goes here! 
      // If you want to actually hide/show specific tools, you would 
      // check the button's text and hide the cards that don't match.
    });
  });

});