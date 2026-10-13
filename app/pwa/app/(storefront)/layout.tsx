import { SiteFooter, SiteHeader, TabBar } from "@/components/layout";

export default function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <TabBar />
    </>
  );
}
