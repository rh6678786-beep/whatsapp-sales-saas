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

let cachedFeatures: PlanCapabilities | null = null;
let cacheTime = 0;

export function useFeatures(): PlanCapabilities {
  const [features, setFeatures] = useState<PlanCapabilities>(defaultCapabilities);

  useEffect(() => {
    const fetchFeatures = async () => {
      if (cachedFeatures && Date.now() - cacheTime < 30000) {
        setFeatures(cachedFeatures);
        return;
      }
      try {
        const res = await axios.get('/api/billing/features');
        cachedFeatures = res.data;
        cacheTime = Date.now();
        setFeatures(res.data);
      } catch {
        setFeatures(defaultCapabilities);
      }
    };
    fetchFeatures();
  }, []);

  return features;
}
