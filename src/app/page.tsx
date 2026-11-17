import PlanEditor from "@/components/PlanEditor";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Floor Plan Generator</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Set the plot size and zoning rules to see the buildable envelope and the largest allowed
          footprint. Values are generic examples, not a real building code.
        </p>
      </header>
      <PlanEditor />
    </main>
  );
}
