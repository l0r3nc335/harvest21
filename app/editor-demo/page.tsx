import { RichEditorDemoClient } from "@/components/editor/RichEditorDemoClient";

export default function Page() {
  return (
    <main className="max-w-3xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Tiptap Rich Editor Demo</h1>
      <RichEditorDemoClient />
    </main>
  );
}


