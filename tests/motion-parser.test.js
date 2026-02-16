import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMotionScriptText } from "../lib/extractors.js";

test("analyzeMotionScriptText detects libraries, recipes and timings", () => {
  const script = `
    const lenis = new Lenis({ duration: 1.2 });
    gsap.registerPlugin(ScrollTrigger);
    const tl = gsap.timeline({ defaults: { ease: 'ease-out', duration: 0.25 } });
    tl.from('.loader', { opacity: 0, duration: 1s });
    requestAnimationFrame(() => {});
  `;

  const result = analyzeMotionScriptText(script, "https://acme.com/_nuxt/app.js");

  assert.equal(result.libraries.includes("lenis"), true);
  assert.equal(result.libraries.includes("gsap"), true);
  assert.equal(result.libraries.includes("scrolltrigger"), true);
  assert.equal(result.runtimeSignals.includes("script:requestAnimationFrame"), true);
  assert.equal(result.recipes.some((r) => r.name === "preloader-sequence"), true);
  assert.equal(result.recipes.some((r) => r.name === "smooth-scroll"), true);
  assert.equal(result.durations.includes("0.25"), false);
  assert.equal(result.durations.includes("1s"), true);
  assert.equal(result.shouldCapture, true);
});

