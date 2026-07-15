import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function AgentMarkdown({ children }: { children: string }) {
  return (
    <div className="min-w-0 overflow-x-auto break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children: content }) => <p className="my-2 first:mt-0 last:mb-0">{content}</p>,
          strong: ({ children: content }) => <strong className="font-semibold text-[var(--text-primary)]">{content}</strong>,
          em: ({ children: content }) => <em className="italic">{content}</em>,
          ul: ({ children: content }) => <ul className="my-2 list-disc space-y-1 pl-5">{content}</ul>,
          ol: ({ children: content }) => <ol className="my-2 list-decimal space-y-1 pl-5">{content}</ol>,
          li: ({ children: content }) => <li className="pl-0.5">{content}</li>,
          h1: ({ children: content }) => <h1 className="mb-2 mt-3 text-base font-semibold text-[var(--text-primary)] first:mt-0">{content}</h1>,
          h2: ({ children: content }) => <h2 className="mb-2 mt-3 text-base font-semibold text-[var(--text-primary)] first:mt-0">{content}</h2>,
          h3: ({ children: content }) => <h3 className="mb-1.5 mt-3 font-semibold text-[var(--text-primary)] first:mt-0">{content}</h3>,
          blockquote: ({ children: content }) => <blockquote className="my-2 border-l-2 border-[var(--accent-terracotta)]/50 pl-3 text-[var(--text-muted)]">{content}</blockquote>,
          code: ({ children: content, className }) => (
            <code className={`${className ?? ""} rounded bg-[var(--bg-secondary)] px-1 py-0.5 font-mono text-[0.9em] text-[var(--text-primary)]`}>
              {content}
            </code>
          ),
          pre: ({ children: content }) => <pre className="my-3 overflow-x-auto rounded-lg bg-[var(--bg-secondary)] p-3 text-xs leading-5 [&>code]:bg-transparent [&>code]:p-0">{content}</pre>,
          a: ({ children: content, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-[var(--accent-terracotta)] underline decoration-current/40 underline-offset-2 hover:decoration-current"
            >
              {content}
            </a>
          ),
          hr: () => <hr className="my-3 border-[var(--border-light)]" />,
          table: ({ children: content }) => <table className="my-3 min-w-full border-collapse text-xs">{content}</table>,
          th: ({ children: content }) => <th className="border border-[var(--border-light)] bg-[var(--bg-secondary)] px-2 py-1.5 text-left font-semibold">{content}</th>,
          td: ({ children: content }) => <td className="border border-[var(--border-light)] px-2 py-1.5 align-top">{content}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
