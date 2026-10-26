import React, { useMemo, useState } from 'react';
import { X, Copy, Check, Info } from 'lucide-react';
import { VirtualTable, Button, StatusBadge, type ColumnDef } from '@aerovex/strata-ui';
import { useViewerStore } from '../stores/useViewerStore';

interface MetadataRow {
  category: string;
  key: string;
  value: string;
}

export const InspectorModal: React.FC = () => {
  const {
    items,
    currentIndex,
    imageDetail,
    videoDetail,
    showInspector,
    toggleInspector,
  } = useViewerStore();

  const [copied, setCopied] = useState(false);

  const current = items[currentIndex];

  const metadataRows = useMemo<MetadataRow[]>(() => {
    if (!current) return [];
    const rows: MetadataRow[] = [
      { category: 'File', key: 'Name', value: current.file_name },
      { category: 'File', key: 'Path', value: current.path },
      { category: 'File', key: 'Type', value: current.media_type },
      {
        category: 'File',
        key: 'Size',
        value: `${(current.file_size / (1024 * 1024)).toFixed(2)} MB`,
      },
    ];

    if (imageDetail) {
      rows.push({
        category: 'Image',
        key: 'Resolution',
        value: `${imageDetail.width} x ${imageDetail.height} px`,
      });
      if (imageDetail.make) {
        rows.push({ category: 'Camera', key: 'Make', value: imageDetail.make });
      }
      if (imageDetail.model) {
        rows.push({ category: 'Camera', key: 'Model', value: imageDetail.model });
      }
      if (imageDetail.date_time) {
        rows.push({ category: 'EXIF', key: 'Date / Time', value: imageDetail.date_time });
      }
    }

    if (videoDetail) {
      rows.push(
        {
          category: 'Video',
          key: 'Resolution',
          value: `${videoDetail.width} x ${videoDetail.height} px`,
        },
        {
          category: 'Video',
          key: 'Duration',
          value: `${videoDetail.duration_seconds.toFixed(2)}s`,
        },
      );
      if (videoDetail.video_codec) {
        rows.push({ category: 'Video', key: 'Codec', value: videoDetail.video_codec });
      }
      if (videoDetail.audio_codec) {
        rows.push({ category: 'Audio', key: 'Codec', value: videoDetail.audio_codec });
      }
      if (videoDetail.frame_rate) {
        rows.push({
          category: 'Video',
          key: 'Framerate',
          value: `${videoDetail.frame_rate.toFixed(1)} FPS`,
        });
      }
    }

    return rows;
  }, [current, imageDetail, videoDetail]);

  const columns: ColumnDef<MetadataRow>[] = [
    {
      key: 'key',
      header: 'Property',
      width: '40%',
      sortable: true,
      render: (item) => (
        <span className="font-medium text-fg">{item.key}</span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      width: '60%',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-muted text-[11px] truncate select-text">{item.value}</span>
      ),
    },
  ];

  const handleCopyJson = () => {
    if (!current) return;
    const json = JSON.stringify(
      {
        file: current,
        image: imageDetail,
        video: videoDetail,
      },
      null,
      2
    );
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!showInspector || !current) return null;

  return (
    <aside
      data-drawer="true"
      className="absolute top-0 right-0 bottom-0 w-80 bg-surface/95 backdrop-blur-xl border-l border-border flex flex-col z-40 select-none shadow-2xl animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-fg">Media Inspector</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            onClick={handleCopyJson}
            title="Copy all metadata as JSON"
            className="h-7 px-2 text-[11px] text-muted hover:text-fg"
          >
            {copied ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy className="w-3.5 h-3.5" />
                <span>JSON</span>
              </span>
            )}
          </Button>

          <Button
            variant="icon"
            onClick={toggleInspector}
            title="Close Inspector (I)"
            className="h-7 w-7 text-muted hover:text-fg"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Virtual Table Content */}
      <div className="flex-1 p-3 overflow-hidden flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] text-muted px-1">
          <span>Stream Metadata</span>
          <StatusBadge status="online" label={current.media_type.toUpperCase()} pulse={false} />
        </div>

        <VirtualTable
          data={metadataRows}
          columns={columns}
          rowHeight={32}
          viewportHeight={480}
          className="flex-1 border-border/80"
        />
      </div>
    </aside>
  );
};
