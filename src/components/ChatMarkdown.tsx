import { memo, useId } from "react";
import { Box } from "@mui/material";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  // Chat content should not trigger requests to remote images.
  img: ({ alt }) => <>{alt}</>,
  table: ({ children }) => (
    <Box sx={{ overflowX: "auto" }}>
      <table>{children}</table>
    </Box>
  ),
};

export const ChatMarkdown = memo(function ChatMarkdown({ text }: { text: string }) {
  const messageId = useId();
  const footnoteLabelId = `${messageId}-footnote-label`;
  return (
    <Box
      sx={{
        minWidth: 0,
        overflowWrap: "anywhere",
        "& p": { my: 0.75, whiteSpace: "pre-wrap" },
        "& ul, & ol": { my: 0.75, pl: 3 },
        "& ul": { listStyleType: "disc" },
        "& ol": { listStyleType: "decimal" },
        "& li + li": { mt: 0.25 },
        "& h1, & h2, & h3, & h4, & h5, & h6": { my: 0.75, fontSize: "1em", fontWeight: 700 },
        "& blockquote": { my: 0.75, mx: 0, pl: 1.5, borderLeft: 3, borderColor: "divider" },
        "& a": { color: "primary.main", textDecoration: "underline" },
        "& pre": { my: 0.75, px: 1.25, py: 1, overflowX: "auto", borderRadius: 1, bgcolor: "action.hover" },
        "& code": { fontFamily: "monospace", fontSize: "0.9em" },
        "& :not(pre) > code": { px: 0.4, borderRadius: 0.5, bgcolor: "action.hover" },
        "& table": { my: 0.75, borderCollapse: "collapse" },
        "& th, & td": { px: 1, py: 0.5, border: 1, borderColor: "divider" },
        "& th": { bgcolor: "action.hover", fontWeight: 700 },
      }}
    >
      <ReactMarkdown
        components={{
          ...markdownComponents,
          a: ({ href, id, title, children, "aria-label": label, "aria-describedby": description }) =>
            href ? (
              <a
                href={href}
                id={id}
                title={title}
                aria-label={label}
                aria-describedby={description === "footnote-label" ? footnoteLabelId : description}
                target={href.startsWith("#") ? undefined : "_blank"}
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ) : <>{children}</>,
          h2: ({ id, className, children }) => (
            <h2 id={id === "footnote-label" ? footnoteLabelId : id} className={className}>{children}</h2>
          ),
        }}
        remarkPlugins={[remarkGfm]}
        remarkRehypeOptions={{ clobberPrefix: `${messageId}-` }}
      >
        {text}
      </ReactMarkdown>
    </Box>
  );
});
