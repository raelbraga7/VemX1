export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1b2a]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1d4ed8] mb-4"></div>
        <p className="text-white text-lg">Carregando VemX1...</p>
      </div>
    </div>
  );
} 