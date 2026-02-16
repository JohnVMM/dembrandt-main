const revealItems = Array.from(document.querySelectorAll('.reveal, .reveal-stagger'));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const element = entry.target;
      if (element.classList.contains('reveal-stagger')) {
        const siblings = Array.from(
          element.parentElement?.querySelectorAll('.reveal-stagger') || []
        );
        const index = siblings.indexOf(element);
        element.style.animationDelay = `${index * 80}ms`;
      }

      element.classList.add('is-visible');
      observer.unobserve(element);
    });
  },
  {
    threshold: 0.2,
    rootMargin: '0px 0px -40px 0px',
  }
);

revealItems.forEach((item) => observer.observe(item));
