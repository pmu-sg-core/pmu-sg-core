'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function updateTierConfig(formData: FormData) {
  const tierId = formData.get('tierId') as string;

  const updates = {
    max_input_chars: parseInt(formData.get('max_input_chars') as string),
    max_output_tokens: parseInt(formData.get('max_output_tokens') as string),
    model_provider: formData.get('model_provider') as string,
    model_name: formData.get('model_name') as string,
    temperature: parseFloat(formData.get('temperature') as string),
    system_prompt: formData.get('system_prompt') as string,
    can_access_kb: formData.get('can_access_kb') === 'true',
    enable_history: formData.get('enable_history') === 'true',
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('config_settings')
    .update(updates)
    .eq('plan_tier_id', tierId);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/settings');
}
