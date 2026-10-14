"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Archive, ArrowLeft, ArchiveRestore, ExternalLink, ImageUp, Save, Sparkles, X } from "lucide-react";
import { Badge, Button, Input, ProductImage, Select, TextArea } from "@/components/ui";
import { BOX_ICON_NAMES, BoxIcon, type BoxItem } from "@/features/catalog";
import { toneSurface } from "@/shared/types";
import { AdminPageHeader, AdminPanel, ReportState } from "../shared";
import type { ListingSource } from "./api";
import { TONES, type BoxDraft } from "./boxDraft";
import { GenerateListingDialog } from "./GenerateListingDialog";
import { PlansPanel } from "./PlansPanel";
import { RowList } from "./RowList";
import { useBoxEditor } from "./useBoxEditor";
import styles from "./BoxEditor.module.css";

const ICON_OPTIONS = BOX_ICON_NAMES.map((name) => ({ value: name, label: name.replace(/([a-z])([A-Z0-9])/g, "$1 $2") }));
const MAX_FACTS = 4;

interface BoxEditorContainerProps {
  boxId: string | null;
  /** Open the "Generate a box" modal straight away (from Boxes & stock). */
  startGenerating?: boolean;
}

export function BoxEditorContainer({ boxId, startGenerating = false }: BoxEditorContainerProps) {
  const editor = useBoxEditor(boxId);
  const [isGenerateOpen, setIsGenerateOpen] = useState(startGenerating && !boxId);

  if (editor.notFound) return <ReportState error="There’s no box with that id." />;
  if (!editor.draft) return <ReportState error={null} />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    editor.save();
  };

  return (
    <>
      <form onSubmit={submit}>
        <AdminPageHeader
          title={boxId ? editor.draft.name || "Untitled box" : "New box"}
          subtitle={boxId ? "Changes show on the storefront within a minute." : "Everything the box page shows, plus what goes in it."}
        >
          <Button variant="ghost" size="sm" iconLeft={ArrowLeft} href="/admin/stock">
            Boxes & stock
          </Button>
          {editor.existing && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={editor.existing.status === "active" ? Archive : ArchiveRestore}
              onClick={editor.toggleArchived}
            >
              {editor.existing.status === "active" ? "Archive" : "Put back on sale"}
            </Button>
          )}
          {!boxId && (
            <Button variant="secondary" size="sm" iconLeft={Sparkles} onClick={() => setIsGenerateOpen(true)}>
              Generate with AI
            </Button>
          )}
          <Button type="submit" size="sm" iconLeft={Save} loading={editor.isSaving}>
            {boxId ? "Save changes" : "Create box"}
          </Button>
        </AdminPageHeader>

        <BoxEditorFields
          draft={editor.draft}
          update={editor.update}
          onPhoto={editor.uploadPhoto}
          isUploading={editor.isUploading}
          sources={editor.sources}
          onDraw={editor.drawIllustration}
          isDrawing={editor.isDrawing}
        />
      </form>
      {/* Outside the form: React submit events bubble through portals, and this one mustn't save the box. */}
      <GenerateListingDialog open={isGenerateOpen} onClose={() => setIsGenerateOpen(false)} onGenerated={editor.applyListing} />
    </>
  );
}

interface FieldsProps {
  draft: BoxDraft;
  update: (patch: Partial<BoxDraft>) => void;
  onPhoto: (file: File) => void;
  isUploading: boolean;
  /** Pages the listing agent read for the current draft. */
  sources: ListingSource[];
  onDraw: () => void;
  isDrawing: boolean;
}

function BoxEditorFields({ draft, update, onPhoto, isUploading, sources, onDraw, isDrawing }: FieldsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onPhoto(file);
    event.target.value = "";
  };

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <AdminPanel title="Basics">
          <div className={styles.grid2}>
            <Input label="Name" value={draft.name} onChange={(name) => update({ name })} placeholder="Reading nook" required />
            <Input label="Who it’s for" value={draft.audience} onChange={(audience) => update({ audience })} placeholder="For the bookworm" />
            <Input label="One-line pitch" value={draft.pitch} onChange={(pitch) => update({ pitch })} placeholder="Chapter one, on repeat." />
            <Select label="Colour" value={draft.tone} options={TONES} onChange={(tone) => update({ tone })} />
          </div>
          <div className={styles.stack}>
            <TextArea label="Story" value={draft.story} onChange={(story) => update({ story })} rows={3} hint="The paragraph under the box name on its page." />
          </div>
        </AdminPanel>

        <PlansPanel draft={draft} update={update} />

        <AdminPanel title="Highlights">
          <p className={styles.note}>Up to four short facts under the hero photo.</p>
          <RowList
            rows={draft.facts}
            onChange={(facts) => update({ facts })}
            makeRow={() => ({ icon: "Sparkles", label: "" })}
            rowName="highlight"
            addLabel="Add highlight"
            max={MAX_FACTS}
            renderRow={(fact, change, index) => (
              <>
                <span className={styles.factIcon}>
                  <BoxIcon name={fact.icon} size={18} />
                </span>
                <div className={styles.narrow}>
                  <Select ariaLabel={`Highlight ${index + 1} icon`} value={fact.icon} options={ICON_OPTIONS} onChange={(icon) => change({ icon })} />
                </div>
                <Input ariaLabel={`Highlight ${index + 1}`} value={fact.label} onChange={(label) => change({ label })} placeholder="Made for two" />
              </>
            )}
          />
        </AdminPanel>

        <AdminPanel title="The ritual">
          <p className={styles.note}>The steps for enjoying the box, in order.</p>
          <RowList
            rows={draft.ritual}
            onChange={(ritual) => update({ ritual })}
            makeRow={() => ({ title: "", body: "" })}
            rowName="step"
            addLabel="Add step"
            renderRow={(step, change, index) => (
              <div className={styles.stack}>
                <Input ariaLabel={`Step ${index + 1} title`} value={step.title} onChange={(title) => change({ title })} placeholder="Open it together" />
                <Input ariaLabel={`Step ${index + 1} detail`} value={step.body} onChange={(body) => change({ body })} placeholder="Lid off, glasses out…" />
              </div>
            )}
          />
        </AdminPanel>

        <AdminPanel title="What’s inside">
          <p className={styles.note}>The contents list on the box page, as customers should picture a full box.</p>
          <RowList
            rows={draft.contents}
            onChange={(contents) => update({ contents })}
            makeRow={(): BoxItem => ({ name: "", description: "", tone: "cream" })}
            rowName="contents row"
            addLabel="Add row"
            renderRow={(item, change, index) => (
              <>
                <Input ariaLabel={`Inside ${index + 1} name`} value={item.name} onChange={(name) => change({ name })} placeholder="Hand-poured candle" />
                <Input ariaLabel={`Inside ${index + 1} description`} value={item.description} onChange={(description) => change({ description })} placeholder="Lavender, jasmine, rosewood" />
                <div className={styles.narrow}>
                  <Select ariaLabel={`Inside ${index + 1} colour`} value={item.tone} options={TONES} onChange={(tone) => change({ tone })} />
                </div>
              </>
            )}
          />
        </AdminPanel>

        <AdminPanel title="Testimonial">
          <p className={styles.note}>Optional. Leave the quote empty to hide this section.</p>
          <div className={styles.stack}>
            <TextArea label="Quote" value={draft.testimonial.quote} onChange={(quote) => update({ testimonial: { ...draft.testimonial, quote } })} rows={2} />
            <Input label="Who said it" value={draft.testimonial.attribution} onChange={(attribution) => update({ testimonial: { ...draft.testimonial, attribution } })} placeholder="Priya & Sam, members since June" />
          </div>
        </AdminPanel>
      </div>

      <aside className={styles.side}>
        <AdminPanel title="Illustration">
          <p className={styles.note}>On the box tile and at the top of the box page. Drawn from the name, colour and what’s inside.</p>
          <div className={styles.illustration} aria-busy={isDrawing}>
            <ProductImage
              src={draft.illustration}
              alt={draft.illustration ? `${draft.name} box illustration` : undefined}
              tone={draft.tone}
              ratio="1 / 1"
              radius="var(--radius-md)"
              label={isDrawing ? "Drawing… about a minute" : "No illustration yet"}
              background="var(--cream-0)"
              sizes="320px"
            />
          </div>
          <div className={styles.photoActions}>
            <Button size="sm" variant="secondary" iconLeft={Sparkles} onClick={onDraw} loading={isDrawing}>
              {draft.illustration ? "Redraw" : "Draw illustration"}
            </Button>
            {draft.illustration && !isDrawing && (
              <Button size="sm" variant="ghost" iconLeft={X} onClick={() => update({ illustration: null })}>
                Remove
              </Button>
            )}
          </div>
        </AdminPanel>
        <AdminPanel title="Photo">
          <p className={styles.note}>A real photo, if you have one. It leads the gallery on the box page.</p>
          <div className={styles.photo} style={{ background: toneSurface(draft.tone) }}>
            <ProductImage src={draft.image} tone={draft.tone} ratio="4 / 5" radius="var(--radius-md)" label={draft.shotDescription || draft.name} background="var(--cream-0)" sizes="320px" />
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
          <div className={styles.photoActions}>
            <Button size="sm" variant="secondary" iconLeft={ImageUp} onClick={() => fileInput.current?.click()} loading={isUploading}>
              {draft.image ? "Replace photo" : "Upload photo"}
            </Button>
            {draft.image && (
              <Button size="sm" variant="ghost" iconLeft={X} onClick={() => update({ image: null })}>
                Remove
              </Button>
            )}
          </div>
          <div className={styles.stack}>
            <TextArea
              label="Photo note"
              value={draft.shotDescription}
              onChange={(shotDescription) => update({ shotDescription })}
              rows={2}
              hint="Shown on the placeholder until there’s a photo."
            />
          </div>
        </AdminPanel>
        {sources.length > 0 && (
          <AdminPanel title="Research">
            <p className={styles.note}>Pages the draft was based on. Check any facts against them.</p>
            <ul className={styles.sources}>
              {sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                    <ExternalLink size={13} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </AdminPanel>
        )}
        <AdminPanel title="Status">
          {draft.status === "active" ? (
            <Badge tone="sage">On sale</Badge>
          ) : (
            <Badge tone="neutral">Archived · not on the storefront</Badge>
          )}
        </AdminPanel>
      </aside>
    </div>
  );
}
