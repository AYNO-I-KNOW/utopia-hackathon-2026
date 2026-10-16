import type { Metadata } from "next";
import "@fontsource-variable/nunito";
import "@fontsource-variable/noto-sans-thai";
import "@/design-system/tokens.css";
import "./globals.css";
import "@/features/development/styles.css";
import "@/design-system/components.css";
import { AppSplash } from "@/components/app-splash";
import { SceneNavigationProvider } from "@/components/scene-navigation";
import { activeLocale } from "@/content";
export const metadata: Metadata = {
  title: "Cry for your Mom",
  description: "Mobile baby care wireframe",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={activeLocale}>
      <body>
        <SceneNavigationProvider>{children}</SceneNavigationProvider>
        <AppSplash />
      </body>
    </html>
  );
}
