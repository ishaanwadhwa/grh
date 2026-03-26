"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import SectionDivider from "@/components/ui/SectionDivider";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark text-text-inverse pt-28 pb-24">
        <div className="mx-auto max-w-6xl px-6">
          {/* Header */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4"
          >
            Get in Touch
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl md:text-5xl text-text-inverse"
          >
            Contact Us
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-4 text-base text-text-inverse/50 max-w-xl"
          >
            Whether it&apos;s a question about a stay, a collaboration idea, or
            you just want to say hello — we&apos;d love to hear from you.
          </motion.p>

          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
            >
              {submitted ? (
                <div className="border border-accent-gold/20 p-8 text-center">
                  <p className="font-display text-2xl text-accent-gold mb-3">
                    Message Sent
                  </p>
                  <p className="text-sm text-text-inverse/50">
                    We&apos;ll get back to you soon.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubmitted(true);
                  }}
                  className="space-y-6"
                >
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your name"
                      className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                      Subject
                    </label>
                    <select className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body focus:outline-none focus:border-accent-gold/50 transition-colors appearance-none">
                      <option value="general" className="bg-primary-dark">
                        General Inquiry
                      </option>
                      <option value="stay" className="bg-primary-dark">
                        About a Stay
                      </option>
                      <option value="dining" className="bg-primary-dark">
                        Dining / Reservations
                      </option>
                      <option value="events" className="bg-primary-dark">
                        Events & Collaborations
                      </option>
                      <option value="press" className="bg-primary-dark">
                        Press & Media
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                      Message
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="What's on your mind?"
                      className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors resize-none"
                    />
                  </div>
                  <Button type="submit" variant="primary">
                    Send Message
                  </Button>
                </form>
              )}
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="space-y-10"
            >
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-accent-gold/60 font-body font-medium mb-3">
                  Email
                </h3>
                <a
                  href="mailto:hello@goodroomhouse.com"
                  className="text-text-inverse/70 hover:text-accent-gold transition-colors"
                >
                  hello@goodroomhouse.com
                </a>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-accent-gold/60 font-body font-medium mb-3">
                  Location
                </h3>
                <p className="text-text-inverse/50 text-sm leading-relaxed">
                  Sitaram Bhawan, Munshi Ramdas Ji Ka Rasta
                  <br />
                  Near Ganga Pole, Walled City
                  <br />
                  Jaipur, Rajasthan 302002
                  <br />
                  India
                </p>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-accent-gold/60 font-body font-medium mb-3">
                  Social
                </h3>
                <div className="flex flex-col gap-2">
                  <a
                    href="https://instagram.com/goodroomhouse"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-inverse/50 hover:text-accent-gold transition-colors"
                  >
                    Instagram
                  </a>
                  <a
                    href="https://twitter.com/goodroomhouse"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-inverse/50 hover:text-accent-gold transition-colors"
                  >
                    Twitter
                  </a>
                </div>
              </div>

              <SectionDivider />

              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-accent-gold/60 font-body font-medium mb-3">
                  For Press & Collaborations
                </h3>
                <a
                  href="mailto:press@goodroomhouse.com"
                  className="text-text-inverse/70 hover:text-accent-gold transition-colors text-sm"
                >
                  press@goodroomhouse.com
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
