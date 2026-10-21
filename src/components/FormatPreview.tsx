import React, { memo } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Alert, Box, Paper, Typography } from "@mui/material";

interface FormatPreviewProps {
  code: string;
  format: string;
  mermaidSvg?: string | null;
  error?: string | null;
  renderControls?: (utils: any) => React.ReactNode;
}

export const FormatPreview: React.FC<FormatPreviewProps> = memo(
  ({ code, format, mermaidSvg, error }) => {
    const formattedCode =
      format === "json"
        ? (() => {
            try {
              return JSON.stringify(JSON.parse(code), null, 2);
            } catch {
              return code;
            }
          })()
        : code;

    const isCodeFormat = ["json", "yaml", "xml", "text"].includes(format);

    return (
      <Box
        sx={{
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          bgcolor: "surfaces.subtle",
        }}
      >
        {format === "mermaid" && (
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit
            wheel={{ wheelDisabled: true }}
          >
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              {mermaidSvg ? (
                <Box dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
              ) : (
                <Typography color="text.secondary">Loading preview...</Typography>
              )}
            </TransformComponent>
          </TransformWrapper>
        )}

        {format === "markdown" && (
          <Box
            sx={{
              height: "100%",
              overflow: "auto",
              p: 3,
              "& h1, & h2, & h3, & h4, & h5, & h6": { mt: 0, mb: 1.5 },
              "& p": { my: 1.25, lineHeight: 1.65 },
              "& ul, & ol": { pl: 3, my: 1.25 },
              "& code": {
                fontFamily: "'JetBrains Mono Variable', monospace",
                fontSize: "0.85em",
              },
              "& pre": {
                overflow: "auto",
                p: 2,
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
              },
            }}
          >
            <ReactMarkdown>{code}</ReactMarkdown>
          </Box>
        )}

        {format === "html" && (
          <Box sx={{ height: "100%", overflow: "auto", p: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box dangerouslySetInnerHTML={{ __html: code }} />
            </Paper>
          </Box>
        )}

        {isCodeFormat && (
          <Box sx={{ height: "100%", overflow: "auto", p: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <SyntaxHighlighter
                language={format}
                wrapLongLines
                customStyle={{
                  background: "transparent",
                  margin: 0,
                  padding: 0,
                  fontSize: "0.875rem",
                  fontFamily:
                    "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {formattedCode}
              </SyntaxHighlighter>
            </Paper>
          </Box>
        )}

        {error && (
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon fontSize="inherit" />}
            sx={{ position: "absolute", right: 16, bottom: 16, left: 16, boxShadow: 3 }}
          >
            {error}
          </Alert>
        )}
      </Box>
    );
  }
);

FormatPreview.displayName = "FormatPreview";
