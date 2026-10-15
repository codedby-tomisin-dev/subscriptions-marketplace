"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import clsx from "clsx";
import { ArrowLeft, Check, RefreshCw, Sparkles } from "lucide-react";
import { Button, Dialog, Input, Tag, useToast } from "@/components/ui";
import { describeError } from "@/shared/api";
import { generateListing, suggestAngles, type ExperienceAngle, type GeneratedListing, type ListingSource } from "./api";
import styles from "./BoxEditor.module.css";

const EXAMPLES = ["Breakfast", "Pet care", "Plant lovers", "Coffee nerds", "Rainy-day crafts"];
/** The "write my own" choice in the list of angles. */
const OWN = -1;

interface GenerateListingDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerated: (listing: GeneratedListing, sources: ListingSource[]) => void;
}

/**
 * Generate with AI, experience first: an idea ("breakfast") becomes a few specific experiences
 * ("a breakfast from a different country, every month"), and the box is drafted around the one picked.
 */
export function GenerateListingDialog({ open, onClose, onGenerated }: GenerateListingDialogProps) {
  const { showToast } = useToast();
  const [idea, setIdea] = useState("");
  const [angles, setAngles] = useState<ExperienceAngle[] | null>(null);
  const [picked, setPicked] = useState(0);
  const [ownAngle, setOwnAngle] = useState("");
  const [busy, setBusy] = useState<"angles" | "drafting" | null>(null);

  const reset = () => {
    setIdea("");
    setAngles(null);
    setPicked(0);
    setOwnAngle("");
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const findAngles = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!idea.trim() || busy) return;
    setBusy("angles");
    try {
      const result = await suggestAngles(idea);
      setAngles(result.angles);
      setPicked(0);
    } catch (error) {
      showToast({ tone: "danger", title: "Couldn’t come up with experiences", message: describeError(error) });
    } finally {
      setBusy(null);
    }
  };

  const chosenAngle = picked === OWN ? ownAngle.trim() : angles && angles[picked] ? `${angles[picked].title}. ${angles[picked].promise}` : "";

  const draft = async () => {
    if (!chosenAngle || busy) return;
    setBusy("drafting");
    try {
      const { listing, sources } = await generateListing(idea, chosenAngle);
      onGenerated(listing, sources);
      showToast({
        tone: "success",
        title: `${listing.name} drafted`,
        message: `${sources.length ? `Researched ${sources.length} source${sources.length > 1 ? "s" : ""}. ` : ""}Its illustration is being drawn now. Check it over, then create the box.`,
      });
      reset();
      onClose();
    } catch (error) {
      showToast({ tone: "danger", title: "Couldn’t draft that box", message: describeError(error) });
    } finally {
      setBusy(null);
    }
  };

  if (!angles) {
    return (
      <Dialog
        open={open}
        onClose={close}
        width={520}
        title="Generate a box"
        description="Start with a rough idea. We’ll suggest a few specific experiences a box could deliver, then draft the one you pick. Nothing is saved until you create the box."
      >
        <form onSubmit={findAngles} className={styles.generate}>
          <Input label="What’s the idea?" value={idea} onChange={setIdea} placeholder="Breakfast" autoFocus disabled={!!busy} />
          <div className={styles.examples} aria-label="Examples">
            {EXAMPLES.map((example) => (
              <Tag key={example} selected={idea === example} onClick={() => !busy && setIdea(example)}>
                {example}
              </Tag>
            ))}
          </div>
          <div className={styles.generateFooter}>
            {busy && (
              <span className={styles.note} role="status">
                Thinking up experiences. About ten seconds.
              </span>
            )}
            <Button type="submit" iconLeft={Sparkles} loading={busy === "angles"} disabled={!idea.trim()}>
              Find experiences
            </Button>
          </div>
        </form>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      width={600}
      title="Pick the experience"
      description={`People pay for an experience, not a category. Pick the one to build the “${idea.trim()}” box around, or describe your own.`}
    >
      <div className={styles.generate}>
        <div role="radiogroup" aria-label="Experiences" className={styles.angles}>
          {angles.map((angle, index) => (
            <AngleOption key={angle.title} selected={picked === index} onSelect={() => !busy && setPicked(index)}>
              <b className={styles.angleTitle}>{angle.title}</b>
              <span className={styles.anglePromise}>{angle.promise}</span>
              <span className={styles.angleWhy}>{angle.why}</span>
            </AngleOption>
          ))}
          <AngleOption selected={picked === OWN} onSelect={() => !busy && setPicked(OWN)}>
            <b className={styles.angleTitle}>Something else</b>
            {picked === OWN ? (
              <Input
                ariaLabel="Describe the experience"
                value={ownAngle}
                onChange={setOwnAngle}
                placeholder="A new British cheese and its perfect pairing, every month"
                autoFocus
                disabled={!!busy}
              />
            ) : (
              <span className={styles.anglePromise}>Describe the experience yourself.</span>
            )}
          </AngleOption>
        </div>
        <div className={styles.generateFooter}>
          {busy && (
            <span className={styles.note} role="status">
              {busy === "drafting" ? "Researching and writing. This usually takes under a minute." : "Thinking up more experiences."}
            </span>
          )}
          <Button variant="ghost" iconLeft={ArrowLeft} onClick={() => setAngles(null)} disabled={!!busy}>
            Back
          </Button>
          <Button variant="secondary" iconLeft={RefreshCw} onClick={() => findAngles()} loading={busy === "angles"} disabled={busy === "drafting"}>
            More ideas
          </Button>
          <Button iconLeft={Sparkles} onClick={draft} loading={busy === "drafting"} disabled={!chosenAngle || busy === "angles"}>
            Draft this box
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function AngleOption({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={clsx(styles.angle, selected && styles.angleSelected)}
    >
      <span className={styles.angleRadio} aria-hidden>
        {selected && <Check size={12} strokeWidth={3} />}
      </span>
      <span className={styles.angleBody}>{children}</span>
    </div>
  );
}
