"use client";

import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import styles from "./InfoAccordion.module.css";

export interface AccordionItem {
  title: string;
  body: string;
}

/** Single-open accordion; the first item starts expanded. */
export function InfoAccordion({ items }: { items: AccordionItem[] }) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `${baseId}-${index}`;
        return (
          <div key={item.title} className={styles.accordionItem}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className={styles.accordionButton}
            >
              <span>{item.title}</span>
              {isOpen ? <Minus size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
            </button>
            {isOpen && (
              <div id={panelId} className={styles.accordionPanel}>
                {item.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
