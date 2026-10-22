import React, { useState } from 'react';
import { Download, Terminal, Copy, Check, ExternalLink, RefreshCw, HardDrive, Package, FileArchive } from 'lucide-react';
import { useReleases, Release } from '../hooks/useReleases';
import defaultReleasesData from '../data/releases.json';

interface DownloadSectionProps {
  repo?: string;
  installCommand?: string;
}

export function DownloadSection({
  repo = 'aerovexhq/vexview',
  installCommand = 'curl -sSL https://raw.githubusercontent.com/aerovexhq/vexview/main/install.sh | bash',
}: DownloadSectionProps) {
  const { latestRelease, loading, error } = useReleases(repo, defaultReleasesData as Release[]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const getAssetDetails = (name: string): { label: string; desc: string; icon: any } => {
    const n = name.toLowerCase();
    if (n.endsWith('.appimage')) {
      return {
        label: 'Universal Linux AppImage',
        desc: 'Single self-contained executable. Works out-of-the-box on all modern Linux distributions.',
        icon: HardDrive,
      };
    }
    if (n.endsWith('.deb')) {
      return {
        label: 'Debian / Ubuntu Package (.deb)',
        desc: 'Native package with system desktop menu entry, MIME associations, and icon registration.',
        icon: Package,
      };
    }
    if (n.endsWith('.tar.gz')) {
      return {
        label: 'Portable Tarball (.tar.gz)',
        desc: 'Lossless pre-compiled binary bundle for standalone execution without root privileges.',
        icon: FileArchive,
      };
    }
    return {
      label: 'Binary Archive',
      desc: 'Compiled release asset',
      icon: HardDrive,
    };
  };

  const assets = latestRelease?.assets || [];

  return (
    <section id="downloads" className="py-20 px-6 max-w-7xl mx-auto w-full z-10 relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-cyan-400 mb-3">
            <Download className="w-3.5 h-3.5" />
            <span>STANDALONE LINUX DISTRIBUTIONS // GITHUB RELEASES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Download Vexview
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
            Ultra-compact, hardware-accelerated media inspector with zero background telemetry. Dynamically synchronized from GitHub Releases with verified compile-time caching.
          </p>
        </div>

        {latestRelease && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#0f1012] border border-white/[0.08] text-xs font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Version: <strong className="text-white">{latestRelease.tag_name}</strong></span>
              {loading && <RefreshCw className="w-3 h-3 animate-spin text-cyan-400 ml-1" />}
            </div>
            <a
              href={latestRelease.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-[#0f1012] border border-white/[0.08] hover:border-white/[0.16] text-slate-400 hover:text-white transition"
              title="View on GitHub"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      {/* Terminal Quick-Install Strip */}
      <div className="mb-10 p-5 rounded-2xl bg-[#0f1012] border border-white/[0.08] relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-cyan-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono font-medium text-slate-300">1-Line Terminal Install (Linux)</div>
              <div className="text-[11px] font-mono text-slate-500">Automated architecture detection, desktop entry, and icon installation</div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto bg-[#08090a] px-3.5 py-2.5 rounded-xl border border-white/[0.06] font-mono text-xs text-cyan-300 overflow-x-auto justify-between">
            <code className="select-all whitespace-nowrap">{installCommand}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition flex-shrink-0 ml-3"
              title="Copy install command"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Release Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {assets.map((asset) => {
          const { label, desc, icon: IconComponent } = getAssetDetails(asset.name);
          return (
            <div
              key={asset.name}
              className="p-6 rounded-2xl bg-[#0f1012] border border-white/[0.08] hover:border-cyan-500/30 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                    {formatSize(asset.size)}
                  </span>
                </div>

                <h4 className="text-base font-bold text-white tracking-tight font-sans mb-1.5 group-hover:text-cyan-300 transition-colors">
                  {label}
                </h4>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {desc}
                </p>

                <div className="text-[11px] font-mono text-slate-500 bg-[#08090a] px-2.5 py-1.5 rounded-lg border border-white/[0.04] break-all select-all">
                  {asset.name}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-end">
                <a
                  href={asset.browser_download_url}
                  download
                  className="w-full justify-center px-4 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/30 text-cyan-200 hover:text-white text-xs font-semibold font-mono flex items-center gap-2 transition-all shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Binary</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {assets.length === 0 && (
        <div className="text-center py-12 text-slate-500 font-mono text-xs">
          Loading release assets...
        </div>
      )}

      {error && (
        <div className="text-center mt-4 text-[11px] font-mono text-amber-400/80">
          Runtime sync notice: Using compile-time release snapshot ({defaultReleasesData.length} release loaded)
        </div>
      )}
    </section>
  );
}
