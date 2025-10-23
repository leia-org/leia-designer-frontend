/**
 * Markdown Renderer with Mermaid support
 * Renders markdown content including code blocks and mermaid diagrams
 */

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderMermaid = async () => {
      if (!containerRef.current) return;

      try {
        // Find all mermaid code blocks and render them
        const mermaidBlocks = containerRef.current.querySelectorAll('.language-mermaid');

        if (mermaidBlocks.length === 0) return;

        mermaidBlocks.forEach((block, index) => {
          const code = block.textContent || '';
          const id = `mermaid-${Date.now()}-${index}`;

          // Create a div for the mermaid diagram
          const mermaidDiv = document.createElement('div');
          mermaidDiv.className = 'mermaid-diagram';
          mermaidDiv.id = id;
          mermaidDiv.textContent = code;

          // Replace the code block with the mermaid div
          if (block.parentElement) {
            block.parentElement.replaceWith(mermaidDiv);
          }
        });

        // Wait for DOM to update, then render mermaid diagrams
        await new Promise(resolve => setTimeout(resolve, 100));

        const diagramElements = containerRef.current?.querySelectorAll('.mermaid-diagram');
        if (diagramElements && diagramElements.length > 0) {
          await mermaid.run({
            querySelector: '.mermaid-diagram',
          });
        }
      } catch (error) {
        console.error('Error rendering mermaid diagrams:', error);
      }
    };

    renderMermaid();
  }, [content]);

  return (
    <div ref={containerRef} className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Style code blocks
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (!inline && language === 'mermaid') {
              return (
                <pre className={className}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            }

            if (!inline) {
              return (
                <pre className="bg-gray-100 rounded p-3 overflow-x-auto my-2">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            }

            return (
              <code className="bg-gray-100 rounded px-1.5 py-0.5 text-sm" {...props}>
                {children}
              </code>
            );
          },
          // Style headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-2 mb-1">{children}</h3>
          ),
          // Style lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="ml-4">{children}</li>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="my-2 leading-relaxed">{children}</p>
          ),
          // Style links
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2">
              {children}
            </blockquote>
          ),
          // Style tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-gray-300">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-4 py-2">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      <style>{`
        .mermaid-diagram {
          display: flex;
          justify-content: center;
          margin: 1rem 0;
        }
        .mermaid-diagram svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
};
