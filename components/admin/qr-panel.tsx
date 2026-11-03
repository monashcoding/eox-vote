"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { AdminSessionDetailDto } from "@/lib/api-types";
import { qrFilename, qrSquareFilename } from "@/lib/qr-filename";
import { errorMessage } from "@/lib/client/error-message";
import { renderQrImage, renderQrSquare } from "@/lib/client/qr-render";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QrPanelProps {
  session: AdminSessionDetailDto;
}

const MAX_URL_LENGTH = 500;

/** The two images the panel saves: the poster, and the code alone. */
const QrKind = {
  Poster: "poster",
  Square: "square",
} as const;

type QrKind = (typeof QrKind)[keyof typeof QrKind];

function validateUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter the address attendees should open.";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Enter a full address, for example https://vote.example.com/.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "The address must start with http:// or https://.";
  }
  return null;
}

/** Waits for the page fonts so the canvas text matches the rest of the app. */
async function loadCanvasFonts(fontFamily: string): Promise<void> {
  await Promise.all([
    document.fonts.load(`600 64px ${fontFamily}`),
    document.fonts.load(`500 40px ${fontFamily}`),
  ]);
}

/**
 * Loads a logo for the canvas; the PNG waits for it like the fonts. Logos are
 * decoration, so if one cannot load the code is drawn without it.
 */
async function loadLogo(src: string): Promise<HTMLImageElement | undefined> {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
    return image;
  } catch {
    return undefined;
  }
}

/** MAC's logo, then the collaborating society's (if any), both loaded. */
async function loadLogos(sponsorLogoUrl: string | undefined) {
  const [logo, sponsorLogo] = await Promise.all([
    loadLogo("/mac.svg"),
    sponsorLogoUrl ? loadLogo(sponsorLogoUrl) : undefined,
  ]);
  return { logo, sponsorLogo };
}

export function QrPanel({ session }: QrPanelProps): React.JSX.Element {
  const [url, setUrl] = React.useState(() => `${window.location.origin}/`);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<QrKind | null>(null);
  const posterRef = React.useRef<HTMLCanvasElement>(null);
  const squareRef = React.useRef<HTMLCanvasElement>(null);

  const trimmedUrl = url.trim();
  const urlError = validateUrl(url);
  const caption = session.name;
  const sponsorLogoUrl = session.sponsor?.logoUrl;

  React.useEffect(() => {
    const poster = posterRef.current;
    const square = squareRef.current;
    if (!poster || !square || urlError) return;
    let cancelled = false;
    const fontFamily = getComputedStyle(poster).fontFamily;

    void (async () => {
      try {
        // Needs no fonts or logos, and throws first if the address is too long.
        renderQrSquare(square, trimmedUrl);
        const [logos] = await Promise.all([
          loadLogos(sponsorLogoUrl),
          loadCanvasFonts(fontFamily),
        ]);
        if (cancelled) return;
        renderQrImage(poster, { caption, url: trimmedUrl, ...logos }, fontFamily);
        setRenderError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        setRenderError(
          err instanceof Error && /too big|capacity/i.test(err.message)
            ? "That address is too long to fit in a QR code."
            : "Could not draw the QR code."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [caption, trimmedUrl, urlError, sponsorLogoUrl]);

  const problem = urlError ?? renderError;

  const handleSave = async (kind: QrKind) => {
    if (saving || problem) return;
    setSaving(kind);
    setSaveError(null);
    try {
      const canvas = document.createElement("canvas");
      if (kind === QrKind.Poster) {
        const fontFamily = getComputedStyle(document.body).fontFamily;
        const [logos] = await Promise.all([
          loadLogos(sponsorLogoUrl),
          loadCanvasFonts(fontFamily),
        ]);
        renderQrImage(canvas, { caption, url: trimmedUrl, ...logos }, fontFamily);
      } else {
        renderQrSquare(canvas, trimmedUrl);
      }
      // Executor form on purpose: Promise.withResolvers is missing on iOS < 17.4.
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      if (!blob) throw new Error("This browser could not create the image.");

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        kind === QrKind.Poster
          ? qrFilename(session.name)
          : qrSquareFilename(session.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser a moment to start the download before releasing.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    } catch (err: unknown) {
      setSaveError(errorMessage(err, "Could not save the QR code."));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">QR code</CardTitle>
        <CardDescription>
          Print the poster or put it on a slide, or save just the code as a
          square for designs that add their own branding. Attendees scan it to
          open the voting page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] md:items-start">
          <div className="order-2 md:order-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qr-url">Address in the QR code</Label>
              <Input
                id="qr-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                maxLength={MAX_URL_LENGTH}
                aria-invalid={urlError ? true : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted">
                Defaults to this site. Change it if attendees use a different
                public address.
              </p>
            </div>

            <ErrorNote message={problem} />
            <ErrorNote message={saveError} />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => void handleSave(QrKind.Poster)}
                disabled={saving !== null || Boolean(problem)}
              >
                <Download />
                {saving === QrKind.Poster ? "Saving..." : "Save poster"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => void handleSave(QrKind.Square)}
                disabled={saving !== null || Boolean(problem)}
              >
                <Download />
                {saving === QrKind.Square ? "Saving..." : "Save code only"}
              </Button>
            </div>
          </div>

          {/* Side by side, the poster and the code alone it is built around. */}
          <div
            className="order-1 grid grid-cols-2 items-start gap-4 md:order-2"
            hidden={Boolean(urlError)}
          >
            <figure className="space-y-2">
              <canvas
                ref={posterRef}
                role="img"
                aria-label={`QR poster for ${caption}, pointing to ${trimmedUrl}`}
                className="block h-auto w-full rounded-control border-2 border-border bg-white"
              />
              <figcaption className="text-center text-xs text-muted">
                Poster
              </figcaption>
            </figure>
            <figure className="space-y-2">
              <canvas
                ref={squareRef}
                role="img"
                aria-label={`QR code pointing to ${trimmedUrl}`}
                className="block h-auto w-full rounded-control border-2 border-border bg-white"
              />
              <figcaption className="text-center text-xs text-muted">
                Code only
              </figcaption>
            </figure>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
