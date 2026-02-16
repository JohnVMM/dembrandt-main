(function () {
  const preloader = document.getElementById('preloader');
  const preloaderBar = document.getElementById('preloader-bar');
  const quotes = Array.from(document.querySelectorAll('.quote'));
  let quoteIndex = 0;

  function initLenis() {
    if (!window.Lenis) return;
    const lenis = new window.Lenis({
      duration: 1.0,
      smoothWheel: true,
      smoothTouch: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
  }

  function initPreloader() {
    if (!window.gsap || !preloader || !preloaderBar) {
      if (preloader) preloader.style.display = 'none';
      return;
    }

    const tl = window.gsap.timeline();
    tl.to(preloaderBar, {
      width: '100%',
      duration: 1.1,
      ease: 'linear',
    })
      .to(
        '.preloader-box h1',
        {
          y: -24,
          opacity: 0,
          duration: 0.45,
          ease: 'ease-out',
        },
        '-=0.2'
      )
      .to(preloader, {
        autoAlpha: 0,
        duration: 0.6,
        ease: 'ease-in-out',
        onComplete: () => {
          preloader.style.display = 'none';
        },
      });
  }

  function initGsap() {
    if (!window.gsap || !window.ScrollTrigger) return;

    window.gsap.registerPlugin(window.ScrollTrigger);

    window.gsap.from('.site-header', {
      y: -18,
      opacity: 0,
      duration: 0.8,
      ease: 'ease-out',
      delay: 0.8,
    });

    window.gsap.from('.hero-title', {
      y: 30,
      opacity: 0,
      duration: 1,
      ease: 'ease-out',
      delay: 0.95,
    });

    window.gsap.from('.hero-text, .hero-actions', {
      y: 24,
      opacity: 0,
      duration: 0.8,
      stagger: 0.12,
      delay: 1.05,
      ease: 'ease-out',
    });

    window.gsap.utils.toArray('.reveal').forEach((el) => {
      window.gsap.to(el, {
        y: 0,
        opacity: 1,
        duration: 0.85,
        ease: 'ease-out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          once: true,
        },
      });
    });

    window.gsap.to('.hero-layer', {
      yPercent: 10,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });

  }

  function initQuotes() {
    if (!quotes.length) return;

    setInterval(() => {
      quotes[quoteIndex].classList.remove('active');
      quoteIndex = (quoteIndex + 1) % quotes.length;
      quotes[quoteIndex].classList.add('active');
    }, 3600);
  }

  initLenis();
  initPreloader();
  initGsap();
  initQuotes();
})();
