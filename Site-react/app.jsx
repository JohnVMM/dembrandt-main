const { useEffect, useMemo, useRef, useState } = React;

const DESTINATIONS = [
  {
    city: "Dolomitas, Italia",
    image:
      "https://images.unsplash.com/photo-1464822759844-d150ad6d1dd5?auto=format&fit=crop&w=1400&q=80",
    text: "Roteiros alpinos com experiencia gourmet e hospedagens boutique em altitude.",
    season: "Primavera a Outono",
    price: "A partir de EUR 3.800",
  },
  {
    city: "Kyoto, Japao",
    image:
      "https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1400&q=80",
    text: "Imersao cultural com curadoria de ryokans historicos e jornadas privadas.",
    season: "Mar-Abr e Out-Nov",
    price: "A partir de USD 4.200",
  },
  {
    city: "Patagonia, Chile",
    image:
      "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1400&q=80",
    text: "Aventura premium em reservas remotas com logistica de alto conforto.",
    season: "Outubro a Marco",
    price: "A partir de USD 5.100",
  },
  {
    city: "Santorini, Grecia",
    image:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1400&q=80",
    text: "Escapada mediterranea com iate charter, experiencias privadas e sunset suites.",
    season: "Abril a Outubro",
    price: "A partir de EUR 3.300",
  },
  {
    city: "Marrakech, Marrocos",
    image:
      "https://images.unsplash.com/photo-1597212720413-e61d5f89d2d5?auto=format&fit=crop&w=1400&q=80",
    text: "Curadoria de riads autorais, gastronomia local e roteiros de design e artesanato.",
    season: "Outubro a Maio",
    price: "A partir de EUR 2.900",
  },
  {
    city: "Bora Bora, Polinesia",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
    text: "Lagoas cristalinas, bangalos sobre agua e experiencias nauticas exclusivas.",
    season: "Maio a Outubro",
    price: "A partir de USD 6.500",
  },
];

const REVIEWS = [
  {
    quote:
      "A Aurora desenhou nossa lua de mel com uma precisao impecavel. Cada deslocamento parecia invisivel, e cada experiencia foi memoravel.",
    name: "Livia e Matheus",
    role: "Roteiro Japao + Maldivas",
  },
  {
    quote:
      "Conseguimos reunir 18 executivos em um retreat na Islandia sem nenhum atrito de logistica. A execucao foi de nivel internacional.",
    name: "Carolina Menezes",
    role: "Offsite Corporativo",
  },
  {
    quote:
      "A consultoria de viagem foi alem do esperado. A curadoria de hoteis e experiencias fez toda a diferenca no posicionamento da nossa marca.",
    name: "Rafael Soares",
    role: "Founder, Atelier Nordico",
  },
];

const FAQ = [
  {
    q: "Voces fazem apenas viagens internacionais?",
    a: "Atuamos em viagens nacionais e internacionais, sempre com curadoria premium e logistica completa.",
  },
  {
    q: "Como funciona o atendimento concierge?",
    a: "Apos o briefing, voce recebe um gestor dedicado, suporte em tempo real e ajustes de rota sempre que necessario.",
  },
  {
    q: "E possivel personalizar totalmente o roteiro?",
    a: "Sim. Todos os roteiros sao desenhados sob medida conforme perfil, objetivo da viagem e orcamento.",
  },
];

function useLenis(enabled) {
  useEffect(() => {
    if (!enabled || !window.Lenis) return undefined;

    const lenis = new window.Lenis({
      duration: 1.1,
      smoothWheel: true,
      smoothTouch: false,
      wheelMultiplier: 0.9,
    });

    let rafId = 0;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [enabled]);
}

function useLiquidButtons() {
  useEffect(() => {
    if (!window.gsap) return undefined;

    const buttons = Array.from(document.querySelectorAll(".liquid-button"));
    const handlers = [];

    buttons.forEach((button) => {
      const flair = button.querySelector(".button__flair");
      if (!flair) return;

      const onEnter = () => {
        gsap.killTweensOf(flair);
        gsap.fromTo(
          flair,
          { scale: 0.2, xPercent: -20, yPercent: -20 },
          { scale: 1.24, xPercent: 0, yPercent: 0, duration: 0.45, ease: "power3.out" }
        );
      };

      const onMove = (evt) => {
        const rect = button.getBoundingClientRect();
        const x = evt.clientX - rect.left;
        const y = evt.clientY - rect.top;
        gsap.to(flair, {
          x,
          y,
          duration: 0.2,
          ease: "power2.out",
          overwrite: true,
        });
      };

      const onLeave = () => {
        gsap.to(flair, {
          scale: 0,
          duration: 0.35,
          ease: "power3.in",
          overwrite: true,
        });
      };

      button.addEventListener("pointerenter", onEnter);
      button.addEventListener("pointermove", onMove);
      button.addEventListener("pointerleave", onLeave);
      handlers.push({ button, onEnter, onMove, onLeave });
    });

    return () => {
      handlers.forEach(({ button, onEnter, onMove, onLeave }) => {
        button.removeEventListener("pointerenter", onEnter);
        button.removeEventListener("pointermove", onMove);
        button.removeEventListener("pointerleave", onLeave);
      });
    };
  }, []);
}

function useGsapAnimations(enabled) {
  useEffect(() => {
    if (!enabled || !window.gsap || !window.ScrollTrigger) return undefined;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.set(".reveal", { y: 28, opacity: 0 });

      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
      heroTl
        .fromTo(".nav", { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 })
        .fromTo(
          ".hero-tag, .hero-title, .hero-copy, .hero-actions",
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, stagger: 0.08 },
          "-=0.3"
        )
        .fromTo(
          ".hero-media, .floating-badge, .hero-overlay",
          { y: 36, opacity: 0, scale: 0.96 },
          { y: 0, opacity: 1, scale: 1, duration: 0.95, stagger: 0.08 },
          "-=0.5"
        );

      gsap.utils.toArray(".reveal").forEach((el) => {
        gsap.to(el, {
          y: 0,
          opacity: 1,
          duration: 0.72,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 84%",
            once: true,
          },
        });
      });

      gsap.to(".hero-media img", {
        yPercent: -12,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-media",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });

      gsap.to(".gallery-track", {
        x: -260,
        ease: "none",
        scrollTrigger: {
          trigger: ".gallery-track",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });

      gsap.to(".hero-title span", {
        backgroundPositionX: "120%",
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.fromTo(
        ".timeline-item",
        { x: -22, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.14,
          scrollTrigger: {
            trigger: "#servicos",
            start: "top 70%",
          },
        }
      );
    });

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [enabled]);
}

function App() {
  const [reviewIndex, setReviewIndex] = useState(0);
  const [faqOpen, setFaqOpen] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const countersRef = useRef(null);
  const preloaderRef = useRef(null);

  useLenis(isLoaded);
  useGsapAnimations(isLoaded);
  useLiquidButtons();

  useEffect(() => {
    document.body.classList.add("is-loading");

    if (!window.gsap || !preloaderRef.current) {
      setIsLoaded(true);
      document.body.classList.remove("is-loading");
      return undefined;
    }

    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => {
        document.body.classList.remove("is-loading");
        setIsLoaded(true);
      },
    });

    tl.fromTo(
      ".preloader-kicker",
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.55 }
    )
      .fromTo(
        ".preloader-title",
        { opacity: 0, y: 44 },
        { opacity: 1, y: 0, duration: 0.9 },
        "-=0.22"
      )
      .to(".preloader-progress span", { width: "100%", duration: 1.15, ease: "power2.inOut" }, "-=0.35")
      .to(
        ".preloader-ring",
        { scale: 1.14, opacity: 0, duration: 0.72, stagger: 0.06 },
        "-=0.28"
      )
      .to(preloaderRef.current, { autoAlpha: 0, duration: 0.55, pointerEvents: "none" }, "-=0.2");

    return () => {
      tl.kill();
      document.body.classList.remove("is-loading");
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return undefined;

    const timer = setInterval(() => {
      setReviewIndex((prev) => (prev + 1) % REVIEWS.length);
    }, 3600);

    return () => clearInterval(timer);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || !window.gsap || !window.ScrollTrigger || !countersRef.current) return undefined;

    const items = countersRef.current.querySelectorAll("[data-target]");

    items.forEach((el) => {
      const target = Number(el.getAttribute("data-target"));
      const obj = { value: 0 };

      gsap.to(obj, {
        value: target,
        duration: 1.2,
        ease: "power2.out",
        scrollTrigger: {
          trigger: countersRef.current,
          start: "top 82%",
          once: true,
        },
        onUpdate: () => {
          el.textContent = Math.floor(obj.value).toLocaleString("pt-BR");
        },
      });
    });

    return undefined;
  }, [isLoaded]);

  const stats = useMemo(
    () => [
      { value: 94, suffix: "%", label: "clientes renovam no ano seguinte" },
      { value: 56, suffix: "+", label: "paises operados com parceiros premium" },
      { value: 24, suffix: "/7", label: "suporte concierge em viagem" },
      { value: 310, suffix: "+", label: "roteiros de alto padrao concluidos" },
    ],
    []
  );

  return (
    <div className="app">
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <filter id="liquid-goo-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      <div className="preloader" ref={preloaderRef}>
        <span className="preloader-ring r1" />
        <span className="preloader-ring r2" />
        <span className="preloader-ring r3" />
        <div className="preloader-content">
          <p className="preloader-kicker">Aurora Voyages</p>
          <h1 className="preloader-title">Premium Motion</h1>
          <div className="preloader-progress">
            <span />
          </div>
        </div>
      </div>

      <div className="nav-wrap container">
        <header className="nav">
          <a href="#" className="brand">
            <span className="brand-dot"></span>
            Aurora Voyages
          </a>
          <nav className="nav-links">
            <a href="#destinos">Destinos</a>
            <a href="#servicos">Servicos</a>
            <a href="#depoimentos">Depoimentos</a>
            <a href="#faq">FAQ</a>
          </nav>
          <button className="btn btn-dark">Falar com especialista</button>
        </header>
      </div>

      <main>
        <section className="hero container" id="home">
          <div>
            <span className="hero-tag">Travel Intelligence</span>
            <h1 className="hero-title">
              Viagens autorais para quem exige
              <span> excelencia em cada detalhe</span>
            </h1>
            <p className="hero-copy">
              Planejamento estrategico, curadoria de destinos e atendimento concierge para
              experiencias de alto nivel, do briefing ao retorno.
            </p>
            <div className="hero-actions">
              <button className="liquid-button liquid-button--accent">
                <span className="button__label">Montar meu roteiro</span>
                <span className="button__flair"></span>
              </button>
              <button className="btn btn-dark">Ver destinos premium</button>
            </div>
          </div>
          <div className="hero-media">
            <span className="floating-badge">Season 2026</span>
            <img
              src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1600&q=80"
              alt="Estrada cenica para viagem de luxo"
            />
            <div className="hero-overlay">
              <strong>Temporada Aurora 2026</strong>
              <p>Roteiros personalizados para Japao, Islandia, Dolomitas e Polinesia.</p>
            </div>
          </div>
        </section>

        <section className="container" ref={countersRef}>
          <div className="stats">
            {stats.map((item) => (
              <article className="stat reveal" key={item.label}>
                <strong>
                  <span data-target={item.value}>0</span>
                  {item.suffix}
                </strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section container" id="destinos">
          <h2 className="reveal">Destinos selecionados para 2026</h2>
          <p className="sub reveal">
            Curadoria de experiencias com logistica premium, hospedagens de referencia e agenda
            personalizada por perfil de viajante.
          </p>

          <div className="destinations">
            {DESTINATIONS.map((item) => (
              <article className="card reveal" key={item.city}>
                <img src={item.image} alt={item.city} loading="lazy" />
                <div className="card-body">
                  <h3>{item.city}</h3>
                  <p>{item.text}</p>
                  <div className="card-meta">
                    <span>{item.season}</span>
                    <strong>{item.price}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section container" id="servicos">
          <h2 className="reveal">Processo completo de planejamento</h2>
          <p className="sub reveal">
            Framework operacional inspirado no design system extraido: consistencia de ritmo,
            hierarquia e interacao em todas as etapas.
          </p>

          <div className="timeline">
            {[
              ["01", "Briefing executivo", "Mapeamos objetivos, perfil de viagem e nivel de servico esperado."],
              ["02", "Arquitetura do roteiro", "Desenhamos experiencias, deslocamentos e reservas com inteligencia de agenda."],
              ["03", "Operacao assistida", "Suporte ativo antes e durante a viagem com ajustes em tempo real."],
            ].map(([step, title, desc]) => (
              <article className="timeline-item" key={step}>
                <span className="step">{step}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section container split" id="depoimentos">
          <div>
            <h2 className="reveal">Depoimentos e confianca</h2>
            <p className="sub reveal">
              Clientes corporativos e familias high-end confiam na Aurora para viagens sem
              friccao e com excelencia operacional.
            </p>
            <div className="reviews reveal">
              {REVIEWS.map((r, index) => (
                <article className={`review ${reviewIndex === index ? "active" : ""}`} key={r.name}>
                  <p>"{r.quote}"</p>
                  <strong>{r.name}</strong>
                  <span>{r.role}</span>
                </article>
              ))}
            </div>
          </div>

          <div id="faq">
            <h2 className="reveal">Perguntas frequentes</h2>
            <div className="reveal">
              {FAQ.map((item, index) => (
                <article className={`faq-item ${faqOpen === index ? "open" : ""}`} key={item.q}>
                  <button className="faq-header" onClick={() => setFaqOpen((prev) => (prev === index ? -1 : index))}>
                    {item.q}
                  </button>
                  <div className="faq-body">
                    <p>{item.a}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section container">
          <h2 className="reveal">Galeria de inspiracao</h2>
          <p className="sub reveal">
            Sequencia visual animada para validar extracao de motion e comportamento em trilha horizontal.
          </p>
          <div className="gallery-track reveal">
            {[
              "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80",
            ].map((src, i) => (
              <img key={i} src={src} alt={`Travel ${i + 1}`} loading="lazy" />
            ))}
          </div>
        </section>

        <section className="container cta reveal">
          <h2>Seu proximo destino comeca com estrategia</h2>
          <p>
            Solicite uma proposta personalizada com foco em conforto, eficiencia e experiencias
            memoraveis para lazer ou negocios.
          </p>
          <button className="liquid-button liquid-button--accent">
            <span className="button__label">Solicitar proposta premium</span>
            <span className="button__flair"></span>
          </button>
        </section>
      </main>

      <footer className="container footer">
        <p>(c) 2026 Aurora Voyages. Premium Travel Design.</p>
        <p>hello@auroravoyages.com</p>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

