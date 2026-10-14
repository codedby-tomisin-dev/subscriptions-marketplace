"use client";

import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { Button, Dialog, Input, Tag, useToast } from "@/components/ui";
import { describeError } from "@/shared/api";
import { generateListing, type GeneratedListing, type ListingSource } from "./api";
import styles from "./BoxEditor.module.css";

const EXAMPLES = ["Pet care", "Plant lovers", "New parents", "Coffee nerds", "Rainy-day crafts"];

interface GenerateListingDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerated: (listing: GeneratedListing, sources: ListingSource[]) => void;
}

/** Asks for an idea and has the listing agent draft the whole box from it. */
export function GenerateListingDialog({ open, onClose, onGenerated }: GenerateListingDialogProps) {
  const { showToast } = useToast();
  const [idea, setIdea] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (!idea.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const { listing, sources } = await generateListing(idea);
      onGenerated(listing, sources);
      showToast({
        tone: "success",
        title: `${listing.name} drafted`,
        message: `${sources.length ? `Researched ${sources.length} source${sources.length > 1 ? "s" : ""}. ` : ""}Its illustration is being drawn now. Check it over, then create the box.`,
      });
      setIdea("");
      onClose();
    } catch (error) {
      showToast({ tone: "danger", title: "Couldn’t draft that box", message: describeError(error) });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isGenerating ? () => {} : onClose}
      width={520}
      title="Generate a box"
      description="Describe the idea in a few words. We’ll research it and draft everything: name, story, prices, highlights, the ritual and what goes in it. Nothing is saved until you create the box."
    >
      <form onSubmit={generate} className={styles.generate}>
        <Input label="What’s the idea?" value={idea} onChange={setIdea} placeholder="Pet care" autoFocus disabled={isGenerating} />
        <div className={styles.examples} aria-label="Examples">
          {EXAMPLES.map((example) => (
            <Tag key={example} selected={idea === example} onClick={() => !isGenerating && setIdea(example)}>
              {example}
            </Tag>
          ))}
        </div>
        <div className={styles.generateFooter}>
          {isGenerating && (
            <span className={styles.note} role="status">
              Researching and writing. This usually takes under a minute.
            </span>
          )}
          <Button type="submit" iconLeft={Sparkles} loading={isGenerating} disabled={!idea.trim()}>
            Generate
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
