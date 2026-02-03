export function Partners() {
  return (
    <section className="py-20 px-6 bg-[#1A3A52]">
      <div className="max-w-5xl mx-auto">
        <h3 className="text-4xl text-[#F9F8F6] text-center mb-3 font-serif">
          Serving Nantucket
        </h3>
        <p className="text-center text-[#D4C4B0] mb-16 text-lg tracking-wide">
          Modern expertise, rooted in island history.
        </p>
        
        {/* Company Branding */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-16 mb-16">
          <div className="text-center">
            <div className="text-[32px] font-serif text-[#F9F8F6] tracking-wide mb-3">
              Congdon & Coleman
            </div>
            <div className="text-xs text-[#D4C4B0] tracking-[2px] uppercase">
              Nantucket&apos;s Longest-Standing Brokerage
            </div>
          </div>
          
          <div className="hidden md:block w-px h-16 bg-[#D4C4B0] opacity-40" />
          
          <div className="text-center">
            <div className="text-[32px] font-serif text-[#F9F8F6] tracking-wide mb-3">
              NantucketRentals.com
            </div>
            <div className="text-xs text-[#D4C4B0] tracking-[2px] uppercase">
              Premium Vacation Rentals
            </div>
          </div>
        </div>

        {/* Additional Companies */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-16 mb-16">
          <div className="text-center">
            <div className="text-[32px] font-serif text-[#F9F8F6] tracking-wide mb-3">
              NantucketHouses.com
            </div>
            <div className="text-xs text-[#D4C4B0] tracking-[2px] uppercase">
              Private Advisory
            </div>
          </div>
          
          <div className="hidden md:block w-px h-16 bg-[#D4C4B0] opacity-40" />
          
          <div className="text-center">
            <div className="text-[32px] font-serif text-[#F9F8F6] tracking-wide mb-3">
              Maury Associates
            </div>
            <div className="text-xs text-[#D4C4B0] tracking-[2px] uppercase">
              Building Nantucket Homes Since 1978
            </div>
          </div>
        </div>

        {/* Let's Talk Section */}
        <div className="text-center pt-8 border-t border-[#D4C4B0] border-opacity-30">
          <h4 className="text-2xl font-serif text-[#F9F8F6] mb-3">
            Let&apos;s Talk
          </h4>
          <p className="text-[#D4C4B0] max-w-2xl mx-auto">
            Whether you&apos;re considering a real estate transaction or a Nantucket community project, I&apos;d love to hear from you.
          </p>
        </div>
      </div>
    </section>
  );
}
