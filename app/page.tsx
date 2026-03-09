import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';

const RedCarpetWizard = dynamic(() => import('@/components/RedCarpetWizard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-cherry-950 flex items-center justify-center">
      <p className="text-neon-gold font-display">Loading…</p>
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
