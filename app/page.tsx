import ErrorBoundary from '@/components/ErrorBoundary';
import RedCarpetWizard from '@/components/RedCarpetWizard';

export default function Home() {
  return (
    <ErrorBoundary>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-x-hidden">
        <RedCarpetWizard />
      </div>
    </ErrorBoundary>
  );
}
