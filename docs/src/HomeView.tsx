import React, { useState } from 'react';
import { 
  BookOpen, Layers, Cpu, Download
} from 'lucide-react';
import { VEXVIEW_SUBSYSTEMS, Subsystem } from './data/subsystems';
import { SubsystemCard } from './components/SubsystemCard';
import { ArchitectureModal } from './components/ArchitectureModal';
import { BenchmarkMatrix } from './components/BenchmarkMatrix';
import { DownloadSection } from './components/DownloadSection';

interface HomeViewProps {
  onNavigate: (tab: 'home' | 'docs', hashTarget?: string) => void;
}

type FilterDomain = 'all' | 'decoding' | 'trimming' | 'rendering' | 'windowing';

export default function HomeView({ onNavigate }: HomeViewProps) {
  const [selectedSubsystem, setSelectedSubsystem] = useState<Subsystem | null>(null);
  const [domainFilter, setDomainFilter] = useState<FilterDomain>('all');

  const filteredSubsystems = VEXVIEW_SUBSYSTEMS.filter((sub) => {
    if (domainFilter === 'all') return true;
    return sub.domain === domainFilter;
  });

  const filterTabs: { key: FilterDomain; label: string; count: number }[] = [
    { key: 'all', label: 'All Subsystems', count: VEXVIEW_SUBSYSTEMS.length },
    { key: 'decoding', label: 'Hardware Video', count: VEXVIEW_SUBSYSTEMS.filter((s) => s.domain === 'decoding').length },
    { key: 'trimming', label: 'Stream Trimming', count: VEXVIEW_SUBSYSTEMS.filter((s) => s.domain === 'trimming').length },
    { key: 'rendering', label: 'RAW & HDR', count: VEXVIEW_SUBSYSTEMS.filter((s) => s.domain === 'rendering').length },
    { key: 'windowing', label: 'Linux Shell', count: VEXVIEW_SUBSYSTEMS.filter((s) => s.domain === 'windowing').length },
  ];

  const heroMetrics = [
    { val: '<6.1 MB', lbl: 'Standalone AppImage' },
    { val: '<28 MB', lbl: 'Idle Process Memory' },
    { val: '60+ FPS', lbl: 'Hardware 4K Scrubbing' },
    { val: '0 Loss', lbl: 'Stream Copy Trimming' },
  ];

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="nx-ambient-glow" />

      {/* Hero Section */}
      <section className="relative pt-16 md:pt-24 pb-16 px-6 max-w-7xl mx-auto w-full z-10">
        <div className="text-center max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0f1012] border border-white/[0.08] text-xs font-mono tracking-wider text-slate-300 mb-6 shadow-lg shadow-black/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-cyan-400 font-bold">06 //</span>
            <span>MODERN MINIMALIST MEDIA INSPECTOR</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white font-sans leading-[1.08] mb-6">
            Minimalist Linux Media Viewer <br className="hidden sm:inline" />
            <span className="text-cyan-400">&amp; Lossless Video Trimmer</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl font-normal leading-relaxed mb-8">
            High-performance raster, vector, and video inspection with hardware-accelerated VA-API decoding, frame-accurate lossless stream trimming, and zero telemetry bloat for Linux.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 mb-14">
            <a
              href="#downloads"
              className="px-6 py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-xl shadow-cyan-600/20 flex items-center gap-2.5 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download Latest</span>
            </a>

            <button
              type="button"
              onClick={() => onNavigate('docs', '#docs/why_vexview')}
              className="px-6 py-3.5 rounded-xl bg-[#15171a] hover:bg-[#1c1e22] text-white font-semibold text-sm border border-white/[0.08] hover:border-white/[0.16] shadow-xl shadow-black/40 flex items-center gap-2.5 transition"
            >
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>Explore Documentation</span>
            </button>

            <a
              href="#subsystems"
              className="px-6 py-3.5 rounded-xl bg-[#15171a] hover:bg-[#1c1e22] text-slate-300 hover:text-white font-semibold text-sm border border-white/[0.08] hover:border-white/[0.16] shadow-xl shadow-black/40 flex items-center gap-2.5 transition"
            >
              <Layers className="w-4 h-4 text-slate-400" />
              <span>Subsystems</span>
            </a>
          </div>

          {/* Metrics Ticker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl">
            {heroMetrics.map((m, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#0f1012] border border-white/[0.08] text-center">
                <div className="text-2xl font-mono font-bold text-cyan-400 tracking-tight">{m.val}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">{m.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subsystems Bento Grid Section */}
      <section id="subsystems" className="py-20 px-6 max-w-7xl mx-auto w-full z-10 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-cyan-400 mb-3">
              <Cpu className="w-3.5 h-3.5" />
              <span>MEDIA PIPELINE &amp; DESKTOP DOMAINS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
              Four High-Performance Engineering Engines
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
              Exhaustive architecture spanning VA-API video acceleration, direct bitstream stream copy trimming, deep color gamut rendering, and Wayland desktop integration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-[#0f1012] p-1.5 rounded-xl border border-white/[0.08]">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setDomainFilter(tab.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  domainFilter === tab.key
                    ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  domainFilter === tab.key ? 'bg-black/20 text-white font-bold' : 'bg-white/[0.06] text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSubsystems.map((sub) => (
            <SubsystemCard
              key={sub.id}
              subsystem={sub}
              onInspect={setSelectedSubsystem}
              onNavigateToDocs={(sectionId) => onNavigate('docs', `#docs/${sectionId}`)}
            />
          ))}
        </div>
      </section>

      {/* Download Section */}
      <DownloadSection repo="aerovexhq/vexview" />

      {/* Benchmark Matrix */}
      <BenchmarkMatrix />

      {/* Architecture Modal */}
      <ArchitectureModal
        subsystem={selectedSubsystem}
        onClose={() => setSelectedSubsystem(null)}
        onNavigateToDocs={(sectionId) => onNavigate('docs', `#docs/${sectionId}`)}
      />
    </div>
  );
}
