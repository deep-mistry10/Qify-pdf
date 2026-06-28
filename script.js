const menuBtn = document.getElementById("menuBtn");
const navMenu = document.getElementById("navMenu");
const themeToggle = document.getElementById("themeToggle");

if (menuBtn && navMenu) {
  menuBtn.addEventListener("click", () => {
    navMenu.classList.toggle("open");
  });

  navMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("open");
    });
  });
}

if (themeToggle) {
  const savedTheme = localStorage.getItem("printstudio-theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("printstudio-theme", isDark ? "dark" : "light");
  });
}

/* small hover tilt effect */
const tiltCards = document.querySelectorAll(".tilt");

tiltCards.forEach(card => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateX = ((y / rect.height) - 0.5) * -6;
    const rotateY = ((x / rect.width) - 0.5) * 6;

    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate(-4px, -4px)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "";
  });
});
const toolsDropdown = document.getElementById("toolsDropdown");
const toolsBtn = document.getElementById("toolsBtn");

if (toolsDropdown && toolsBtn) {
  let closeTimer;

  function openDropdown() {
    clearTimeout(closeTimer);
    toolsDropdown.classList.add("open");
  }

  function closeDropdownWithDelay() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      toolsDropdown.classList.remove("open");
    }, 250); // 500 milliseconds
  }

  // desktop hover
  toolsDropdown.addEventListener("mouseenter", openDropdown);
  toolsDropdown.addEventListener("mouseleave", closeDropdownWithDelay);

  // mobile / click support
  toolsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearTimeout(closeTimer);
    toolsDropdown.classList.toggle("open");
  });

  // if click outside, close after 2 sec
  document.addEventListener("click", (e) => {
    if (!toolsDropdown.contains(e.target)) {
      closeDropdownWithDelay();
    }
  });
}