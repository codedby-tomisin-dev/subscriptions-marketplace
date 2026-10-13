import { Fragment } from "react";
import styles from "./AnimatedHeadline.module.css";

const UNDERLINE_PATH = "M6 26 C 60 14, 140 12, 210 16 S 286 22, 294 18";

/**
 * Reveals the headline word by word. With four or more words, the last two
 * drop to their own line and get a hand-drawn underline.
 */
export function AnimatedHeadline({ text }: { text: string }) {
  const words = text.split(" ");
  const renderWord = (word: string, index: number) => (
    <span className={styles.word} style={{ animationDelay: `${80 + index * 90}ms` }}>
      {word}
    </span>
  );
  const renderRun = (run: string[], startIndex = 0) =>
    run.map((word, i) => (
      <Fragment key={startIndex + i}>
        {renderWord(word, startIndex + i)}
        {i < run.length - 1 && " "}
      </Fragment>
    ));

  if (words.length < 4) return <>{renderRun(words)}</>;

  const lead = words.slice(0, -2);
  return (
    <>
      {renderRun(lead)}
      <br />
      <span className={styles.mark}>
        {renderRun(words.slice(-2), lead.length)}
        <svg viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength={1} style={{ animationDelay: `${280 + words.length * 90}ms` }} d={UNDERLINE_PATH} />
        </svg>
      </span>
    </>
  );
}
