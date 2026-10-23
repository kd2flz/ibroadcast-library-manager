import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("Copy failed.");
  }
}

export function CopyButton({
  text,
  label = "Copy",
  className = "button button-ghost button-small",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await copyText(text);
          setCopied(true);
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
          }
          timerRef.current = window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
      {copied ? "Copied" : label}
    </button>
  );
}
