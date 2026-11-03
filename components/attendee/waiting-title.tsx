"use client";

import * as React from "react";
import { fitLine } from "@/lib/client/fit-line";

/** Below this an event name is hard to read on a phone, so it wraps instead. */
const MIN_NAME_SCALE = 0.4;
/** Space kept between the end of the name and Min, in em of the title. */
const NAME_GAP_EM = 0.15;

/**
 * "Best Dressed" with Min peeking over the highlight, and a pending event's
 * name above it as part of the title. The name gets the width of "Best
 * Dressed" up to where Min stands, so it never runs wider than the title and
 * Min never covers its letters: it shrinks to fit that space, and only wraps
 * once it reaches MIN_NAME_SCALE.
 */
export function WaitingTitle({
  eventName,
}: {
  eventName: string | null;
}): React.JSX.Element {
  const nameRef = React.useRef<HTMLSpanElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const bestDressedRef = React.useRef<HTMLSpanElement>(null);
  const minRef = React.useRef<HTMLImageElement>(null);

  // A layout effect, so the first paint already fits. The fit depends on
  // measured widths, which change with the screen size and once Poppins has
  // loaded, so the styles are set directly on the node.
  React.useLayoutEffect(() => {
    const name = nameRef.current;
    const measure = measureRef.current;
    const bestDressed = bestDressedRef.current;
    const min = minRef.current;
    if (!name || !measure || !bestDressed || !min) return;
    let active = true;
    const fit = () => {
      if (!active) return;
      const em = parseFloat(getComputedStyle(bestDressed).fontSize);
      const space =
        min.getBoundingClientRect().left -
        bestDressed.getBoundingClientRect().left -
        NAME_GAP_EM * em;
      const { scale, wrap } = fitLine(
        measure.getBoundingClientRect().width,
        space,
        MIN_NAME_SCALE
      );
      name.style.fontSize = `${scale}em`;
      name.style.whiteSpace = wrap ? "normal" : "nowrap";
      name.style.width = `${space}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(bestDressed);
    void document.fonts.ready.then(fit);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [eventName]);

  return (
    <h1 className="relative mt-6 max-w-full text-[clamp(2.5rem,5.5vw+1.25rem,4.5rem)] leading-none font-extrabold tracking-tight">
      {eventName && (
        <>
          {/* Never shown: the name at full size on one line, for measuring. */}
          <span
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap"
          >
            {eventName}
          </span>
          {/* Starts at the left edge of "Best", left aligned, and ends just
              before Min. */}
          <span
            ref={nameRef}
            className="mb-4 block text-left text-balance whitespace-nowrap wrap-break-word"
          >
            {eventName}
          </span>
        </>
      )}
      <span ref={bestDressedRef} className="inline-block whitespace-nowrap">
        Best{" "}
        <span className="relative isolate inline-block">
          {/* Min peeks over the top edge of the highlight from behind it. A
              fixed square size, so he can be measured before the image loads. */}
          <img
            ref={minRef}
            src="/mascots/min-artist.svg"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute -right-[0.15em] bottom-[calc(100%_-_0.25em)] -z-10 size-[1.55em] max-w-none rotate-15 select-none"
          />
          {/* A ring in the page colour outlines the box where it covers Min. */}
          <span className="inline-block rounded-tag bg-primary px-2 py-0.5 text-primary-foreground ring-4 ring-background">
            Dressed
          </span>
        </span>
      </span>
    </h1>
  );
}
