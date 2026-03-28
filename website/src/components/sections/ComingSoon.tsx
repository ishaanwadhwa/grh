"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

interface ComingSoonProps {
  title?: string;
  subtitle?: string;
  description?: string;
  showLogo?: boolean;
  backHref?: string;
  backLabel?: string;
}

export default function ComingSoon({
  title = "Coming Soon",
  subtitle,
  description = "Something beautiful is on its way. Check back soon.",
  showLogo = true,
  backHref = "/",
  backLabel = "Back to Home",
}: ComingSoonProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-24">
      <div className="max-w-lg w-full text-center">
        {showLogo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative mx-auto mb-12 w-32 md:w-48"
          >
            <div className="absolute inset-0 bg-accent-gold/8 blur-3xl rounded-full scale-150" />
            <Image
              src="/logo.png"
              alt="Good Room House"
              width={200}
              height={140}
              className="relative z-10 w-full"
            />
          </motion.div>
        )}

        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs uppercase tracking-[0.3em] text-accent-gold/60 font-body font-medium mb-4"
          >
            {subtitle}
          </motion.p>
        )}

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="font-display text-3xl md:text-5xl text-text-inverse leading-tight"
        >
          {title}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center justify-center gap-4 my-8"
        >
          <div className="h-px w-12 bg-accent-gold/20" />
          <div className="w-1.5 h-1.5 rotate-45 bg-accent-gold/30" />
          <div className="h-px w-12 bg-accent-gold/20" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="text-base leading-relaxed text-text-inverse/40 max-w-sm mx-auto"
        >
          {description}
        </motion.p>

        {backHref && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-10"
          >
            <Link
              href={backHref}
              className="text-xs uppercase tracking-widest text-text-inverse/30 hover:text-accent-gold transition-colors duration-300 font-body"
            >
              ← {backLabel}
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
