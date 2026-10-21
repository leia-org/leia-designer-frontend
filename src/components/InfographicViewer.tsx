import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
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

export const InfographicViewer = forwardRef<InfographicViewerHandle, InfographicViewerProps>(
  function InfographicViewer(
    { src, fallbackSrc, candidateSources: candidateSourcesProp, title, compact = false, hidden = false },
    ref,
  ) {
    const candidateSources = useMemo(
      () => buildStoredImageCandidateSources(...(candidateSourcesProp?.length ? candidateSourcesProp : [src, fallbackSrc])),
      [candidateSourcesProp, fallbackSrc, src],
    );
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const resolvedSrc = candidateSources[currentSourceIndex] || "";

    useEffect(() => {
      setCurrentSourceIndex(0);
    }, [candidateSources]);

    const loadNextSource = () => {
      setCurrentSourceIndex((previous) => Math.min(previous + 1, candidateSources.length));
    };
    const open = () => {
      if (resolvedSrc) setIsOpen(true);
    };

    useImperativeHandle(ref, () => ({ open }), [resolvedSrc]);

    if (hidden) {
      return resolvedSrc ? <img src={resolvedSrc} alt="" onError={loadNextSource} style={{ display: "none" }} /> : null;
    }

    return (
      <>
        <Paper variant="outlined" sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>{title}</Typography>
              {!compact && <Typography variant="caption">Select the image to inspect it in detail</Typography>}
            </Box>
            <Button size="small" variant="outlined" startIcon={<OpenInFullIcon />} onClick={open} disabled={!resolvedSrc}>
              Open
            </Button>
          </Stack>
          <Box sx={{ flex: 1, minHeight: 180, display: "grid", placeItems: "center", p: 2, bgcolor: "surfaces.subtle" }}>
            {resolvedSrc ? (
              <Box component="button" type="button" onClick={open} sx={{ display: "block", border: 0, p: 0, bgcolor: "transparent", cursor: "zoom-in", maxWidth: "100%", maxHeight: "100%" }}>
                <Box component="img" src={resolvedSrc} alt={title} onError={loadNextSource} sx={{ display: "block", maxWidth: "100%", maxHeight: 400, objectFit: "contain" }} />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No infographic image is available</Typography>
            )}
          </Box>
        </Paper>

        <Dialog open={isOpen} onClose={() => setIsOpen(false)} fullWidth maxWidth="xl">
          <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Typography variant="h6" noWrap>{title}</Typography>
            <IconButton aria-label="Close" onClick={() => setIsOpen(false)}><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ minHeight: "60vh", display: "grid", placeItems: "center", bgcolor: "surfaces.subtle" }}>
            {resolvedSrc && <Box component="img" src={resolvedSrc} alt={title} onError={loadNextSource} sx={{ maxWidth: "100%", maxHeight: "72vh", objectFit: "contain" }} />}
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

export default InfographicViewer;
