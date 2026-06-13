import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import Viewer from "viewerjs";
import "viewerjs/dist/viewer.css";
import { buildStoredImageCandidateSources } from "../lib/avatar";

export interface InfographicViewerHandle {
  open: () => void;
}

interface InfographicViewerProps {
  src?: string | null;
  fallbackSrc?: string | null;
  candidateSources?: Array<string | null | undefined>;
  title: string;
  className?: string;
  compact?: boolean;
  hidden?: boolean;
}

export const InfographicViewer = forwardRef<
  InfographicViewerHandle,
  InfographicViewerProps
>(function InfographicViewer(
  {
    src,
    fallbackSrc,
    candidateSources: candidateSourcesProp,
    title,
    className = "",
    compact = false,
    hidden = false,
  },
  ref,
) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const candidateSources = React.useMemo(
    () =>
      buildStoredImageCandidateSources(
        ...((candidateSourcesProp && candidateSourcesProp.length > 0
          ? candidateSourcesProp
          : [src, fallbackSrc]) as Array<string | null | undefined>),
      ),
    [candidateSourcesProp, fallbackSrc, src],
  );
  const [currentSourceIndex, setCurrentSourceIndex] = React.useState(0);
  const resolvedSrc = candidateSources[currentSourceIndex] || "";

  React.useEffect(() => {
    setCurrentSourceIndex(0);
  }, [candidateSources]);

  useEffect(() => {
    if (!imageRef.current || !resolvedSrc) return;
    viewerRef.current?.destroy();
    viewerRef.current = new Viewer(imageRef.current, {
      navbar: false,
      title: false,
      toolbar: {
        zoomIn: true,
        zoomOut: true,
        oneToOne: true,
        reset: true,
        prev: false,
        play: false,
        next: false,
        rotateLeft: true,
        rotateRight: true,
        flipHorizontal: true,
        flipVertical: true,
      },
    });

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [resolvedSrc]);

  const openViewer = () => viewerRef.current?.show();

  useImperativeHandle(ref, () => ({ open: openViewer }), []);

  if (hidden) {
    return resolvedSrc ? (
      <img
        ref={imageRef}
        src={resolvedSrc}
        alt={title}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
        onError={() => {
          setCurrentSourceIndex((previousIndex) => {
            const nextIndex = previousIndex + 1;
            return nextIndex < candidateSources.length
              ? nextIndex
              : candidateSources.length;
          });
        }}
      />
    ) : null;
  }

  return (
    <section
      className={`flex h-full min-h-0 flex-col border border-gray-200 bg-white text-gray-900 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-inherit px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {!compact && (
            <p className="mt-0.5 text-xs text-gray-500">
              Click the image to zoom and inspect it.
            </p>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {resolvedSrc ? (
          <button
            type="button"
            onClick={openViewer}
            className="block h-full w-full rounded-md border border-inherit bg-gray-50"
            title="Open infographic viewer"
          >
            <img
              ref={imageRef}
              src={resolvedSrc}
              alt={title}
              className="mx-auto h-full max-h-full w-auto max-w-full object-contain"
              onError={() => {
                setCurrentSourceIndex((previousIndex) => {
                  const nextIndex = previousIndex + 1;
                  return nextIndex < candidateSources.length
                    ? nextIndex
                    : candidateSources.length;
                });
              }}
            />
          </button>
        ) : (
          <div className="flex h-full items-center justify-center rounded-md border border-inherit px-4 text-center text-sm text-gray-500">
            No infographic image is available.
          </div>
        )}
      </div>
    </section>
  );
});

export default InfographicViewer;
