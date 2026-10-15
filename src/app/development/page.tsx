import { copy } from "@/content";
import { MobileShell } from "@/components/mobile-shell";
export default function Page() {
  return (
    <MobileShell active="/development">
      <section className="content">
        <h1>{copy.development}</h1>
      </section>
    </MobileShell>
  );
}
