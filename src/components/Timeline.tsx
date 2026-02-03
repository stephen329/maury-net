export function Timeline() {
  const milestones = [
    {
      year: "1940s",
      title: "The Foundation",
      description: "John and Terry Maury open The Emporium, establishing a family legacy built on island trust and personal relationships."
    },
    {
      year: "1950s",
      title: "The Connection",
      description: "The Boyes family begins their seasonal history on Nantucket, beginning lifelong connections with the island."
    },
    {
      year: "1960s",
      title: "Real Estate Roots",
      description: "John and Terry transition their local expertise into real estate, opening Maury Real Estate."
    },
    {
      year: "1978",
      title: "Building the Future",
      description: "My father, Larry, begins his career as a General Contractor, shifting the family focus toward real estate development."
    },
    {
      year: "1980s–90s",
      title: "Shaping Neighborhoods",
      description: "Larry spearheads development of Nantucket's most significant residential communities."
    },
    {
      year: "2000s",
      title: "Architectural Excellence",
      description: "Maury Associates pivots to the high-end market, specializing in the development of premier single-family estates."
    },
    {
      year: "2010s",
      title: "Strategic Growth",
      description: "I launch a boutique firm, eventually acquiring Congdon & Coleman Real Estate, the island's oldest firm."
    },
    {
      year: "Today",
      title: "Community Stewardship",
      description: "Beyond real estate, I am dedicated to the island's longevity through 12 years on the Finance Committee and serving as Vice President of Habitat for Humanity Nantucket."
    }
  ];

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl md:text-5xl mb-16 text-[#1A3A52] text-center">
          The Journey
        </h2>
        
        {/* Timeline */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-[#8B9A8C] hidden md:block" />
          
          {/* Milestones */}
          <div className="space-y-16">
            {milestones.map((milestone, index) => (
              <div 
                key={index}
                className={`flex items-center gap-8 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Content */}
                <div className={`flex-1 ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'} text-left`}>
                  <div className="text-3xl md:text-4xl text-[#D4C4B0] mb-2 font-serif">
                    {milestone.year}
                  </div>
                  <h3 className="text-2xl text-[#1A3A52] mb-3">
                    {milestone.title}
                  </h3>
                  <p className="text-[#2D2D2D] leading-relaxed">
                    {milestone.description}
                  </p>
                </div>
                
                {/* Center Dot */}
                <div className="hidden md:block w-4 h-4 bg-[#1A3A52] rounded-full border-4 border-white z-10 flex-shrink-0" />
                
                {/* Spacer */}
                <div className="flex-1 hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
