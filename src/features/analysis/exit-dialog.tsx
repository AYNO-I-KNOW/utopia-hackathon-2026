"use client";
import { copy } from "@/content";
import { useEffect, useState } from "react";

/** Confirm leaving a recording; Escape keeps recording and focus returns to the opener. */
export function ExitDialog({
  onContinue,
  onExit,
}: {
  onContinue: () => void;
  onExit: () => void;
}) {
  // Read before commit: autoFocus below moves focus into the dialog.
  const [opener] = useState(() => document.activeElement);
  useEffect(() => {
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [opener]);
  return (
    <div className="overlay">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-title"
        onKeyDown={(event) => event.key === "Escape" && onContinue()}
      >
        <h2 id="exit-title">{copy.exitRecordingTitle}</h2>
        <p>{copy.discardAudio}</p>
        <div className="actions">
          <button autoFocus onClick={onContinue}>
            {copy.continueRecording}
          </button>
          <button className="primary" onClick={onExit}>
            {copy.exitRecording}
          </button>
        </div>
      </div>
    </div>
  );
}
