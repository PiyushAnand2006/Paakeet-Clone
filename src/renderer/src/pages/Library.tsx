import { Eye, FileText, FileUser, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ImportResult, LibraryItem, LibraryKind } from '@shared/types'
import { Alert, Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, PageHeader, Segmented, Spinner } from '@/components/ui'
import { formatBytes, relativeTime, wordCount } from '@/lib/format'

export function Library() {
  const [kind, setKind] = useState<LibraryKind>('resume')
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [lastImport, setLastImport] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<LibraryItem | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LibraryItem | null>(null)

  const reload = (k: LibraryKind = kind) => window.rehearse.library.list(k).then(setItems)
  useEffect(() => {
    setItems(null)
    setLastImport(null)
    void reload(kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  async function importFiles() {
    setImporting(true)
    try {
      const result = await window.rehearse.library.import(kind)
      setLastImport(result.added.length || result.failed.length ? result : null)
      await reload()
    } finally {
      setImporting(false)
    }
  }

  const isResume = kind === 'resume'
  const tone = isResume ? 'resume' : 'document'

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="Resumes & documents"
        description="Everything here stays on this computer. Text is extracted once so the interviewer can reference it."
        actions={
          <Button onClick={() => void importFiles()} loading={importing}>
            <Upload className="size-4" /> {isResume ? 'Upload resume' : 'Upload documents'}
          </Button>
        }
      />

      <div className="mb-5">
        <Segmented
          label="Library section"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'resume', label: 'Resumes' },
            { value: 'document', label: 'Documents' }
          ]}
        />
      </div>

      {lastImport && (
        <div className="mb-4 space-y-2">
          {lastImport.added.length > 0 && (
            <Alert tone="neutral">
              Added {lastImport.added.length} file{lastImport.added.length === 1 ? '' : 's'}.
            </Alert>
          )}
          {lastImport.failed.map((f) => (
            <Alert key={f.fileName}>
              <span className="font-medium">{f.fileName}</span>: {f.reason}
            </Alert>
          ))}
        </div>
      )}

      {items === null ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={isResume ? <FileUser className="size-5" /> : <FileText className="size-5" />}
          title={isResume ? 'No resumes yet' : 'No documents yet'}
          description={
            isResume
              ? 'Upload a PDF, Word or text resume. The interviewer will ask about your real experience, and the tailor can rewrite it for a job.'
              : 'Add company research, project write-ups or study notes for the interviewer and coach to draw on.'
          }
          action={
            <Button onClick={() => void importFiles()} loading={importing}>
              <Upload className="size-4" /> Upload {isResume ? 'a resume' : 'documents'}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="flex items-center gap-3 p-3.5">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${isResume ? 'bg-resume-bg text-resume' : 'bg-document-bg text-document'}`}>
                {isResume ? <FileUser className="size-5" /> : <FileText className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone={tone}>{item.fileName.split('.').pop()?.toUpperCase()}</Badge>
                  <span>{wordCount(item.text).toLocaleString()} words</span>
                  <span>·</span>
                  <span>{formatBytes(item.sizeBytes)}</span>
                  <span>·</span>
                  <span>{relativeTime(item.createdAt)}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Preview ${item.name}`} onClick={() => setPreview(item)}>
                <Eye className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${item.name}`} onClick={() => setPendingDelete(item)}>
                <Trash2 className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={preview !== null}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview?.name ?? ''}
        description="Extracted text: this is exactly what the AI sees."
        wide
      >
        <pre className="font-sans text-[13px] leading-relaxed whitespace-pre-wrap">{preview?.text}</pre>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        description="It will be removed from the library and detached from any sessions that use it."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) void window.rehearse.library.remove(pendingDelete.id).then(() => reload())
        }}
      />
    </div>
  )
}
