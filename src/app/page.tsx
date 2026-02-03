import { Hero } from "@/components/Hero";
import { Timeline } from "@/components/Timeline";
import { Partners } from "@/components/Partners";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Hero />
      <Timeline />
      <Partners />
      <Contact />
      <Footer />
    </div>
  );
}
