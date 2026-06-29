function initCommon() {

  // ==========================
  // Mobile Menu
  // ==========================
  const menuBtn = document.getElementById("menuBtn");
  const navMenu = document.getElementById("navMenu");
  const menuClose = document.getElementById("menuClose");

if(menuClose && navMenu){

    menuClose.onclick = () => {
        navMenu.classList.remove("open");
    };

}

  if (menuBtn && navMenu) {

    menuBtn.onclick = () => {
      navMenu.classList.toggle("open");
    };

    navMenu.querySelectorAll("a").forEach(link => {
      link.onclick = () => {
        navMenu.classList.remove("open");
      };
    });
  }

  // ==========================
  // Theme
  // ==========================
  const themeToggle = document.getElementById("themeToggle");

  if (themeToggle) {

    const savedTheme = localStorage.getItem("printstudio-theme");

    if (savedTheme === "dark") {
      document.body.classList.add("dark");
    }

    themeToggle.onclick = () => {

      document.body.classList.toggle("dark");

      localStorage.setItem(
        "printstudio-theme",
        document.body.classList.contains("dark") ? "dark" : "light"
      );

    };
  }

  // ==========================
  // Tilt Effect
  // ==========================
  document.querySelectorAll(".tilt").forEach(card => {

    card.onmousemove = (e) => {

      const rect = card.getBoundingClientRect();

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const rotateX = ((y / rect.height) - 0.5) * -6;
      const rotateY = ((x / rect.width) - 0.5) * 6;

      card.style.transform =
        `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate(-4px,-4px)`;

    };

    card.onmouseleave = () => {
      card.style.transform = "";
    };

  });

  // ==========================
  // Tools Dropdown
  // ==========================
  const toolsDropdown = document.getElementById("toolsDropdown");
  const toolsBtn = document.getElementById("toolsBtn");

  if (toolsDropdown && toolsBtn) {

    let closeTimer;

    function openDropdown() {
      clearTimeout(closeTimer);
      toolsDropdown.classList.add("open");
    }

    function closeDropdown() {
      clearTimeout(closeTimer);

      closeTimer = setTimeout(() => {
        toolsDropdown.classList.remove("open");
      }, 250);
    }

    // Desktop
    toolsDropdown.onmouseenter = openDropdown;
    toolsDropdown.onmouseleave = closeDropdown;

    // Mobile
    toolsBtn.onclick = (e) => {

      e.preventDefault();
      e.stopPropagation();

      clearTimeout(closeTimer);

      toolsDropdown.classList.toggle("open");

    };

    // Close when clicking outside
    document.onclick = (e) => {

      if (!toolsDropdown.contains(e.target)) {
        toolsDropdown.classList.remove("open");
      }

    };

  }

}