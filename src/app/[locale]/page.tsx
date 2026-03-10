import PublicNavbar from "@/components/layout/PublicNavbar";
import HeroSection from "@/components/landing/HeroSection";
import PhilosophySection from "@/components/landing/PhilosophySection";
import AboutSection from "@/components/landing/AboutSection";
import DiagnosticPreviewSection from "@/components/landing/DiagnosticPreviewSection";
import ServicesSection from "@/components/landing/ServicesSection";
import ContactSection from "@/components/landing/ContactSection";
import PublicFooter from "@/components/layout/PublicFooter";

export default function LandingPage() {
  return (
    <>
      <PublicNavbar />

      <main>
        <HeroSection />
        <PhilosophySection />
        <AboutSection />
        <DiagnosticPreviewSection />
        <ServicesSection />
        <ContactSection />
      </main>

      <PublicFooter />
    </>
  );
}
