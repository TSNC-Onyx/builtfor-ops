import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type ProvisionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ProvisionResult {
  ok: boolean;
  tenant_id?: string;
  tenant_slug?: string;
  message?: string;
  error?: string;
}

export function useProvisionTenant() {
  const [status, setStatus] = useState<ProvisionStatus>('idle');
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const provision = useCallback(async (clientId: string): Promise<ProvisionResult> => {
    setStatus('loading');
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('provision-tenant', {
        body: { client_id: clientId },
      });

      if (error || data?.error) {
        const errMsg = data?.error ?? error?.message ?? 'Provisioning failed';
        const res: ProvisionResult = { ok: false, error: errMsg };
        setStatus('error');
        setResult(res);
        return res;
      }

      const res: ProvisionResult = {
        ok: true,
        tenant_id: data.tenant_id,
        tenant_slug: data.tenant_slug,
        message: data.message,
      };
      setStatus('success');
      setResult(res);
      return res;
    } catch (err) {
      const res: ProvisionResult = { ok: false, error: 'Unexpected error during provisioning' };
      setStatus('error');
      setResult(res);
      return res;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
  }, []);

  return { provision, status, result, reset, loading: status === 'loading' };
}
