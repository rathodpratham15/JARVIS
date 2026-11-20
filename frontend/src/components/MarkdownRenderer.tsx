import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  isDark: boolean;
}

function CodeBlock({ language, code }: { language: string; code: string; isDark?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717]">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#E5E5E5] dark:border-white/10 text-xs text-[#717171] dark:text-[#A1A1AA]">
        <span className="font-mono lowercase">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 text-[#171717] dark:text-[#F5F5F5] transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-4 text-[13px] leading-relaxed text-[#171717] dark:text-[#F5F5F5] font-mono whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export function MarkdownRenderer({ content, isDark }: MarkdownRendererProps) {
  return (
    <div className="jarvis-markdown text-[#171717] dark:text-[#F5F5F5]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || codeString.includes('\n');
            if (isBlock) {
              return (
                <CodeBlock
                  language={match ? match[1] : 'text'}
                  code={codeString}
                  isDark={isDark}
                />
              );
            }
            return (
              <code
                className="rounded-md bg-[#F4F4F4] dark:bg-[#2A2A2A] px-1.5 py-0.5 font-mono text-[0.85em] text-[#171717] dark:text-[#F5F5F5]"
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt || 'Attached visual'}
                referrerPolicy="no-referrer"
                className="rounded-xl border border-[#E5E5E5] dark:border-white/10 max-h-96 object-contain"
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
