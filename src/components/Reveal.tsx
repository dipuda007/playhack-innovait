"use client";

import { useEffect } from "react";

/**
 * Scroll reveal, as one document-wide observer.
 *
 * The alternative — a <Reveal> wrapper component around every block — turns
 * every server component that wants to animate into a client component, and
 * ships a closure per element. This mounts once in the layout, watches the
 * whole document, and lets any page opt in from plain server-rendered markup
 * by writing `data-reveal` on an element. Stagger comes from a CSS variable
 * on the element itself:
 *
 *     <div data-reveal style={{ "--reveal-delay": "120ms" }}>
 *
 * The hidden start state is defined in globals.css behind
 * [data-reveal-ready], which is set here. That ordering matters: if the
 * attribute is never set — JavaScript off, script blocked, hydration failed —
 * the content is simply visible. An animation is not allowed to be the reason
 * a page is blank.
 */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    root.setAttribute("data-reveal-ready", "");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = "true";
          // Reveal is one-way. Re-hiding on scroll-up is a novelty that makes
          // a long page feel unstable and breaks find-in-page.
          observer.unobserve(entry.target);
        }
      },
      // Fire slightly before the element reaches the viewport edge, so the
      // motion has finished by the time it is properly in view.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );

    const claim = (node: ParentNode) => {
      for (const el of node.querySelectorAll<HTMLElement>(
        "[data-reveal]:not([data-shown])",
      )) {
        // Anything already on screen at mount is shown immediately rather
        // than animated: the reader did not scroll to it, so there is
        // nothing to acknowledge.
        const box = el.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) {
          el.dataset.shown = "true";
        } else {
          observer.observe(el);
        }
      }
    };

    claim(document);

    // Client-side navigation swaps the tree without remounting this effect.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) claim(node as Element);
        }
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      root.removeAttribute("data-reveal-ready");
    };
  }, []);

  return null;
}
