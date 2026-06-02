import { useState, useEffect } from 'react';
import axios from 'axios';

export interface PlanCapabilities {
  instagram: boolean;
  facebook: boolean;
  telegram: boolean;
  broadcast: boolean;
  reEngagement: boolean;
  analytics: 'none' | 'basic' | 'full';
  aiPersona: boolean;
  whiteLabel: boolean;
  paymentVerification: boolean;
}

const defaultCapabilities: PlanCapabilities = {
  instagram: false,
  facebook: false,
  telegram: false,
  broadcast: false,
  reEngagement: false,
  analytics: 'none',
  aiPersona: false,
  whiteLabel: false,
  paymentVerification: false,
};

export function useFeatures(adminId?: string | null): PlanCapabilities {
  const [features, setFeatures] = useState<PlanCapabilities>(defaultCapabilities);

  useEffect(() => {
    let cancelled = false;

    const fetchFeatures = async () => {
      try {
        const res = await axios.get('/api/billing/features');
        if (!cancelled) {
          setFeatures(res.data);
        }
      } catch {
        if (!cancelled) {
          setFeatures(defaultCapabilities);
        }
      }
    };

    fetchFeatures();

    return () => {
      cancelled = true;
    };
  }, [adminId]); // Re-fetch if admin changes

  return features;
}
