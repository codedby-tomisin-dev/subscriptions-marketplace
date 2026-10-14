import type { CSSProperties } from "react";
import { Quote } from "lucide-react";
import { Card, ProductImage } from "@/components/ui";
import { BoxTile, isCadence, type Box, type PurchaseOption } from "@/features/catalog";
import { InfoAccordion } from "./InfoAccordion";
import styles from "./BoxDetail.module.css";

/** Each ritual card leans and drops a little differently, like snapshots laid on a table. */
const RITUAL_TILTS = ["-3deg", "2.2deg", "-1.4deg"];
const RITUAL_DROPS = ["0px", "72px", "20px"];
const NUMBER_WORDS = ["", "One small moment", "Two small moments", "Three small moments", "Four small moments", "Five small moments"];

export function RitualSection({ box }: { box: Box }) {
  if (!box.ritual.length) return null;
  const moments = NUMBER_WORDS[box.ritual.length] ?? "A few small moments";
  return (
    <section aria-label="The ritual" className={`${styles.section} ${styles.ritual}`}>
      <p className={styles.ritualIntro}>{moments}, the same lovely way, every time it lands on your doormat.</p>
      <ol className={styles.ritualRow}>
        {box.ritual.map((step, index) => (
          <li
            key={step.title}
            className={styles.ritualCard}
            style={{ "--tilt": RITUAL_TILTS[index % 3], "--drop": RITUAL_DROPS[index % 3] } as CSSProperties}
          >
            <span className={styles.ritualNumber} style={{ WebkitTextStrokeColor: `var(--${box.tone}-500, var(--blush-500))` }} aria-hidden>
              {index + 1}
            </span>
            <ProductImage tone={box.tone} ratio="4 / 3" radius="6px" label={step.title} />
            <h3 className={styles.ritualTitle}>{step.title}</h3>
            <p className={styles.ritualBody}>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ContentsSection({ box }: { box: Box }) {
  if (!box.contents.length) return null;
  return (
    <section className={styles.section}>
      <div className={styles.contentsHead}>
        <div className={styles.sectionTitle}>
          <span className="bb-eyebrow">What’s inside</span>
          <h2 className="bb-heading">A typical full box.</h2>
        </div>
        <p className={styles.contentsNote}>
          Contents change every delivery, so you’ll never get the same thing twice. Always this good, though.
        </p>
      </div>
      <ul className={styles.contents}>
        {box.contents.map((item) => (
          <li key={item.name} className={styles.item}>
            <ProductImage tone={item.tone} ratio="4 / 5" radius="var(--radius-xl)" label={item.name} />
            <div>
              <div className={styles.itemName}>{item.name}</div>
              <div className={styles.itemDescription}>{item.description}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const DELIVERY_RHYTHM: Record<PurchaseOption, string> = {
  week: "Weekly boxes arrive on the same weekday each week. Change the day anytime.",
  month: "Monthly boxes arrive around the same date each month. Change the day anytime.",
  once: "It arrives on the day you pick, and that’s it: nothing else is charged or sent.",
};

function goodToKnow(box: Box, option: PurchaseOption) {
  const changing = isCadence(option)
    ? {
        title: "Changing or cancelling",
        body: "Switch between weekly and monthly, skip a delivery or cancel from your account. Changes made 3 days before shipping apply to the next box.",
      }
    : { title: "No subscription", body: "A one-off box is just that. Loved it? You can subscribe from this page anytime." };
  return [
    {
      title: "What’s in it",
      body: `${box.planNotes[option] ?? ""}. Each box is a mix of the things above — curated, never random, and always full-size.`,
    },
    {
      title: "Delivery",
      body: `Free tracked delivery in 2–3 days. ${DELIVERY_RHYTHM[option]}`,
    },
    {
      title: "Gifting",
      body: "Flip “It’s a gift” and we’ll hide the price and tuck in a handwritten card.",
    },
    changing,
  ];
}

/** FAQ that follows the option picked in the buy panel. */
export function GoodToKnowSection({ box, option }: { box: Box; option: PurchaseOption }) {
  return (
    <section className={`${styles.section} ${styles.goodToKnow}`}>
      <h2 className="bb-heading" style={{ font: "var(--type-h2)" }}>
        Good to know.
      </h2>
      <InfoAccordion items={goodToKnow(box, option)} />
    </section>
  );
}

export function TestimonialSection({ box }: { box: Box }) {
  if (!box.testimonial) return null;
  return (
    <section className={styles.section}>
      <Card tone="ink" elevation="none" className={styles.testimonial}>
        <figure className={styles.testimonialBody}>
          <Quote size={28} color="var(--blush-300)" aria-hidden />
          <blockquote className={styles.quote}>{box.testimonial.quote}</blockquote>
          <figcaption className={styles.attribution}>{box.testimonial.attribution}</figcaption>
        </figure>
      </Card>
    </section>
  );
}

export function OtherBoxesSection({ boxes }: { boxes: Box[] }) {
  if (!boxes.length) return null;
  return (
    <section className={`bb-container ${styles.othersSection}`}>
      <div className={styles.othersInner}>
        <h2 className={styles.othersTitle}>Or try another box</h2>
        <div className={styles.others}>
          {boxes.map((box, index) => (
            <BoxTile key={box.id} box={box} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
