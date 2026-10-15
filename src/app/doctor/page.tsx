import { MobileShell } from "@/components/mobile-shell";
export default function Page() {
  return (
    <MobileShell active="/doctor">
      <section className="content">
        <h1>ปรึกษาคุณหมอ</h1>
      </section>
    </MobileShell>
  );
}
