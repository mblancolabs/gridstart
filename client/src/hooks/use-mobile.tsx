import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
    } else {
      mql.addListener(onChange);
    }

    window.addEventListener("resize", onChange);
    onChange();

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange);
      } else {
        mql.removeListener(onChange);
      }
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return !!isMobile;
}
