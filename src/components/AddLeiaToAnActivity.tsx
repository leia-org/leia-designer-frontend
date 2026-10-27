import { useCallback, useEffect, useRef, useState } from "react";
import type { UIEvent } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Experiment } from "../models/Experiment";
import type { Leia } from "../models/Leia";
import api from "../lib/axios";
import { useDebounce } from "../hooks/useDebounce";

type Activity = Experiment;

interface AddLeiaToAnActivityProps {
  isOpen: boolean;
  selectedLeia: Leia | null;
  onClose: () => void;
  onSuccess?: () => void;
  idModal?: string;
}

export const AddLeiaToAnActivity = ({
  isOpen,
  selectedLeia,
  onClose,
  onSuccess,
  idModal,
}: AddLeiaToAnActivityProps) => {
  const [draftActivities, setDraftActivities] = useState<Activity[] | null>(null);
  const [loadingDraftActivities, setLoadingDraftActivities] = useState(false);
  const [loadingMoreDraftActivities, setLoadingMoreDraftActivities] = useState(false);
  const [errorLoadingDraftActivities, setErrorLoadingDraftActivities] = useState<string | null>(null);
  const [selectedDraftActivityId, setSelectedDraftActivityId] = useState<string | null>(null);
  const [creatingNewActivity, setCreatingNewActivity] = useState(false);
  const [addingLeiaToActivity, setAddingLeiaToActivity] = useState(false);
  const [pendingNewName, setPendingNewName] = useState<string | null>(null);
  const [activityInput, setActivityInput] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const debouncedActivitySearch = useDebounce(activitySearch, 400);
  const [actionError, setActionError] = useState<string | null>(null);
  const nextActivityCursorRef = useRef<string | null>(null);
  const isFetchingActivitiesRef = useRef(false);

  const fetchDraftActivities = useCallback(async () => {
    setErrorLoadingDraftActivities(null);
    setLoadingDraftActivities(true);
    try {
      const response = await api.get<{ experiments: Experiment[]; nextCursor: string | null }>("/api/v1/experiments/user/me", {
        params: {
          populated: true,
          visibility: "private",
          text: debouncedActivitySearch || undefined,
        },
      });
      setDraftActivities(response.data.experiments || []);
      nextActivityCursorRef.current = response.data.nextCursor || null;
    } catch {
      setErrorLoadingDraftActivities("Could not load draft activities");
    } finally {
      setLoadingDraftActivities(false);
    }
  }, [debouncedActivitySearch]);

  const loadMoreDraftActivities = useCallback(async () => {
    if (!nextActivityCursorRef.current || isFetchingActivitiesRef.current || loadingDraftActivities || loadingMoreDraftActivities) {
      return;
    }

    isFetchingActivitiesRef.current = true;
    setErrorLoadingDraftActivities(null);
    setLoadingMoreDraftActivities(true);
    try {
      const response = await api.get<{ experiments: Experiment[]; nextCursor: string | null }>("/api/v1/experiments/user/me", {
        params: {
          populated: true,
          visibility: "private",
          text: debouncedActivitySearch || undefined,
          lastActivityId: nextActivityCursorRef.current,
        },
      });
      setDraftActivities((previous) => [...(previous || []), ...(response.data.experiments || [])]);
      nextActivityCursorRef.current = response.data.nextCursor || null;
    } catch {
      setErrorLoadingDraftActivities("Could not load more activities");
    } finally {
      setLoadingMoreDraftActivities(false);
      isFetchingActivitiesRef.current = false;
    }
  }, [debouncedActivitySearch, loadingDraftActivities, loadingMoreDraftActivities]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedDraftActivityId(null);
    setPendingNewName(null);
    setActivityInput("");
    setActivitySearch("");
    setDraftActivities(null);
    nextActivityCursorRef.current = null;
    setActionError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftActivities(null);
    nextActivityCursorRef.current = null;
    void fetchDraftActivities();
  }, [debouncedActivitySearch, isOpen, fetchDraftActivities]);

  const handleActivityListScroll = useCallback((event: UIEvent<HTMLUListElement>) => {
    const listbox = event.currentTarget;
    if (listbox.scrollTop + listbox.clientHeight >= listbox.scrollHeight - 48) {
      void loadMoreDraftActivities();
    }
  }, [loadMoreDraftActivities]);

  const handleAddLeiaToActivity = async (activityId: string) => {
    if (!selectedLeia) return;
    await api.post(`/api/v1/experiments/${activityId}/leias`, { leia: selectedLeia.id });
  };

  const handleCreateActivity = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    setCreatingNewActivity(true);
    try {
      const response = await api.post<Experiment>("/api/v1/experiments", { name: trimmedName });
      setDraftActivities((previous) => [...(previous || []), response.data]);
      setSelectedDraftActivityId(response.data.id);
      return response.data.id;
    } catch (error) {
      const axiosError = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      setActionError(
        axiosError.response?.status === 409
          ? axiosError.response.data?.message || "An activity with that name already exists"
          : axiosError.response?.data?.message || axiosError.message || "Could not create activity",
      );
      return null;
    } finally {
      setCreatingNewActivity(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedLeia) return;
    setActionError(null);
    try {
      setAddingLeiaToActivity(true);
      let targetActivityId = selectedDraftActivityId;
      if (!targetActivityId && pendingNewName) targetActivityId = await handleCreateActivity(pendingNewName);
      if (!targetActivityId) return;
      await handleAddLeiaToActivity(targetActivityId);
      onClose();
      onSuccess?.();
    } catch {
      setActionError("Could not add LEIA to activity");
    } finally {
      setAddingLeiaToActivity(false);
    }
  };

  const selectedActivity = draftActivities?.find((activity) => activity.id === selectedDraftActivityId) || null;
  const busy = creatingNewActivity || addingLeiaToActivity;
  const canConfirm = Boolean(selectedDraftActivityId || pendingNewName) && Boolean(selectedLeia) && !busy;

  return (
    <Dialog open={isOpen} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Add {selectedLeia?.metadata.name || ""} LEIA to an Activity
      </DialogTitle>
      <DialogContent id={idModal} dividers>
        <Stack spacing={2.25}>
          {errorLoadingDraftActivities ? (
            <Stack spacing={1.5}>
              <Alert severity="error">{errorLoadingDraftActivities}</Alert>
              <Box><Button variant="outlined" color="error" onClick={() => void fetchDraftActivities()}>Try Again</Button></Box>
            </Stack>
          ) : (
            <Autocomplete<Activity, false, false, true>
              freeSolo
              options={draftActivities || []}
              value={selectedActivity}
              inputValue={activityInput}
              loading={loadingDraftActivities || creatingNewActivity}
              disabled={busy}
              getOptionLabel={(option) => typeof option === "string" ? option : option.name}
              isOptionEqualToValue={(option, value) => typeof value !== "string" && option.id === value.id}
              onInputChange={(_, value, reason) => {
                setActivityInput(value);
                if (reason === "input") {
                  setActivitySearch(value);
                  setSelectedDraftActivityId(null);
                  setPendingNewName(value.trim() || null);
                } else if (reason === "clear") {
                  setActivitySearch("");
                  setSelectedDraftActivityId(null);
                  setPendingNewName(null);
                }
              }}
              onChange={(_, value) => {
                if (typeof value === "string") {
                  setActivityInput(value);
                  setSelectedDraftActivityId(null);
                  setPendingNewName(value.trim() || null);
                } else if (value) {
                  setActivityInput(value.name);
                  setSelectedDraftActivityId(value.id);
                  setPendingNewName(null);
                } else {
                  setActivityInput("");
                  setActivitySearch("");
                  setSelectedDraftActivityId(null);
                  setPendingNewName(null);
                }
              }}
              slotProps={{
                listbox: {
                  onScroll: handleActivityListScroll,
                },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select an Activity"
                  placeholder={loadingDraftActivities ? "Loading activities..." : "Choose or create an activity..."}
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingDraftActivities || creatingNewActivity ? <CircularProgress color="inherit" size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
            />
          )}
          {loadingMoreDraftActivities && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">Loading more activities...</Typography>
            </Stack>
          )}
          {creatingNewActivity && <Typography variant="body2" color="primary.main">Creating new activity...</Typography>}
          {actionError && <Alert severity="error">{actionError}</Alert>}
          {pendingNewName && !creatingNewActivity && (
            <Alert severity="info">New activity “{pendingNewName}” will be created on confirm.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={!canConfirm}>
          {busy ? <CircularProgress size={18} color="inherit" /> : "Add to Activity"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
