import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';

const RedCarpetWizard = dynamic(() => import('@/components/RedCarpetWizard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#1a0608] flex items-center justify-center">
      <p className="text-[#FFD700] font-display">Loading…</p>
    </div>
  ),
});

export default function Home() {
  return (
    <ErrorBoundary>
      <RedCarpetWizard />
    </ErrorBoundary>
  );
}
