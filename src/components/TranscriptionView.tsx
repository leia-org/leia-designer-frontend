import React, { useRef } from "react";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import PersonIcon from "@mui/icons-material/Person";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { Avatar, Box, Paper, Stack, Typography } from "@mui/material";

interface Message {
  text: string;
  timestamp: Date | string;
  isLeia: boolean;
}

interface TranscriptionViewProps {
  messages: Message[];
}

export const TranscriptionView: React.FC<TranscriptionViewProps> = ({
  messages,
}) => {
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "surfaces.subtle",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {messages.length} messages in this transcription
        </Typography>
      </Box>

      <Box ref={chatMessagesRef} sx={{ flex: 1, overflowY: "auto", px: 2 }}>
        <Stack spacing={2} sx={{ maxWidth: 768, mx: "auto", py: 2 }}>
          {messages.length === 0 ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <ForumOutlinedIcon sx={{ color: "text.disabled", fontSize: 64, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No messages
              </Typography>
              <Typography color="text.secondary">
                This transcription doesn't contain any messages yet.
              </Typography>
            </Box>
          ) : (
            messages.map((message, index) => (
              <Stack
                key={index}
                direction="row"
                spacing={1}
                alignItems="flex-end"
                justifyContent={message.isLeia ? "flex-start" : "flex-end"}
              >
                {message.isLeia && (
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: "surfaces.accent",
                      color: "primary.dark",
                    }}
                  >
                    <SmartToyOutlinedIcon fontSize="small" />
                  </Avatar>
                )}
                <Paper
                  variant={message.isLeia ? "outlined" : undefined}
                  elevation={message.isLeia ? 0 : 1}
                  sx={{
                    maxWidth: "80%",
                    px: 2,
                    py: 1.25,
                    color: message.isLeia ? "text.primary" : "primary.contrastText",
                    bgcolor: message.isLeia ? "background.paper" : "primary.main",
                    borderRadius: 2.5,
                    borderBottomLeftRadius: message.isLeia ? 0.5 : 2.5,
                    borderBottomRightRadius: message.isLeia ? 2.5 : 0.5,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                    {message.text}
                  </Typography>
                </Paper>
                {!message.isLeia && (
                  <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>
                    <PersonIcon fontSize="small" />
                  </Avatar>
                )}
              </Stack>
            ))
          )}
        </Stack>
      </Box>
    </Box>
  );
};
