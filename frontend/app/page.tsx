import { AppNav } from "@/components/app/app-nav"
import { HeroSection } from "@/components/landing/hero-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { MetricsSection } from "@/components/landing/metrics-section"
import { CtaSection } from "@/components/landing/cta-section"
import { FooterSection } from "@/components/landing/footer-section"

export default function Home() {
  return (
    <>
      <AppNav />
      <main>
        <HeroSection />
        <MetricsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CtaSection />
      </main>
      <FooterSection />
    </>
  )
}
