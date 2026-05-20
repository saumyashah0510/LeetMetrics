import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const el = cursorRef.current;

    const onMove = (e) => {
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };

    const onOver = (e) => {
      if (e.target.closest("a, button, input, textarea, label, select, [role='button']")) {
        el.classList.add("is-hovering");
      } else {
        el.classList.remove("is-hovering");
      }
    };

    const onDown = () => el.classList.add("is-clicking");
    const onUp   = () => el.classList.remove("is-clicking");

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup",   onUp);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup",   onUp);
    };
  }, []);

  return <div ref={cursorRef} className="cursor-dot" aria-hidden="true" />;
}
