export function Hero() {
  return (
    <section className="relative h-screen flex items-center justify-center">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(rgba(26, 58, 82, 0.4), rgba(26, 58, 82, 0.6)), url('https://images.unsplash.com/photo-1660996574008-5bd80fff3d1c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxOYW50dWNrZXQlMjBiZWFjaCUyMG9jZWFufGVufDF8fHx8MTc3MDA5MDk0M3ww&ixlib=rb-4.1.0&q=80&w=1080')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          filter: 'saturate(0.7)'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl">
        <h1 className="text-5xl md:text-7xl mb-8 text-[#F9F8F6] tracking-wide leading-tight">
          Rooted in the Grey Lady.
        </h1>
        <p className="text-xl md:text-2xl text-[#D4C4B0] mb-12 font-light leading-relaxed max-w-3xl mx-auto">
          Beyond real estate, my work is shaped by three generations of island life—dedicated to preserving Nantucket&apos;s character while helping clients make confident, informed decisions.
        </p>
        <a 
          href="#contact"
          className="inline-block bg-[#D4C4B0] text-[#1A3A52] px-10 py-4 hover:bg-[#C4B4A0] transition-all duration-300 tracking-widest uppercase text-sm font-medium"
        >
          Start a Conversation
        </a>
      </div>
      
      {/* Enhanced Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center shadow-lg">
          <div className="w-1 h-3 bg-white rounded-full mt-2 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
