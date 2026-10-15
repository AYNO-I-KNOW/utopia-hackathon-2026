import { copy } from "@/content";
import { MobileShell } from "@/components/mobile-shell";
export default function Page() {
  return (
    <MobileShell>
      <section className="content">
        <h1>{copy.doctor}</h1>
      </section>
    </MobileShell>
  );
}
