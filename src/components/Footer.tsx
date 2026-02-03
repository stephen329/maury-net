export function Footer() {
  return (
    <footer className="bg-[#1A3A52] py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center">
          <p className="text-[#F9F8F6] text-lg mb-4 font-serif tracking-wide">
            Maury.net
          </p>
          <p className="text-[#D4C4B0] mb-6">
            Three Generations of Nantucket Real Estate
          </p>
          
          <div className="w-16 h-px bg-[#8B9A8C] mx-auto mb-6" />
          
          {/* Contact Information */}
          <div className="mb-6 space-y-2">
            <p className="text-[#D4C4B0]">
              <a href="mailto:stephen@maury.net" className="hover:text-white transition-colors">
                stephen@maury.net
              </a>
            </p>
            <p className="text-[#D4C4B0]">
              <a href="tel:+15085551234" className="hover:text-white transition-colors">
                (508) 555-1234
              </a>
            </p>
          </div>
          
          <div className="w-16 h-px bg-[#8B9A8C] mx-auto mb-6" />
          
          <p className="text-[#8B9A8C] text-sm">
            © {new Date().getFullYear()} Maury.net. All rights reserved.
          </p>
          
          <p className="text-[#8B9A8C] text-xs mt-4 opacity-75">
            Nantucket, Massachusetts
          </p>
        </div>
      </div>
    </footer>
  );
}
