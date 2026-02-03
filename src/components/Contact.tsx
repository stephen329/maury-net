"use client";

import { useState } from "react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission would be handled here
    console.log("Form submitted:", formData);
    alert("Thank you for your message. I'll be in touch soon.");
    setFormData({ name: "", email: "", message: "" });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <section id="contact" className="py-24 px-6 bg-[#F9F8F6]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl mb-6 text-[#1A3A52]">
            Let&apos;s Talk
          </h2>
          <p className="text-lg text-[#2D2D2D] leading-relaxed">
            Whether you&apos;re considering buying, selling, or simply have questions about the Nantucket market, I&apos;d love to hear from you.
          </p>
          <p className="text-sm text-[#8B9A8C] mt-3 italic">
            Inquiring about off-market opportunities or island consultations?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block mb-2 text-[#1A3A52]">
              Name
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-white border-[#8B9A8C]/30 focus:border-[#1A3A52] rounded-none"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block mb-2 text-[#1A3A52]">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-white border-[#8B9A8C]/30 focus:border-[#1A3A52] rounded-none"
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label htmlFor="message" className="block mb-2 text-[#1A3A52]">
              Message
            </label>
            <Textarea
              id="message"
              name="message"
              required
              value={formData.message}
              onChange={handleChange}
              rows={6}
              className="w-full bg-white border-[#8B9A8C]/30 focus:border-[#1A3A52] rounded-none resize-none"
              placeholder="Tell me about your Nantucket real estate goals..."
            />
          </div>

          <div className="text-center">
            <Button
              type="submit"
              className="bg-[#1A3A52] text-[#F9F8F6] px-12 py-6 hover:bg-[#2A4A62] transition-all duration-300 tracking-widest uppercase rounded-none"
            >
              Send Message
            </Button>
          </div>
        </form>

        {/* Contact Info */}
        <div className="mt-16 pt-12 border-t border-[#8B9A8C]/30 text-center">
          <p className="text-[#2D2D2D] mb-2">
            Prefer to reach out directly?
          </p>
          <a 
            href="mailto:stephen@maury.net" 
            className="text-[#1A3A52] hover:text-[#8B9A8C] transition-colors text-lg block mb-2"
          >
            stephen@maury.net
          </a>
          <a 
            href="tel:+15085551234" 
            className="text-[#1A3A52] hover:text-[#8B9A8C] transition-colors text-lg"
          >
            (508) 555-1234
          </a>
        </div>
      </div>
    </section>
  );
}
