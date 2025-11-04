import { CTA } from "@/components/landing/CTA";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Problem } from "@/components/landing/Problem";


export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Problem />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
}