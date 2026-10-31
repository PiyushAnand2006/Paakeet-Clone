import { forwardRef, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { cn } from './ui'

const remarkPlugins = [remarkGfm]
const rehypePlugins = [rehypeHighlight]

/**
 * Renders model output. react-markdown never injects raw HTML, so streamed text is safe
 * to render as it arrives.
 */
export const Markdown = memo(
  forwardRef<HTMLDivElement, { children: string; streaming?: boolean; className?: string }>(function Markdown(
    { children, streaming, className },
    ref
  ) {
    return (
      <div ref={ref} className={cn('md', streaming && 'streaming-caret', className)}>
        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
          {children}
        </ReactMarkdown>
      </div>
    )
  })
)
