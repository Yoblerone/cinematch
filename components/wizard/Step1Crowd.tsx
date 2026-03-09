'use client';

import { motion } from 'framer-motion';
import { User, Heart, Users } from 'lucide-react';
import type { CrowdType } from '@/lib/types';

const options: { value: CrowdType; label: string; icon: React.ElementType }[] = [
  { value: 'Solo', label: 'Solo', icon: User },
  { value: 'Date Night', label: 'Date Night', icon: Heart },
  { value: 'Group', label: 'Group', icon: Users },
];

interface Step1CrowdProps {
  value: CrowdType | null;
  onChange: (v: CrowdType) => void;
}

export default function Step1Crowd({ value, onChange }: Step1CrowdProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-10"
    >
      <div className="text-center">
        <h2 className="text-3xl font-display font-semibold text-neon-gold text-neon-glow mb-2">
          The Crowd
        </h2>
        <p className="text-cream text-sm">Who&apos;s watching?</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {options.map(({ value: optValue, label, icon: Icon }) => (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            className={`
              flex items-center gap-3 px-8 py-5 rounded-lg border-2 transition-all duration-300
              ${value === optValue
                ? 'border-brass bg-brass/10 text-neon-gold shadow-brass'
                : 'border-brass/50 bg-cherry-900 text-cream hover:border-brass hover:text-brass-light'
              }
            `}
          >
            <Icon className="w-6 h-6" />
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
