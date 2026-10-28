// Eats N More: small, dependency-free enhancements.
(() => {
  const root = document.documentElement;
  root.classList.add("js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = matchMedia("(max-width: 760px)");
  const PHONE_NUMBER = "2348129415223";

  // Hero entrance once fonts are in (with a timeout so it never waits long)
  const start = () => requestAnimationFrame(() => root.classList.add("is-loaded"));
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 900))]).then(start);

  // Hero ring: pointing at a frame swaps the line under the headline for its caption
  const sub = document.querySelector(".core-sub");
  const subDefault = sub ? sub.innerHTML : "";
  document.querySelectorAll(".frame").forEach(f => {
    const show = () => { sub.innerHTML = `<span class="core-caption">${f.dataset.caption}</span>`; };
    const hide = () => { sub.innerHTML = subDefault; };
    f.addEventListener("pointerenter", show);
    f.addEventListener("focus", show);
    f.addEventListener("pointerleave", hide);
    f.addEventListener("blur", hide);
  });

  // Section entrances: heading, then text, then picture
  document.querySelectorAll(".reveal-group").forEach(g => [...g.children].forEach((c, i) => c.style.setProperty("--d", i)));
  document.querySelectorAll("section").forEach(s => s.querySelectorAll(".reveal").forEach((el, i) => el.style.setProperty("--d", i)));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -12% 0px" });
  document.querySelectorAll(".reveal, .reveal-group, .reveal-pic").forEach(el => io.observe(el));

  // Full-bleed photographs settle from a slight zoom as they arrive
  const drift = new IntersectionObserver(entries => {
    entries.forEach(e => e.target.style.setProperty("--drift", e.isIntersecting ? 1 : 1.08));
  }, { threshold: 0.25 });
  if (!reduce) document.querySelectorAll(".frame-bleed").forEach(el => drift.observe(el));

  // Grill video: only fetched when its frame is near, skipped on Save-Data and reduced motion
  const video = document.querySelector(".fb-video");
  const saveData = navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || ""));
  if (video && !reduce && !saveData) {
    const vio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          if (!video.src) {
            video.src = phone.matches ? video.dataset.srcSm : video.dataset.srcLg;
            video.addEventListener("canplay", () => video.classList.add("is-ready"), { once: true });
          }
          video.play().catch(() => {});
        } else if (video.src) {
          video.pause();
        }
      });
    }, { rootMargin: "200px 0px" });
    vio.observe(video.closest(".frame-bleed"));
  }

  // Kitchen: the row nearest the middle of the screen (or the one pointed at) is active
  const dishes = [...document.querySelectorAll(".dish")];
  const pics = [...document.querySelectorAll(".k-photo img")];
  let current = 0;
  const activate = i => {
    if (i === current) return;
    current = i;
    dishes.forEach((d, j) => {
      d.classList.toggle("is-on", j === i);
      d.querySelector("button").setAttribute("aria-expanded", j === i);
    });
    pics.forEach(p => p.classList.toggle("is-on", +p.dataset.k === +dishes[i].dataset.k));
  };
  dishes.forEach((d, i) => {
    const b = d.querySelector("button");
    b.addEventListener("click", () => activate(i));
    b.addEventListener("focus", () => activate(i));
    b.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") activate(i); });
  });
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const list = document.querySelector(".dishes");
      if (!list) return;
      const r = list.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const target = innerHeight * 0.5;
      let best = 0, bestD = Infinity;
      dishes.forEach((d, i) => {
        const b = d.querySelector("button").getBoundingClientRect();
        const dist = Math.abs(b.top + b.height / 2 - target);
        if (dist < bestD) { bestD = dist; best = i; }
      });
      activate(best);
    });
  };
  addEventListener("scroll", onScroll, { passive: true });

  // Open now? Worked out in Benin City time (West Africa Time, UTC+1)
  const OPEN = 8 * 60, CLOSE = 22 * 60;
  const lagosNow = () => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const get = t => +parts.find(p => p.type === t).value;
    return get("hour") * 60 + get("minute");
  };
  const fmt = m => { const h = Math.floor(m / 60), mm = m % 60, h12 = ((h + 11) % 12) + 1; return `${h12}${mm ? ":" + String(mm).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`; };
  const updateStatus = () => {
    const now = lagosNow();
    let text, cls;
    if (now >= OPEN && now < CLOSE) {
      const left = CLOSE - now;
      text = left <= 60 ? `Open now, closing at ${fmt(CLOSE)}` : `Open now, until ${fmt(CLOSE)}`;
      cls = left <= 60 ? "is-soon" : "is-open";
    } else {
      text = `Closed now, opens at ${fmt(OPEN)}`;
      cls = "";
    }
    document.querySelectorAll("[data-status]").forEach(s => {
      s.classList.remove("is-open", "is-soon");
      if (cls) s.classList.add(cls);
      s.querySelector("[data-status-text]").textContent = text;
    });
  };
  updateStatus();
  setInterval(updateStatus, 60000);

  // Reservation composer: writes the WhatsApp message live
  const form = document.getElementById("r-form");
  if (form) {
    const slip = form.querySelector("[data-slip]");
    const guestsOut = form.querySelector("[data-guests]");
    const timeWrap = form.querySelector("[data-time-wrap]");
    const guestsWrap = form.querySelector("[data-guests-wrap]");
    const dateLabel = form.querySelector("[data-date-label]");
    const dateIn = form.elements.date;
    let guests = 2;

    const todayISO = () => {
      const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
      return p; // YYYY-MM-DD
    };
    dateIn.value = todayISO();
    dateIn.min = todayISO();

    const niceDate = iso => {
      if (!iso) return "";
      if (iso === todayISO()) return "today";
      const d = new Date(iso + "T12:00:00");
      return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    };
    const niceTime = t => {
      if (!t) return "";
      const [h, m] = t.split(":").map(Number);
      return fmt(h * 60 + m);
    };
    const greeting = () => { const h = Math.floor(lagosNow() / 60); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

    const compose = () => {
      const kind = form.elements.kind.value;
      const date = niceDate(dateIn.value);
      const time = niceTime(form.elements.time.value);
      const name = form.elements.name.value.trim();
      const note = form.elements.note.value.trim();
      const people = `${guests} ${guests === 1 ? "person" : "people"}`;
      const when = [date, time && `at ${time}`].filter(Boolean).join(" ");
      let ask;
      switch (kind) {
        case "Lounge": ask = `I'd like to reserve the lounge for ${people}, ${when}.`; break;
        case "Room": ask = `I'd like a room in the guesthouse for ${guests === 1 ? "1 guest" : guests + " guests"}, checking in ${date}. What are your rates?`; break;
        case "Takeaway": ask = `I'd like to place a takeaway order for ${when}. Please send me today's menu and prices.`; break;
        default: ask = `I'd like to reserve a table for ${people}, ${when}.`;
      }
      const parts = [`${greeting()}, Eats N More.`, ask];
      if (note) parts.push(note.endsWith(".") ? note : note + ".");
      if (name) parts.push(`My name is ${name}.`);
      return parts.join(" ");
    };

    const render = () => {
      const kind = form.elements.kind.value;
      timeWrap.classList.toggle("is-hidden", kind === "Room");
      dateLabel.textContent = kind === "Room" ? "Check-in date" : "Date";
      guestsWrap.querySelector("#guests-label").textContent = kind === "Takeaway" ? "Portions" : "Guests";
      slip.textContent = compose();
      if (!reduce) { slip.classList.remove("is-updating"); void slip.offsetWidth; slip.classList.add("is-updating"); }
    };

    form.addEventListener("input", render);
    form.addEventListener("change", render);
    form.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => {
      guests = Math.min(30, Math.max(1, guests + +b.dataset.step));
      guestsOut.value = guests;
      guestsOut.textContent = guests;
      render();
    }));
    form.addEventListener("submit", e => {
      e.preventDefault();
      window.open(`https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(compose())}`, "_blank", "noopener");
    });

    // Buttons elsewhere ("Book a table", "Reserve the lounge"…) preselect the right option
    document.querySelectorAll("[data-pick]").forEach(a => a.addEventListener("click", () => {
      const r = form.querySelector(`input[name="kind"][value="${a.dataset.pick}"]`);
      if (r) { r.checked = true; render(); }
    }));
    render();
  }

  // Phone dock appears once the hero has scrolled away
  const dock = document.querySelector(".dock");
  const hero = document.querySelector(".hero");
  if (dock && hero) {
    new IntersectionObserver(([e]) => dock.classList.toggle("is-shown", !e.isIntersecting), { threshold: 0.15 }).observe(hero);
  }

  const y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
