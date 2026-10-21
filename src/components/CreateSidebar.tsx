import React from "react";
import { Editor } from "@monaco-editor/react";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface CreateSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  yaml: string;
  onSave: (yaml: string) => void;
}

export const CreateSidebar: React.FC<CreateSidebarProps> = ({
  isOpen,
  onClose,
  title,
  yaml,
  onSave,
}) => {
  const [editedYaml, setEditedYaml] = React.useState(yaml);

  React.useEffect(() => {
    if (isOpen) {
      setEditedYaml(yaml);
    }
  }, [isOpen, yaml]);

  const handleSave = () => {
    onSave(editedYaml);
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", md: 600 } } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Typography variant="h6">{title}</Typography>
          <IconButton aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, p: 3 }}>
          <Editor
            height="100%"
            language="yaml"
            theme="vs-dark"
            value={editedYaml}
            onChange={(value) => setEditedYaml(value ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              wordWrap: "on",
              formatOnPaste: true,
              formatOnType: true,
            }}
          />
        </Box>

        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1.5}
          sx={{
            px: 3,
            py: 2,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "surfaces.subtle",
          }}
        >
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
};
