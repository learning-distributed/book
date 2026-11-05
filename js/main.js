// Toggle collapsible admonitions on click.
$(document).ready(function () {
  $(".admonition.collapsible .admonition-title").click(function () {
    var e = $(this).parent();
    if (!e.hasClass("initialized")) {
      e.data("initial-height", e.outerHeight());
      e.css("max-height", e.outerHeight());
      e.addClass("initialized");
    }
    if (e.hasClass("expanded")) {
      e.css("max-height", e.data("initial-height"));
      e.removeClass("expanded");
    } else {
      e.addClass("expanded");
      setTimeout(function () {
        e.css("max-height", e.prop("scrollHeight"));
      }, 0.001);
    }
  });
});

// Hide/unhide the sidebar.
$(document).ready(() => {
  $("#sidebar-button").click(() => {
    document.documentElement.classList.toggle("sidebar-collapsed");
    localStorage.setItem(
      "sidebar-collapsed",
      document.documentElement.classList.contains("sidebar-collapsed"),
    );
  });
});
// Initialize sidebar state. This must be done before the document is loaded.
if (window.innerWidth <= 991) {
  document.documentElement.classList.add("sidebar-collapsed");
}
if (localStorage.getItem("sidebar-collapsed") === "true") {
  document.documentElement.classList.add("sidebar-collapsed");
} else if (localStorage.getItem("sidebar-collapsed") === "false") {
  document.documentElement.classList.remove("sidebar-collapsed");
}

// Apply border to top bar when scrolling.
$(document).ready(function () {
  const sentinel = document.createElement("div");
  sentinel.id = "scroll-sentinel";

  const topBar = document.getElementById("top-bar");
  topBar.parentNode.insertBefore(sentinel, topBar);

  const scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          $("#top-bar").addClass("scrolled");
        } else {
          $("#top-bar").removeClass("scrolled");
        }
      });
    },
    {
      rootMargin: "30px 0px 0px 0px",
    },
  );
  scrollObserver.observe(sentinel);
});

// Highlight active section in sidebar.
$(document).ready(() => {
  const topBar = document.querySelector("#top-bar");
  const tocLinks = document.querySelectorAll("#sidebar .toc a");

  // Grab the list of links from the ToC; sort them by vertical position.
  const sections = [];
  tocLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.startsWith("#")) {
      const section = document.getElementById(href.substring(1));
      if (section) {
        sections.push(section);
      }
    }
  });
  sections.sort((a, b) => a.bottom - b.bottom);

  let isScrolling = false;
  const updateActiveSection = () => {
    const navbarHeight = topBar ? topBar.offsetHeight : 0;
    const triggerLine = navbarHeight + 50;

    let activeId = null;
    for (const section of sections) {
      if (section.getBoundingClientRect().bottom >= triggerLine) {
        break;
      }
      activeId = section.id;
    }

    if (!activeId && sections.length > 0) {
      activeId = sections[0].id;
    }

    // If we've scrolled to the very bottom, highlight the last entry.
    if (
      window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 1 &&
      sections.length > 0
    ) {
      activeId = sections[sections.length - 1].id;
    }

    if (activeId) {
      tocLinks.forEach((link) => {
        if (link.getAttribute("href") === `#${activeId}`) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      });
    }

    isScrolling = false;
  };

  // Throttle updates.
  window.addEventListener("scroll", () => {
    if (!isScrolling) {
      window.requestAnimationFrame(updateActiveSection);
      isScrolling = true;
    }
  });

  updateActiveSection();
});
