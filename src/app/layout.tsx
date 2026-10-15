import type { Metadata } from "next";
import "@fontsource-variable/nunito";
import "@fontsource-variable/noto-sans-thai";
import "@/design-system/tokens.css";
import "./globals.css";
import "@/features/development/styles.css";
import "@/design-system/components.css";
import { SceneNavigationProvider } from "@/components/scene-navigation";
import { activeLocale } from "@/content";
export const metadata: Metadata = {
  title: "Crybaby",
  description: "Mobile baby care wireframe",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={activeLocale}>
      <body>
        <SceneNavigationProvider>{children}</SceneNavigationProvider>
      </body>
    </html>
  );
}
